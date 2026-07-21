# GAPS.md — Honest Audit of Spidr's Weaknesses

> Written 2026-07-06 on branch `patch-1.9_Mobile`. Ordered by severity, worst first. Each item ends with a fix scoped small enough to be one task. See PROJECT.md for architecture context.

---

## 1. 🔴 CRITICAL — crudRouter's ownerless default exposes private data to every logged-in user

**What**: `crudRouter(Model)` with no `ownerField` makes `isOwner()` return true for *everyone* (`spidr-server/src/utils/crudRouter.js:26`). Many routes mount exactly that:
- `routes/directMessages.js:3` — **any authenticated user can list, read, edit, and delete anyone's DMs** (`GET /direct-messages?...` with arbitrary filters).
- `routes/users.js:38` — any user can PATCH/DELETE any other User (passwords/roles are stripped by `PROTECTED_FIELDS`, but email, username, avatar are not).
- `routes/userProfiles.js:3` — any user can PATCH anyone's profile, **including `apex_tier: 'apex'`** (free premium) — and DELETE profiles.
- Also bare: `friends.js`, `groupChats.js`, `groupChatMessages.js`, `collections.js`, `savedAudio.js`, `reports.js`, `customBots.js`, `aiChatLogs.js`, `aiConversations.js`, `serverAuditLogs.js`, `audioTracks.js`, `events.js`, `communityAssets.js`.

**Why it matters**: DM privacy is table stakes; this is a full read/write breach of every private conversation, plus free APEX and audit-log tampering, for anyone with a free account. Must be fixed before any beta tester touches production.

**Fix (one task per route file)**: add the correct `ownerField` (or a participant check for DMs/group chats — list must filter to conversations containing `req.user.id`, not accept arbitrary filters). Start with `directMessages.js` (highest impact): replace bare crudRouter with a wrapper whose LIST forces `{ $or: [{ sender_id: uid }, { recipient_id: uid }] }` and whose GET/PATCH/DELETE check participancy. Then `userProfiles.js` (`ownerField: 'user_id'` + add `apex_tier`/`apex_features` to a protected list), then `users.js` (restrict PATCH/DELETE to `req.user.id === :id`).

## 2. 🔴 CRITICAL — APEX entitlement is client-granted; billing is simulated

**What**: `ApexCommand.jsx:64-112` "processes payment" with a 1.8 s `setTimeout`, then the *browser* writes `apex_tier: 'apex'` via a normal profile PATCH. The card form collects real card numbers into React state and discards them. No Stripe, no webhook, no server check. Details in `mr-rimmer/pricing.md`.

**Why it matters**: Zero revenue integrity, and collecting card PANs in our own form is PCI exposure the moment real users type into it.

