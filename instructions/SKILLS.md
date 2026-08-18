# Spidr Skills — Claude Code Workflow

This project ships its own set of Claude Code **slash commands** (also called "skills") that automate the daily release loop — booting the stack, auditing for vulnerabilities, logging patch notes, committing, and pushing. They live in `.claude/commands/` and are loaded automatically whenever Claude Code is opened from the repo root.

> **New here?** Read the **[Day-to-day flow](#day-to-day-flow)** section first. That alone covers 90% of how you'll use the project. The reference for each command is below it.

---

## Prerequisites

1. **Claude Code installed** — [claude.ai/code](https://claude.ai/code) or the CLI.
2. **Repo cloned and opened from its root** (`Spidr-Demo/`). Project skills only auto-load when Claude Code's working directory is the repo root.
3. **For `/dev`** — Java, Node, and npm installed; dependencies already present (`npm install` in `spidr-client` + `spidr-server`, plus Maven for `spidr-auth`).
4. **For `/ship`** — push access to `origin` on GitHub.

You invoke any of these by typing the slash + name in the Claude Code prompt: `/dev`, `/ship`, etc.

---

## Quick reference

| Command | Purpose | When to use |
|---|---|---|
| [`/start`](#start) | Prime the session: best model + compact reasoning + minimum tokens | Once, at session open |
| [`/dev`](#dev) | Boot the full local stack (auth :8080, server :4000, client :5173) | Anytime you need a live local environment |
| [`/kill`](#kill) | Stop the local stack — kills ports 8080 / 4000 / 5173 | When you're done for the day |
| [`/patch`](#patch) | Log a new SPIDR_SYS patch note (both sources of truth, in lockstep) | After a release |
| [`/security-cleanup`](#security-cleanup) | Full security audit (secrets, auth, headers, deps, …) with auto-fixes | Before pushing, before deploys |
| [`/git-workflow`](#git-workflow) | Status → stage → drafted commit (no Claude attribution) → push | When you just want to push, no audit |
| [`/ship`](#ship) | Full release pipeline: audit → patch note → commit → push | The headline command — use this for releases |
| [`/spidr-update`](#spidr-update) | Re-sync `CLAUDE.md` with current routes, models, components, deps | After big architectural changes |

---

## Day-to-day flow

```
┌─ /start ────────────────────────────── prime session (model + concise mode)
│
├─ /dev ──────────────────────────────── boot the stack (background)
│
│   … do the work …
│
├─ /ship ──────────────────────────────── release pipeline
│   ├─ Stage 1: /security-cleanup       audit + auto-fix
│   ├─ Stage 2: /patch  (default yes)   log SPIDR_SYS note in both sources
│   └─ Stage 3: /git-workflow           commit + push
│
└─ /kill ──────────────────────────────── tear down the stack
```

**The headline command is `/ship`.** It chains the audit, patch note, and push in the right order so a release goes out with security verified, SPIDR_SYS in sync, and a clean commit — all in one prompt.

If you're not shipping a release (docs change, `.claude/` edit, in-progress branch work), say "no" when `/ship` asks "log this as a patch note?" — it'll skip Stage 2 and push the rest.

---

## Reference

### `/start`

**File**: `.claude/commands/start.md`

Three-step session primer:

1. Checks current model is `claude-opus-4-7`. If not, asks you to run `/model claude-opus-4-7` and re-invoke. (`/model` is a built-in CLI command, not a skill — only you can switch it.)
2. Activates the **compact-opus** skill (concise responses, full reasoning).
3. Activates the **token-reduction** skill (~80% shorter, terminal-friendly).

Effects persist for the rest of the session. Run once at the start of a working session. Don't pair it with other work in the same turn — it's purely a primer.

---

### `/dev`

**File**: `.claude/commands/dev.md`

Launches all three Spidr services in parallel as background processes:

| Service | Port | What runs |
|---|---|---|
| `spidr-auth` | 8080 | Spring Boot — `./mvnw spring-boot:run -DskipTests` |
| `spidr-server` | 4000 | Node.js — `node src/index.js` |
| `spidr-client` | 5173 | Vite — `npm run dev` |

The Spring Boot service takes ~15 seconds to come up — don't try to log in before then. The Vite dev server is already configured to talk to `localhost:4000` and `localhost:8080`, so no env changes needed. `/dev` does **not** run `npm install` or `mvn install` — bring the deps in yourself first.

---

### `/kill`

**File**: `.claude/commands/kill.md`

One-liner: `npx kill-port 4000 5173 8080`. Stops all three dev services. Silently skips ports that weren't running — no error noise.

---

### `/patch`

**File**: `.claude/commands/patch.md`

Logs a new SPIDR_SYS patch note. SPIDR_SYS is the bottom-right "system terminal" on the home page, and it reads from **two** sources that must stay byte-identical:

| Source | File | Array |
|---|---|---|
| Server (canonical) | `spidr-server/src/routes/system.js` | `NEWS` |
| Client mock (renders instantly + fetch fallback) | `spidr-client/src/components/spidr/SpidrSystem.jsx` | `MOCK_NEWS` |

The skill prompts for title, type (`UPDATE` / `FIX` / `ALERT`), and description; generates a unique id (re-using one would silently kill the unread "Spider-Sense" badge); defaults the date to today; and inserts byte-identical entries at index 0 of both arrays. Verifies sync before reporting success.

The "stuck" symptom that prompted this skill: updating only one source means deployed users see stale data on first paint (if the mock is behind) or after the fetch lands (if the server is behind). Always update both — that's exactly what `/patch` enforces.

`/patch` does **not** commit or push. It pairs with `/ship` (or `/git-workflow`) afterward.

---

### `/security-cleanup`

**File**: `.claude/commands/security-cleanup.md`

Full security audit across 8 categories:

1. Secrets & credentials (incl. git history)
2. Frontend exposure (only `VITE_*` / `NEXT_PUBLIC_*` should be reachable from the browser)
3. Authentication & rate limiting
4. Input validation & sanitization
5. Injection (SQL / NoSQL / XSS / CSRF / SSRF / command / path traversal)
6. Headers, cookies, transport
7. Dependencies (`npm audit`, etc.)
8. Logging & error handling

Outputs a structured report (🔴 critical → 🟢 informational). **Auto-fixes the safe stuff** (gitignore, helmet, validation schemas, obvious missing rate limits). **Asks before risky changes** (anything that touches auth flows, deployed configs, or could log users out). **Never auto-rotates secrets, never deletes git history, never deploys** — those are listed under "Manual actions" for you to handle.

When sub-agents are available, this skill fans the scan across folders in parallel.

---

### `/git-workflow`

**File**: `.claude/commands/git-workflow.md`

The plain push flow with one project convention baked in: **no Claude attribution in commits.**

1. `git status` — show changed files.
2. `git add .` — respects `.gitignore` (don't use `git add -A` with force flags here).
3. Drafts a 3–4 sentence commit message in plain present tense.
4. **Asks for approval or edits** before committing.
5. `git commit -m "<approved>"` — no `Co-Authored-By: Claude` line, no AI attribution.
6. `git push` (or `git push --set-upstream origin <branch>` if no upstream).

Use this directly when you want to push something that isn't a release (docs, config tweaks, in-progress work). For releases, use `/ship` instead — it wraps this with an audit and a patch note.

---

### `/ship`

**File**: `.claude/commands/ship.md`

The full release pipeline. Three stages with gates between them:

```
/ship
  ├─ Stage 1: /security-cleanup
  │    └─ Gate: 🔴 critical → halt. 🟡 high/med → confirm. 🟢 clean → continue.
  ├─ Stage 2: /patch  (default yes, skippable)
  │    └─ Gate: server NEWS + client MOCK_NEWS must be byte-identical
  └─ Stage 3: /git-workflow
       └─ status → add . → drafted commit → push
```

Why this order:

- **Security first** so we don't waste effort writing a patch note for code that won't ship.
- **Patch second** because any security auto-fixes are already in the tree by then — the patch can mention them, and both edit sets bundle into a single commit.
- **Git-workflow last** so one push carries security fixes + SPIDR_SYS note + anything else pending.

Stage 2 is **opt-in but defaulted yes** — say no when you're pushing docs / config / non-release commits. Stage 1 is mandatory; if you want to skip the audit, use `/git-workflow` directly.

---

### `/spidr-update`

**File**: `.claude/commands/spidr-update.md`

Re-syncs `CLAUDE.md` (project-level instructions for Claude) with the current real state of the codebase — new routes, models, pages, components, dependencies. Run this after architectural changes (new routes, new shell wrappers, deps swapped) so future Claude sessions start with accurate context. Not needed for typical day-to-day work.

---

## Notes for collaborators

- **All these commands live in `.claude/commands/`** — they're markdown files with a YAML frontmatter. You can read them directly to see exactly what each does. To propose a change, edit the file and PR it like any other code.
- **Commands are project-scoped**, not user-scoped. They follow the repo, so a teammate cloning fresh gets the same skill set you have.
- **The order matters in `/ship`.** If you ever wonder why a stage runs where it does, the rationale is in the command's own markdown.
- **Don't bypass the security gate** in `/ship`. The JWT/Mongo/Resend credentials leaked in commit `5a49385` — and survived a "removed mistakes" commit because deleting a file doesn't purge git history — are the exact class of mistake `/ship` exists to catch before the push.
- **When in doubt, ask Claude.** "What does `/patch` do?" or "Why does `/ship` halt on critical findings?" — the answers are in these files and Claude will surface them.
