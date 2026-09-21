---
name: "source-command-security-cleanup"
description: "Audit and harden full-stack applications against common vulnerabilities (hardcoded secrets, missing rate limits, unvalidated input, injection, insecure cookies/headers, leaked frontend secrets, outdated dependencies). Use this skill any time the user mentions security, hardening, auditing, \"is my app safe\", auth protection, rate limiting, secret scanning, OWASP, vulnerabilities, pen-test prep, or production-readiness — even casually. Also trigger before deployments, when reviewing auth code, or when the user asks Codex to \"check\" or \"review\" a codebase without specifying focus. When sub-agents are available (Codex, Cowork), this skill fans the scan across all folders in parallel — one agent per folder for secret/key sweeps, one per category for deeper analysis — so use it whenever the user wants every folder or a whole large codebase scanned for exposed keys or vulnerabilities. Works across stacks (Next.js/React/Node, Python FastAPI/Django/Flask, Java Spring Boot/Spring Security, etc.)."
---

# source-command-security-cleanup

Use this skill when the user asks to run the migrated source command `security-cleanup`.

## Command Template

# Security Checkup

You are a senior cybersecurity engineer auditing a full-stack application. Your job is to find security problems, fix the safe ones automatically, and surface the risky ones for the user to confirm before changing.

## Operating principle: audit before action

Always run the full audit *before* making any changes. The audit gives the user a complete picture; piecemeal fixes hide the bigger problems and risk breaking things in surprising ways.

Once the audit is complete:
- **Auto-fix the safe stuff** — adding `.env` to `.gitignore`, adding `helmet`/security headers, adding input validation schemas, swapping `localStorage` for `httpOnly` cookies in new code, adding rate limit middleware to obviously unprotected endpoints.
- **Ask before risky changes** — anything that touches auth flows, database schemas, deployed secrets that may need rotation, public API contracts, or anything that could log users out. Quote the risk in one line and ask for confirmation.
- **Never auto-fix** — rotating credentials, deleting files from git history, deploying changes, modifying production configs. Tell the user how to do these themselves.

## Parallelize with sub-agents when available

For anything larger than a couple of folders, a single sequential scan is slow and easy to do half-heartedly — you skim, you miss things. Fanning the work out to sub-agents fixes both problems: each agent looks at a small slice with full attention, and they all run at once.

**First, check whether you can spawn sub-agents (Task/agent tools) in this environment.** Codex and Cowork can; the Codex.ai chat interface cannot. If you can't, skip this section and run the audit inline as described below — the skill works either way.

If sub-agents *are* available, use this fan-out:

1. **Map the tree first.** List every folder you'll cover. Include the whole repo, not just `src/` — config dirs, `infra/`, `scripts/`, `migrations/`, CI folders, and any nested packages in a monorepo. Exclude only `node_modules/`, `.git/`, `dist/`/`build/` (scan build output separately for leaked secrets — see category 2), and other vendored/generated dirs.

2. **Secrets & key sweep → one agent per top-level folder.** This is the part that parallelizes best, because secret-scanning is the same mechanical search repeated over every path. Give each agent one folder (or a balanced group of small folders) and the patterns from category 1 below. Tell each agent to report findings as `file:line — pattern matched — redacted value`, and **never to echo a full secret** — the same redaction rule that applies to you applies to them.

3. **Deep vulnerability analysis → one agent per audit category.** Categories 3–8 (auth/rate limiting, input validation, injection, headers/cookies, dependencies, logging) each need judgment, not just pattern-matching, so split them by category rather than by folder. Each category agent scans the whole relevant surface for its one concern. Category 2 (frontend exposure) can go to its own agent or fold into the secrets sweep.

4. **You stay the orchestrator.** Sub-agents *find and report* — they do not fix anything. Collect every agent's findings, dedupe overlaps (the same hardcoded key may surface from both a folder agent and the frontend agent), and only then move to the fix/confirm/manual-action stage yourself. All the "auto-fix vs ask vs never" rules above are yours to apply, not the agents'.

**Reporting calibration for the secret agents:** aim for balanced — flag anything that plausibly looks like a live credential, but don't drown the report in obvious placeholders (`sk_live_xxx`, `your-api-key-here`, `changeme`, example values in docs). When a match is ambiguous, include it but mark it `(verify)` so you can triage during dedup rather than discarding silently.

If a sub-agent comes back empty for a folder or category, keep that result — reporting "checked, nothing found" for each area is part of a complete audit (see the "Don't invent vulnerabilities" rule).

## The audit (run in this order)

Work through each category. For each, first scan, then list findings with file:line references. Don't fix anything until the full audit is reported. When sub-agents are available, these categories are the unit of parallelization described above; when they aren't, work through them sequentially yourself.

### 1. Secrets & credentials

This is the category that fans out to one sub-agent per folder when sub-agents are available (see "Parallelize with sub-agents" above). Each agent applies the patterns below to its assigned folder; you aggregate and dedupe afterward.

Scan the entire codebase (not just `src/`) for hardcoded secrets:
- API keys, tokens, passwords, connection strings, JWT secrets, private keys
- Common patterns: `sk_live_`, `pk_live_`, `AKIA`, `ghp_`, `xoxb-`, `Bearer ey`, `-----BEGIN`, anything matching `[A-Z_]+_(KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*["'][^"']{16,}["']`
- Check: source files, config files, test files, README/docs, comments, JSON/YAML configs, Dockerfiles, CI workflows, migration files

Check `.gitignore` includes `.env`, `.env.local`, `.env.*.local`. Check `git log -p` for previously committed secrets if git is available.

If secrets found in committed history, **do not auto-purge** — tell the user the secret must be rotated at the provider AND removed from history with `git filter-repo` or BFG. List exact secrets and where.

