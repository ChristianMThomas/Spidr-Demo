# Spidr — Claude Code Skill Workflows

All project slash commands live in `.claude/commands/` and load automatically when Claude Code is opened from the `Spidr-Demo/` root. Type any command in the Claude Code prompt to invoke it.

---

## Skill Glossary (what every command actually does)

Before the workflows, understand the atomic skills and what the compound ones chain together.

| Skill | What it does | What's abstracted inside |
|---|---|---|
| `/start` | Switches to Opus 4.7, activates compact-opus + token-reduction for the session. Run once. | Invokes `compact-opus` skill + `token-reduction` skill. |
| `/dev` | Starts auth (:8080), server (:4000), and client (:5173) as background processes. | Nothing — runs three Bash commands in parallel. |
| `/kill` | Stops all three dev services by killing ports 8080 / 4000 / 5173. | `npx kill-port` — one command. |
| `/patch` | Logs a new SPIDR_SYS patch note into both the server `NEWS` array and the client `MOCK_NEWS` array, byte-identical, newest first. Verifies sync before finishing. **Does not commit or push.** | Nothing — direct file edits + grep verification. |
| `/security-cleanup` | Full 8-category security audit (secrets, frontend exposure, auth/rate limits, input validation, injection, headers/cookies, dependencies, logging). Auto-fixes the safe stuff, asks before risky changes, lists manual actions (key rotation, git history purges). **Never commits or pushes.** | Fans into sub-agents when available (one per folder for secrets sweep, one per category for deep analysis). You stay orchestrator. |
| `/git-workflow` | `git status` → `git add .` → drafts commit message (no Claude attribution) → asks for approval → `git commit` → `git push`. | Nothing — plain git commands. |
| `/ship` | Full release pipeline with gates. | **Stage 1:** `/security-cleanup` → Gate (🔴 halt, 🟡 confirm, 🟢 continue). **Stage 2:** `/patch` (default yes, skippable) → Gate (arrays must be byte-identical). **Stage 3:** `/git-workflow`. |
| `/handoff` | Writes `handoff.md` at repo root — six sections: Goal, Current State, Files, Changes, Failed, Next Step. Overwrites each time. | Reads git diff + status to confirm touched files. |
| `/handoff-and-receive` | Detects phase: if context is heavy → runs `/handoff` then tells you to `/clear`. If session is fresh + `handoff.md` exists → reads it, briefs you, immediately acts on Next Step. | `/handoff` (Phase 1). Direct file read (Phase 2). |
| `/recieve` | Cold restart — reads `handoff.md`, presents briefing, immediately acts on Next Step. Demands `/clear` first if context is heavy. | Direct file read only. |
| `/spidr-update` | Audits the live codebase (routes, models, pages, components, deps, env vars) and rewrites `CLAUDE.md` to match. Shows a diff summary of what changed. | Runs git log + diff to find what areas changed recently, then reads source files to verify claims. |
| `/cross-check` | Audits the current branch's changes, classifies every file by platform zone (MOBILE / WEB+ELECTRON / SERVER / AUTH / INFRA), flags cross-platform impact, appends a dated entry to `PLATFORM-IMPACT.md`, prints a copy-pastable partner summary. | Runs git diff against `master`, reads changed shared-zone files to surface specific routes/models/sockets touched. |

---

## Workflow 1 — First Time Using the Project

You've just cloned the repo and opened Claude Code for the first time.

```
/start
  └── Checks model, activates compact-opus + token-reduction.
      If you're not on Opus 4.7 it will tell you: run /model claude-opus-4-7 first.

(Once model is confirmed)

/dev
  └── Starts auth :8080, server :4000, client :5173 in background.
      Wait ~15 seconds for Spring Boot before logging in.

... explore the app at http://localhost:5173 ...

/kill
  └── Tears everything down cleanly.
```

**Notes for first-timers:**
- Make sure you've run `npm install` in `spidr-client/` and `spidr-server/` before `/dev`. Also copy `spidr-server/.env.example` → `spidr-server/.env` and fill in at minimum `MONGO_URI`, `JWT_SECRET`, `PORT=4000`.
- `/dev` does **not** run install — deps must already be present.
- Spring Boot falls back to a built-in dev JWT secret if you skip `JWT_SECRET` — auth will work locally without it.

---

## Workflow 2 — Standard Daily Dev Session

