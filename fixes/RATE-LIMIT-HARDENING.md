# Rate Limit Hardening — Anti-Abuse Defense Plan

**Date:** May 2025
**Scenario:** Malicious user deliberately exhausting rate limits to deny service to legitimate beta users

---

## Current State

`express-rate-limit` in `spidr-server/src/index.js`:
- **200 requests / 15 minutes, keyed by IP**
- Skips `/uploads` routes
- No socket event limiting
- No per-user limiting
- Spring Boot auth service has no rate limiting at all

**The gap:** IP-based limiting is bypassable with a VPN or proxy rotation. A determined attacker can exhaust the limit without ever being personally throttled.

---

## Attack Vectors

1. **IP rotation** — attacker rotates VPNs/proxies to bypass the per-IP bucket
2. **Socket event spam** — `send:dm`, `friend:request`, etc. are not rate-limited at all
3. **Auth endpoint brute force** — login + OTP endpoints on Spring Boot are unprotected
4. **Shared-IP collateral** — attacker on a shared IP (university, office) throttles innocent users on the same network

---

## Proposed Fixes (Priority Order)

### 1. Per-User Rate Limiting (highest impact)
After `authMiddleware`, key the limiter on `req.user?.id` instead of (or in addition to) IP. A user hammering from 10 different IPs still hits one shared bucket.

```js
// spidr-server/src/index.js
const userRateLimit = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 120,                   // 120 req/min per authenticated user
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => !req.user,  // unauthenticated reqs fall through to IP limit
});
app.use(authMiddleware, userRateLimit);
```

### 2. Socket Event Rate Limiting
The REST limiter doesn't touch Socket.io events. Add a per-socket counter in `handlers.js`.

```js
// spidr-server/src/socket/handlers.js
const socketEventCounts = new Map(); // socketId -> { count, resetAt }

function socketRateLimit(socket, limit = 30, windowMs = 1000) {
  const now = Date.now();
  const entry = socketEventCounts.get(socket.id) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  socketEventCounts.set(socket.id, entry);
  if (entry.count > limit) {
    socket.emit('error', { message: 'Rate limit exceeded' });
    return false;
  }
  return true;
}
// Use at the top of each socket handler: if (!socketRateLimit(socket)) return;
```

### 3. Tiered Limits by Endpoint Class
Writes are more expensive than reads. Split the blanket limit:

| Endpoint class | Limit |
|---|---|
| GET (reads) | 200 / 15 min (keep current) |
| POST / PATCH / DELETE (writes) | 20 / 1 min |
| `/auth/*` (login, OTP) | 10 / 15 min |
| `/upload` | 5 / 1 min |

### 4. Auto-Ban After Repeated 429s
Track in Redis (or in-memory for single-instance): if a `user_id` triggers 429 more than N times in a window, block them for 1 hour.

```js
// Rough sketch — hook into rate-limit's handler callback
handler: (req, res) => {
  trackAbuse(req.user?.id || req.ip);  // increment Redis counter
  res.status(429).json({ error: 'Too many requests' });
}

function trackAbuse(key) {
  const hits = abuseMap.get(key) || 0;
  abuseMap.set(key, hits + 1);
  if (hits + 1 >= 10) blockList.add(key); // block after 10 429s
}
```

### 5. Cloudflare Proxy in Front of Railway
Point the Railway domain through Cloudflare. Free tier provides:
- IP reputation filtering (known bot/VPN IPs)
- DDoS volumetric protection
- Firewall rules (block by country, ASN, etc.)
- No code changes required — DNS-level fix

**How:** Add Railway's `*.up.railway.app` domain as a CNAME behind Cloudflare on a custom domain, enable proxy (orange cloud).

### 6. Spring Boot Auth Hardening
Spring Boot has no rate limiting by default. Login and OTP endpoints are open to brute force.

Options:
- Add `bucket4j-spring-boot-starter` — per-IP or per-email bucket on `/auth/login` and `/auth/verify`
- Simple in-memory attempt counter per email address with lockout after N failures
- Cloudflare (item 5) provides a layer here too if auth is behind the same domain

---

## Decision Points

1. **Redis available?** Items 2 and 4 work better with Redis (already optionally wired in for Socket.io). If Redis is running, use it for abuse counters. If not, in-memory works for single-instance Railway deployments.
2. **Custom domain on Railway?** Required for Cloudflare proxy (item 5). If still on `*.up.railway.app` directly, Cloudflare can't proxy it.
3. **Spring Boot priority?** Auth brute force is the most likely real-world attack vector. Item 6 may warrant doing before items 2–4.

---

## Summary

The single highest-ROI change is **per-user rate limiting** (item 1) — it makes IP rotation useless. Second is **Cloudflare** (item 5) — zero code, stops volumetric attacks at the edge. Socket and auth hardening follow from there.