**Fix**: short-term single task — server-side: reject `apex_tier`/`apex_features` in `userProfiles` PATCH from clients (fold into gap 1's fix). Longer task: replace the card form with Stripe Checkout redirect + a webhook route that sets the tier server-side.

## 3. 🟠 HIGH — Zero automated tests across four services

**What**: No test framework, no test files, no CI test step anywhere (`spidr-server`, `spidr-client`, `mobile`, `spidr-auth`, `spidr-beta`).

**Why it matters**: The team self-merges without review (see `mr-rimmer/team.md`); tests are the only scalable safety net, and the riskiest logic (crudRouter ownership, JWT verification, rate-limit keying, tension scoring) is exactly the kind that unit-tests cheaply.

**Fix (single task)**: add Jest + supertest to `spidr-server` with one suite for `crudRouter` (ownership matrix: owner/non-owner × list/get/patch/delete × with/without ownerField and publicWriteFields) using mongodb-memory-server. That one suite guards ~24 endpoints and locks in the gap-1 fix.

## 4. ✅ RESOLVED (2026-07-19) — Legacy Node auth endpoints alongside Spring Boot

**Was**: `spidr-server/src/routes/auth.js` carried ~250 lines of legacy register/login/email-OTP/password-reset code (bcryptjs, Redis OTP store, its own `signToken` with a raw-string `getSecret()` that diverged from the base64-decoding `utils/jwtSecret.js`). Reachability had already been cut by commit `a73c5ab` (2026-07-05): a 410 gate at the `/auth` mount (`spidr-server/src/index.js:114-127`) allowlisted only `/me` + the TOTP endpoints — but the dead code shipped anyway, kept dead by that single middleware block.

**Fix applied**: `routes/auth.js` now contains only the three TOTP endpoints the clients actually call (`/setup-totp`, `/verify-totp-setup`, `/disable-totp` — `apiClient.js:224-226`, `mobile/lib/apiClient.ts:198-200`) plus a comment pointing at spidr-auth; all legacy handlers, the OTP store, `signToken`, and the divergent local `getSecret()` are deleted. The 410 gate stays as belt-and-braces and `/me` (allowlisted but unused — clients use Spring Boot `GET /users/me`) was dropped from the allowlist. Verified: server boots clean; `/auth/login`, `/auth/me`, `/auth/dev-get-otp` → 410; `/auth/setup-totp` → 401 without a token.

**Still open by design**: TOTP lives on Node until Spring Boot grows it (AUTH-F3) — auth remains split across two services for that one feature.

## 5. 🟠 HIGH — `GET /users` list leaks all user emails to any logged-in user

**What**: `routes/users.js` mounts full crud list; the json-override strips `password`/`twoFactorSecret` but returns every user with email, and the separate `/users/search` matches on email regex. spidr-auth's `GET /users/` has the same issue per `SPIDR-AUTH.md` (only `/users/all` is admin-gated in `SecurityConfiguration.java:52` — verify which route the controller actually exposes).

**Why it matters**: Full email directory = spam/phishing harvest; GDPR-unfriendly before a public beta.

**Fix (single task)**: in `users.js`, extend the json-override to also strip `email` (and any 2FA fields) unless `req.user.id === doc.id`; make `/users/search` stop matching on email or stop returning it.

## 6. 🟡 MEDIUM — SPIDR_SYS dual source of truth is manually synchronized

**What**: `routes/system.js` `NEWS` and `SpidrSystem.jsx` `MOCK_NEWS` must be byte-identical; only convention (`/patch`) enforces it. Re-used ids silently kill the unread badge.

**Why it matters**: A single hand-edit desyncs the changelog for all deployed users, invisibly.

**Fix (single task)**: write `scripts/verify-system-news.js` that parses both arrays and diffs them (ids, order, content); wire it into `/ship`'s gate. (Generating the client mock from a shared JSON at build time is the better long-term fix.)

## 7. 🟡 MEDIUM — APEX visual fields duplicated in two places per profile

**What**: `UserProfile.js:42-49` stores `apexFrameStyle`/`apexBadgeUrl`/etc. top-level *and* mirrored inside `apex_features`; consumers read top-level first then fall back; writers must write both (`ApexVisuals.jsx:511`).

**Why it matters**: Every new writer is a chance to update one copy and produce ghost styling bugs.

**Fix (single task)**: pick top-level as canonical; add a Mongoose pre-save/pre-update hook that mirrors into `apex_features`, then delete the manual double-writes in `ApexVisuals.jsx`.

## 8. 🟡 MEDIUM — Cancel/downgrade semantics contradict the UI copy

**What**: APEX cancel sets `apex_tier: 'free'` immediately (`ApexCommand.jsx:114-134`) while UI promises "Access until next billing cycle"; the manage screen shows hardcoded billing data ("Apr 14, 2026", "Monthly", "$7.99") regardless of the purchased plan.

**Fix (single task)**: read `plan_type`/`activated_at` from `apex_features` for the manage screen; align the cancel copy with the actual immediate-downgrade behavior until real billing exists.

## 9. 🟡 MEDIUM — Docs drift: README and root docs contradict the tree

**What**: `README.md` claims 38 routes/29 models (now 39/30), lists `HOW-TO-RUN.md`/`DEPLOY.md`/`FIXME.md` (deleted), and omits `spidr-beta/`, `mobile/`, and `mr-rimmer/`. `SPIDR-AUTH.md` references a `spidr-ai` service that never existed as deployed.

**Fix (single task)**: update README's layout/route counts and remove dead file references; fix the `spidr-ai` mention in SPIDR-AUTH.md.

## 10. 🟡 MEDIUM — Beta API duplicates stack patterns and hardcodes the cap

**What**: `spidr-beta/spidr-beta-api/src/index.js` re-implements CORS/rate-limit/Mongo inline, hardcodes `BETA_CAP = 50` (line 72), and defines its model inline. Cap changes require a deploy. It also stores signup IP + PII with no retention/deletion path despite the agreement promising deletion on request.

**Fix (single task)**: read `BETA_CAP` from env with 50 default, and add a `DELETE /signup?email=` (admin-keyed via a shared secret header) to honor deletion requests.

## 11. 🟢 LOW — Inconsistencies and minor debt

- **Naming**: model files PascalCase but `spidr-auth` Java has lowercase `users.java` / `userRepository.java` (violates Java conventions, confuses IDEs). Fix: rename via IDE refactor.
- **Mixed id fields**: `user_id` vs `author_id` vs both (`messages.js` ownerField is `['user_id','author_id']`). Document which models use which in a comment in crudRouter; don't churn data.
- **Known TS debt in mobile** (from handoff.md): `ClipCard.tsx(86,17)` implicit-any; loosely typed FlashList refs. Fix: add the param type.
- **Mojibake risk**: several files contain box-drawing/emoji that render as `â”€â”€` when mis-encoded; ensure editors save UTF-8 (no BOM) and PowerShell writes use `-Encoding utf8`.
- **Dead weight**: `spidr-auth/package-lock.json` (95 bytes, a Java project has no npm deps) — delete it. `.next/` directory at repo root looks like a stray Next.js build cache from another project — confirm and delete.
- **`GET /users/search` regex** is escaped (good) but unbounded frequency beyond the global read limiter; acceptable, watch it.

## What is *not* broken (so nobody "fixes" it)

- Mongo operator injection is blocked in crudRouter (strips `$` keys and nested objects).
- Upload route has a mimetype allowlist + 50 MB cap + memory storage.
- Rate limiting is tiered and user-keyed with honest `Retry-After`.
- Socket.io connections are JWT-authenticated in the handshake; room joins are auth-checked.
- JWT dev-fallback secret **throws in production** if `JWT_SECRET` is unset (`utils/jwtSecret.js:14`).
- `.env` files are gitignored, none committed to git history-visible tree (verified via `git ls-files`).
- The two-DnD-library setup in the web client is intentional.