The bread-and-butter loop for any day of active development.

```
/start
  └── Session primer once at the top of the day.

/dev
  └── Stack up. Wait for Spring Boot.

... do the work — edit code, ask Claude questions, fix bugs ...

/ship
  ├── Stage 1: /security-cleanup
  │     └── Audits for secrets, missing rate limits, injection vectors, bad headers, dep vulns.
  │         Auto-fixes safe issues. Asks before risky ones. Lists manual actions (key rotation, etc.).
  │         Gate: 🔴 critical → pipeline halts. 🟡 high/medium → you confirm. 🟢 → continues.
  ├── Stage 2: /patch  (Claude will ask — default yes)
  │     └── Prompts for patch title, type (UPDATE / FIX / ALERT), and description.
  │         Generates a unique id. Inserts byte-identical entries at index 0 of:
  │           spidr-server/src/routes/system.js   → NEWS array
  │           spidr-client/src/components/spidr/SpidrSystem.jsx → MOCK_NEWS array
  │         Verifies sync before proceeding.
  │         Gate: arrays must be byte-identical.
  └── Stage 3: /git-workflow
        └── git status → git add . → drafts commit message → asks your approval → commit → push.
            No Co-Authored-By, no Claude attribution — ever.

/kill
  └── Tear down the stack at end of day.
```

**When to skip Stage 2 (the patch note):**
Say "no" when `/ship` asks if you're pushing docs, config files, `.claude/` command edits, or in-progress branch work that isn't a release. `/ship` will skip to Stage 3.

---

## Workflow 3 — Quick Non-Release Push (No Audit, No Patch Note)

For docs, `.claude/` edits, README updates, config tweaks — things that don't need a security audit or a SPIDR_SYS patch note.

```
/git-workflow
  └── git status → git add . → draft commit message → your approval → commit → push.
      That's it. No audit. No patch note. No attribution.
```

**When to use this instead of `/ship`:**
- You're pushing `.claude/commands/` edits
- You're updating `CLAUDE.md` or `SKILLS.md` or `WORKFLOWS.md`
- You're merging in-progress branch work you're not ready to release
- You already ran `/ship` this session and want to add one more small commit

---

## Workflow 4 — Coming Back After a Break (Context Already Exists)

You left a session mid-work, the context window still has history, and you want to pick up right where you left off.

```
/start                        ← re-prime if you opened a new terminal / new session
  └── Reactivates compact-opus + token-reduction if the session is fresh.
      If already primed: "session already primed" — safe to run again, it's a no-op.

/dev                          ← only if the stack isn't still running
  └── Check if ports 4000 / 5173 / 8080 are alive first. If so, skip.

... resume work using conversation context ...
```

**If you're unsure whether the stack is running:**
Just ask Claude: "Is the dev stack running?" — or run `/dev` again. If ports are already in use, it'll tell you which process to kill (`npx kill-port 4000` etc.) and you can decide whether to restart or leave it.

---

## Workflow 5 — Running Out of Context Mid-Session

The conversation is getting long and you're nearing the context limit. Don't lose your work state.

```
/handoff
  └── Reads git diff + git status to confirm what files were actually touched.
      Writes (or overwrites) handoff.md at the repo root with six sections:
        Goal           — what you're building/fixing
        Current State  — exact state of the code right now
        Files          — every file actively modified (repo-relative paths)
        Changes        — what was completed this session (present-tense bullets)
        Failed         — what didn't work and why (the most important section)
        Next Step      — the single most important next action, specific enough to act on

/clear     ← built-in CLI command, only you can run this (not Claude)
  └── Resets the conversation context. Do NOT close the tab.

/recieve   ← in the fresh context after /clear
  └── Reads handoff.md fresh (no memory shortcuts).
      Presents a structured briefing: Goal, Current State, Active Files, Done, Failed, Next Step.
      Immediately starts working on Next Step — no confirmation needed.
      After completing it: "Should I keep going or do you want to redirect?"
```

**Shortcut:** `/handoff-and-receive` detects which phase applies automatically. If context is heavy → it runs `/handoff` and tells you to clear. If session is fresh and `handoff.md` exists → it reads and briefs you.

---

## Workflow 6 — Starting a Session Cold (From a Previous Handoff)

You closed Claude Code yesterday, came back today, and `handoff.md` exists from last time.

