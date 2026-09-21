---
name: "source-command-spidr-update"
description: "Audit the Spidr codebase for structural changes since AGENTS.md was last updated — new routes, models, pages, components, dependencies, and architecture shifts — then rewrite AGENTS.md to reflect the current real state of the project. Trigger whenever the user says \"/spidr-update\", \"update the spidr system\", \"sync AGENTS.md\", \"refresh docs\", or any variation of keeping the project documentation current."
---

# source-command-spidr-update

Use this skill when the user asks to run the migrated source command `spidr-update`.

## Command Template

# Spidr System Update

You are auditing the Spidr monorepo and rewriting `AGENTS.md` to reflect its **current real state**. Do not rely on what AGENTS.md already says — verify everything by reading the actual files.

## Step 1 — Gather recent changes

Run these in parallel:

```bash
git log --oneline -20
git diff HEAD~5 --name-only
```

Skim the commit history to understand what areas have changed lately (new features, removed files, refactors). This tells you where to focus the audit.

## Step 2 — Audit each section of AGENTS.md

Work through every section and verify the claims against the real codebase. Check in parallel where possible.

### Stack
- Read `spidr-client/package.json` → verify React, Vite, Electron, Tailwind, Radix versions and any new major dependencies.
- Read `spidr-server/package.json` → verify Express, Mongoose, Socket.io versions and any added packages.
- Read `spidr-auth/pom.xml` → confirm Spring Boot version and any new starters.
- Note any **new** libraries (AI SDKs, payment libs, analytics, new UI component systems) — these need to be added to the Stack section.

### Repo Layout
- Run `ls` (or equivalent) at the monorepo root to check for new top-level directories or packages.
- Check if `spidr-landing/` or any other new service has been added.
- Check if `FIXME.md`, `DEPLOY.md`, `HOW-TO-RUN.md` still exist.

### Routes (spidr-server)
- Count files in `spidr-server/src/routes/` — AGENTS.md claims 28. Update the number if it has changed.
- Skim new route files for any architectural pattern changes (e.g., new auth middleware, WebSocket upgrades).

### Models (spidr-server)
- Count files in `spidr-server/src/models/` — AGENTS.md claims 23. Update the number if it has changed.
- Note any newly added or removed models that represent significant feature additions (e.g., a new `Subscription` model means billing was added).

### Pages (spidr-client)
- List files in `spidr-client/src/pages/` and check `spidr-client/src/pages.config.js`.
- Note any pages added or removed since the last known state.

### Component Organization
- List first-level subdirectories of `spidr-client/src/components/`.
- Check if any **new** component subdirectories have been added (e.g., a new `settings/`, `marketplace/`, `billing/` folder signals a major feature).
- Check `spidr-client/src/components/spidr/` for significant new components not already listed.
- Check `spidr-client/src/components/feed/` and `spidr-client/src/components/nexus/` for notable additions.

### API Client
- Read `spidr-client/src/api/apiClient.js` — verify the exported shape, check for any new entity namespaces or new auth methods added since the last update.

### Authentication Flow
- Skim `spidr-client/src/components/AuthContext.jsx` for state changes or new flow steps.
- Check if TOTP 2FA (`/auth/setup-totp`) has been migrated to Spring Boot yet (AUTH-F3 in FIXME.md).

### Electron
- Read `electron/main.js` briefly — verify IPC channel names and any new window management logic.
- Check `electron/preload.js` for new APIs exposed on `window.electronAPI`.

### Backend
- Check `spidr-server/src/socket/handlers.js` exists (and note if a major new socket event namespace was added).
- Check `spidr-server/src/utils/` for new utilities (the file storage util may have moved or been renamed).

### Deployed Infrastructure
- Check if any new Railway services, Cloudflare Workers, or third-party service integrations appear in env files or configs.
- Read `.env.example` in `spidr-server/` for any new required env vars not listed in AGENTS.md.

### Commands / Scripts
- Check `spidr-client/package.json` `scripts` — note any new npm scripts not already documented.
- Check `spidr-server/package.json` `scripts` similarly.

## Step 3 — Write the updated AGENTS.md

After completing the audit, rewrite `AGENTS.md` in full. Rules:

1. **Preserve all sections** from the current AGENTS.md unless a section is fully obsolete.
2. **Update counts** (routes, models) to match what you actually counted.
3. **Add new components/pages/routes** discovered in the audit to the relevant sections.
4. **Add new stack entries** for any new major libraries found in package.json/pom.xml.
5. **Add new env vars** found in `.env.example` to the Environment Setup section.
6. **Add new npm scripts** found in package.json to the Commands section.
7. **Keep the tone and style** of the existing AGENTS.md — terse, factual, no fluff.
8. **Do not invent** — if you didn't verify something, don't change it. Only update what you confirmed.
9. After writing, show the user a short **diff summary**: what changed and why (e.g., "Routes: 28→31 (added payments, webhooks, analytics). New component dir: `src/components/billing/`").

## Rules

- Never remove infrastructure or environment variable documentation without confirming the service was actually decommissioned.
- If you find a FIXME.md entry that has been resolved (the code exists and the feature is live), note it in the diff summary so the user can remove it from FIXME.md manually.
- Do not modify any file other than `AGENTS.md` unless the user explicitly asks.
- If you can't verify a claim (e.g., a file is too large to read fully), keep the existing AGENTS.md text for that section and flag it as "unverified" in the diff summary.