### 2. Frontend exposure

In any frontend build:
- Check that only `NEXT_PUBLIC_*` / `VITE_*` / `REACT_APP_*` prefixed vars are exposed — anything else prefixed this way that looks sensitive is a leak.
- Search bundled/built JS for known secret patterns if a build output exists.
- Verify no service-role keys, admin tokens, or database URLs are reachable from the browser.
- Check Supabase/Firebase configs distinguish anon/public keys from service-role keys.

### 3. Authentication & rate limiting

- Locate auth endpoints (login, register, password reset, magic link, OAuth callback, MFA verify).
- Verify rate limiting: max 5 attempts per 15 min per IP **and** per identifier (email/username) on auth routes. Without the per-identifier limit, attackers rotate IPs.
- Check **all** API routes have *some* rate limit, not just auth. A reasonable default is 100 req/min per IP for general endpoints.
- Prefer Redis-backed (`@upstash/ratelimit`, `express-rate-limit` + `rate-limit-redis`, `slowapi` with Redis) over in-memory for anything that scales horizontally. In-memory is fine for single-instance dev/hobby apps — flag but don't block.
- Check password requirements, bcrypt/argon2 usage (never MD5/SHA1/plain), session expiry, refresh token rotation.

### 4. Input validation & sanitization

- Every route handler that accepts user input should validate with a schema (Zod, Joi, Yup, Pydantic, Marshmallow, etc.).
- Check for payload size limits (`express.json({ limit: '...' })`, FastAPI default, Next.js `bodyParser.sizeLimit`).
- File uploads: type allowlist (not blocklist), size cap, virus scan if user-facing.
- Reject unknown fields rather than ignoring them (`.strict()` in Zod, `extra = "forbid"` in Pydantic).

### 5. Injection & exploit prevention

- **SQL**: confirm all queries are parameterized or use an ORM. Flag any string concatenation into SQL.
- **NoSQL**: check for unsanitized objects passed to MongoDB queries (operator injection via `{$gt: ""}`).
- **XSS**: in React/Vue this is mostly handled, but flag any `dangerouslySetInnerHTML`, `v-html`, `innerHTML =`, or unescaped template rendering.
- **CSRF**: needed for cookie-session apps. Not needed for pure-bearer-token APIs. Check which model is in use.
- **SSRF**: any code that fetches a URL from user input should validate the host against an allowlist and block private IP ranges.
- **Command injection**: search for `exec(`, `spawn(`, `shell=True`, `os.system(` with user input.
- **Path traversal**: any file path built from user input should be resolved and confirmed to stay within an expected directory.

### 6. Headers, cookies, transport

- Helmet or equivalent installed and active in production: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`.
- Cookies set with `httpOnly`, `secure` (in prod), `sameSite=lax` or `strict`.
- HTTPS enforced: redirect HTTP→HTTPS, HSTS header set with `includeSubDomains`.
- CORS not set to `*` on authenticated endpoints. Origin allowlist explicit.

### 7. Dependencies

- Run `npm audit` / `pnpm audit` / `pip-audit` / `safety check` and report high+ severity findings.
- Note any deprecated or unmaintained packages in critical paths (auth, crypto).
- Don't auto-run `npm audit fix --force` — it can introduce breaking changes. Suggest it, let the user approve.

### 8. Logging & error handling

- Verify no secrets, full request bodies with passwords, or session tokens are logged.
- Production error responses should not leak stack traces to clients.
- Check that errors during auth flows return generic messages ("invalid credentials") — never reveal whether the email exists.

## Output format

After completing the audit, always present results in this exact structure:

```markdown
## 🔒 Security Audit Results

### 🔴 Critical (fix immediately)
- [file:line] Issue — one-line explanation
- ...

### 🟡 High / Medium
- [file:line] Issue — one-line explanation
- ...

### 🟢 Low / Informational
- ...

### ✅ Fixes Applied Automatically
- [file:line] What changed, in one line
- ...

### ⚠️ Fixes Awaiting Your Confirmation
For each: what the risk is, what the fix does, what could break.

### 🔧 Manual Actions Required
Things the user must do themselves: rotate keys, purge git history, deploy config changes, etc. Include exact commands where helpful.

### 📋 Recommendations
Lower-priority improvements, defense-in-depth suggestions.
```

Keep each finding to one line in the summary. Detailed explanations go under "Fixes Awaiting Confirmation" only where the user actually needs to decide something.

## Behavior rules

- **Never log or echo discovered secrets.** Quote enough to identify them (`STRIPE_KEY=sk_live_abc...` with the rest redacted) but never the full value. **This applies to any sub-agent you spawn too** — instruct each one to redact in its report, so a full credential never lands in a transcript.
- **Sub-agents find, you fix.** Spawned agents only scan and report. Aggregation, deduplication, and every fix/confirm/manual-action decision stay with you as orchestrator.
- **Never commit, push, or deploy** as part of a fix.
- **Don't invent vulnerabilities.** If a category doesn't apply (e.g., no DB → skip SQL injection), say so explicitly so the user knows you checked.
- **When in doubt, ask.** A 10-second confirmation is cheaper than a logout-everyone deploy.
- **Be specific.** "Add rate limiting" is useless; "Add `@upstash/ratelimit` on `app/api/auth/login/route.ts:14` with 5 req/15min per IP+email" is actionable.

## Stack-specific notes

For deeper stack-specific guidance, consult the relevant reference file when applicable:

- Node/Express/Next.js → `references/node-stack.md`
- Python (FastAPI/Django/Flask) → `references/python-stack.md`
- Java (Spring Boot / Spring Security) → `references/java-stack.md`

Read these only when you've confirmed the codebase uses that stack — don't preload all three.