```
/start                        ← prime the new session first
  └── Model + compact-opus + token-reduction.

/recieve
  └── Reads handoff.md fresh.
      Briefs you on what was left, what failed, and what to do next.
      Immediately acts on Next Step.

/dev                          ← if you need the local stack
  └── Brings the services up.

... continue from exactly where you left off ...

/ship  (when ready to release)
  └── Full pipeline: audit → patch note → push.
```

---

## Workflow 7 — Collaborating (Before Opening a PR)

Two developers work in parallel on the same monorepo. Before opening a PR, run `/cross-check` so your partner knows what you touched.

```
(finish your feature branch work)

/cross-check
  ├── Gathers: git status + git diff master...HEAD + uncommitted changes + commits ahead of master
  ├── Classifies every changed file into a zone:
  │     MOBILE          → spidr-client/mobile/**
  │     WEB+ELECTRON    → spidr-client/src/**, spidr-client/public/**, electron/**
  │     SERVER (shared) → spidr-server/**   ← affects ALL clients
  │     AUTH (shared)   → spidr-auth/**     ← affects ALL clients
  │     INFRA / DOCS    → .claude/**, *.md, root configs
  ├── Decides the verdict:
  │     MOBILE-ONLY        → partner is safe, no action needed
  │     WEB+ELECTRON-ONLY  → mobile dev is safe
  │     CROSS-PLATFORM     → both devs must coordinate
  │     INFRA-ONLY         → no runtime impact
  ├── For CROSS-PLATFORM: reads the actual diff and surfaces:
  │     - specific HTTP routes added / changed / removed
  │     - model schema fields added / changed / removed
  │     - Socket.io event names added / changed / removed
  │     - whether mobile client mirrors a new server route (or doesn't — flags it)
  ├── Appends a dated entry to PLATFORM-IMPACT.md (creates it if missing)
  └── Prints a copy-pastable partner summary to paste into your PR / Discord / Slack

/ship  (or /git-workflow if not a release)
  └── The PLATFORM-IMPACT.md update flows into this commit.
```

**Most common silent miss:** a server route or model change where only one client (web or mobile) was updated. `/cross-check` explicitly flags "mobile not yet updated" or "web not yet updated" so the partner knows before they pull.

---

## Workflow 8 — Releasing a Hotfix (Fast, No Dev Server Needed)

You found a bug in prod and need to fix and push quickly, without spinning up the full local stack.

```
/start                        ← prime the session

(edit the fix directly in files)

/ship
  ├── Stage 1: /security-cleanup
  │     └── Quick audit — the fix itself shouldn't introduce new vulns,
  │         but this catches anything stale in the surrounding code.
  │         If 🟢 clean, passes immediately.
  ├── Stage 2: /patch
  │     └── Type "FIX". Title like "Patch 1.9.2 is now live".
  │         Description: one paragraph describing the bug + fix. No line breaks.
  │         Both NEWS arrays updated and verified byte-identical.
  └── Stage 3: /git-workflow
        └── Commit message leads with the fix. Push.
```

---

## Workflow 9 — After a Big Architecture Change

You added new routes, new models, a new service, or swapped out a major dependency. CLAUDE.md is now stale — future Claude sessions will start with bad context.

```
(finish the architectural work)

/spidr-update
  ├── Runs git log + git diff to see what changed recently
  ├── Audits every section of CLAUDE.md against the real codebase:
  │     Stack versions, route counts, model counts, pages, components,
  │     API client shape, auth flow, Electron IPC, env vars, npm scripts
  ├── Rewrites CLAUDE.md in full to match what's actually there
  └── Shows a diff summary: e.g. "Routes: 28→31 (added payments, webhooks, analytics)"

/ship  (or /git-workflow if the spidr-update itself is what you're pushing)
  └── CLAUDE.md change flows into the commit naturally.
```

**When to run this:**
- Added or removed route files in `spidr-server/src/routes/`
- Added or removed model files in `spidr-server/src/models/`
- Added a new top-level service or package
- Added major new dependencies (payments, AI SDK, new auth method)
- Added new pages to `spidr-client/src/pages/` or `pages.config.js`
- After Patch 1.9 (mobile) — route counts and mobile section should be current

**When NOT to run this:**
Routine feature work — `/spidr-update` is for structural changes, not every session.

---

## Workflow 10 — Security Audit Without Shipping

You want a full audit pass before a big PR, or you're preparing for a penetration test, or you just want to know the health of the codebase. You don't want to ship anything yet.

```
/security-cleanup
  ├── Audits 8 categories across the full stack:
  │     1. Secrets & credentials (incl. git history)
  │     2. Frontend exposure (VITE_* / only public vars in browser)
  │     3. Auth & rate limiting (per-IP and per-identifier limits, bcrypt, session expiry)
  │     4. Input validation & sanitization (Zod/Joi/Yup schemas, size limits, file type allowlists)
  │     5. Injection (SQL / NoSQL / XSS / CSRF / SSRF / command / path traversal)
  │     6. Headers, cookies, transport (Helmet, CORS, HTTPS, httpOnly cookies)
  │     7. Dependencies (npm audit — high+ severity)
  │     8. Logging & error handling (no secrets in logs, no stack traces in prod responses)
  ├── Auto-fixes the safe stuff: .gitignore additions, helmet middleware, validation schemas,
  │     missing rate limit middleware on obvious unprotected endpoints
  ├── Asks before risky changes: anything touching auth flows, deployed configs, anything
  │     that could log users out
  └── Lists manual actions: key rotation, git history purge (never auto-done)

(review the report)

(decide: fix now and /ship, or track findings in FIXME.md and /ship later)
```

---

## Workflow 11 — Patch Note Only (SPIDR_SYS Update Without a Full Ship)

Rare case: the release already went out (e.g. you pushed from the command line) but the SPIDR_SYS patch note wasn't logged. Fix the desync without a full ship.

```
/patch
  ├── Prompts for: title, type (UPDATE / FIX / ALERT), description, date (defaults today)
  ├── Generates a unique id (grepping both files to confirm it doesn't exist — re-using
  │     an id silently kills the unread "Spider-Sense" badge for every existing user)
  ├── Inserts byte-identical entry at index 0 of:
  │     spidr-server/src/routes/system.js  → NEWS array
  │     spidr-client/src/components/spidr/SpidrSystem.jsx → MOCK_NEWS array
  └── Verifies both entries are byte-identical before reporting success

/git-workflow   ← just to commit the SPIDR_SYS change
  └── Commit: "Log SPIDR_SYS patch note for <title>"
      Push.
```

**The desync bug `/patch` exists to prevent:**
If you update only one of the two arrays, users see stale data — either on first paint (client mock behind) or after the fetch lands (server NEWS behind). Always update both in one shot. `/patch` enforces this.

---

## Workflow 12 — Multiple Claude Sessions in One Day

You hit a context limit mid-session, clear, and continue. The session count resets but the work doesn't.

```
SESSION 1
  /start
  /dev
  ... work ...
  /handoff                  ← context getting heavy
  /clear                    ← only you can run this

SESSION 2 (same day, same repo)
  /recieve                  ← reads handoff.md, briefs you, starts Next Step immediately
  ... continue work ...
  /ship                     ← when ready to release
  /kill                     ← end of day
```

**Key insight:** `/recieve` reads `handoff.md` fresh every time — it never relies on memory. If the file is accurate, the second session picks up exactly where the first stopped. The "What failed" section is the most valuable part — it prevents the second session from repeating dead ends.

---

## Workflow 13 — Mobile Dev Session (Expo)

Working on `spidr-client/mobile/` — the Expo React Native app (iOS + Android).

```
/start                        ← prime session as usual

(No /dev needed for mobile — Expo has its own dev server)

(In a separate terminal — NOT through Claude):
  cd spidr-client/mobile
  npx expo start --tunnel --clear
  Scan QR code with Expo Go on your phone.

... work on mobile code ...

/cross-check                  ← before PR: classify what you touched (mobile-only vs shared backend)
  └── If you also touched spidr-server/** → verdict is CROSS-PLATFORM.
      Partner (web dev) needs to know which routes/models changed.

/ship  (or /git-workflow for non-release work)
  └── PLATFORM-IMPACT.md flows into the commit if /cross-check was run.
```

**Mobile-specific rules (from CLAUDE.md):**
- Never run `npm audit fix` in `mobile/` — it breaks the Expo SDK version pin.
- Use `npx expo install --fix` to resync versions after pulling changes.
- Phase 1 scope (Expo Go): auth, feed, servers + text channels, DMs, profile.
- Phase 2 (custom dev client, not yet built): voice channels, Spotify OAuth.

---

## Workflow 14 — Diagnosing a Broken Dev Stack

Something isn't starting. Ports are already in use, or a service crashed.

```
/kill
  └── Force-kills ports 4000 / 5173 / 8080. Silently skips ports that aren't running.
      This clears any zombie processes from a previous session.

/dev
  └── Starts all three services fresh.
      If a port is still in use after /kill, Claude will tell you which process to kill manually:
        npx kill-port 4000   ← just the one port
```

**If Spring Boot won't start:**
- Check `spidr-auth/` logs — it needs `SPRING_MAIL_USERNAME` and `SPRING_MAIL_PASSWORD` (Gmail app password) for OTP emails. Without them, registration fails at the email step. Auth token verification still works for existing tokens.
- Dev fallback JWT secret: `c3BpZHItZGV2LWZhbGxiYWNrLXNlY3JldC1rZXktcGxlYXNlLXNldC1pbi1lbnY=`

**If Node server won't start:**
- Check `spidr-server/.env` exists. Copy from `.env.example` if missing.
- `MONGO_URI` is required. Everything else has a fallback.

---

## Common Command Combinations (Quick Reference)

| Situation | Commands |
|---|---|
| Starting any session | `/start` → `/dev` |
| End of feature, ready to release | `/ship` |
| End of feature, not a release | `/git-workflow` |
| Context limit approaching | `/handoff` → `/clear` → `/recieve` |
| Picking up cold from yesterday | `/start` → `/recieve` → `/dev` |
| Before opening a PR (collab) | `/cross-check` → `/ship` |
| Architecture changed | `/spidr-update` → `/git-workflow` |
| Security audit only | `/security-cleanup` |
| Stack won't boot | `/kill` → `/dev` |
| End of day | `/ship` (or `/git-workflow`) → `/kill` |

---

## How the Compound Skills Chain

```
/ship
  ├─ /security-cleanup
  │    ├─ Sub-agents fan out per folder (secrets sweep)
  │    ├─ Sub-agents fan out per category (auth, injection, headers, etc.)
  │    ├─ You (Claude) orchestrate: collect, dedupe, fix safe, ask for risky
  │    └─ GATE: 🔴 halt / 🟡 confirm / 🟢 continue
  ├─ /patch
  │    ├─ Prompt for title / type / description / date / id
  │    ├─ Grep both files to confirm id is unique
  │    ├─ Insert at index 0 of NEWS (spidr-server/src/routes/system.js)
  │    ├─ Insert at index 0 of MOCK_NEWS (spidr-client/.../SpidrSystem.jsx)
  │    ├─ Verify byte-identical
  │    └─ GATE: must be in lockstep
  └─ /git-workflow
       ├─ git status
       ├─ git add .
       ├─ Draft commit (no Claude attribution)
       ├─ Ask for approval
       ├─ git commit
       └─ git push

/handoff-and-receive
  ├─ Phase 1 (heavy context): /handoff → write handoff.md → tell user to /clear
  └─ Phase 2 (fresh context): read handoff.md → brief → act on Next Step

/start
  ├─ Check / request model switch to Opus 4.7
  ├─ Invoke compact-opus skill
  └─ Invoke token-reduction skill
```

---

## Rule Reminders

- **`/ship` is for releases.** `/git-workflow` is for everything else.
- **Never run `/ship` stages out of order.** Security → Patch → Git. The gate between each stage exists for a reason.
- **SPIDR_SYS has two sources of truth.** Always use `/patch` to update both at once. Never touch just one.
- **Don't bypass the security gate.** If you want to skip the audit, call `/git-workflow` directly. Don't run `/ship` and then find a way around stage 1 — the leaked credentials in git history are exactly what that gate exists to catch.
- **`/recieve` demands a clean context.** If you have a full conversation history, it will tell you to run `/clear` first. That boundary is intentional — reading a handoff into a noisy context gives worse results than reading into a clean one.
- **`/cross-check` is read-only on source files.** It only writes to `PLATFORM-IMPACT.md`. It never modifies code.
- **`/spidr-update` only modifies `CLAUDE.md`.** It won't touch any other file unless you explicitly ask.
- **No Claude attribution in commits.** Ever. The `/git-workflow` step inside `/ship` enforces this. If you call `git commit` manually, follow the same rule.
