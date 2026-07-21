# Handoff

## Goal
Purge deleted/orphaned users from Server documents (parity with the existing Friend / DM / Activity orphan cleanup) so ghost members stop appearing in Electron server sidebars, and produce a whole-project inventory of hardcoded emojis / vibe-coded symbols across web, electron, and mobile.

## Current State
Server orphan-purge is complete and live-tested — `sweepOrphans` extended and the servers list/get routes now prune ghost members on read. One-time sweep against production Mongo removed 4 friends, 81 DMs, 4 group members, 2 ghost server members, and 1 owner-less server. Nothing shipped (no commit); changes are staged in working tree only. `unvibecode.md` written at repo root with per-file symbol inventory across all three platforms.

## Files
- `spidr-server/src/routes/accountAdmin.js` — `sweepOrphans` now prunes `Server.members[]`, `Server.banned_users[]`, deletes owner-less servers
- `spidr-server/src/routes/servers.js` — added `pruneGhostMembers` util, overrode GET `/` and GET `/:id` with live orphan filtering (mounted before `crudRouter`)
- `spidr-server/scripts/sweep-orphans.js` — untracked; existing script, unchanged this session
- `spidr-server/src/utils/filterExistingUsers.js` — untracked; existing helper, unchanged this session
- `unvibecode.md` — new file at repo root; full emoji inventory
- (untouched by this session but showing in `git status`: `GAPS.md`, `mr-rimmer/*`, `spidr-client/src/components/*`, `spidr-server/src/index.js`, `routes/auth.js`, `directMessages.js`, `friends.js`, `dist_installer/`)

## Changes
- Extended `sweepOrphans` in `accountAdmin.js` with Server pruning (members, banned_users, owner-less server deletion) — idempotent, matches the pattern used for Friend/DM/GroupChat
- Added `pruneGhostMembers(servers)` helper in `servers.js`: single User query, filters `members[]` and `banned_users[]` in-place — one round-trip per request
- Wired `pruneGhostMembers` into `GET /servers` and `GET /servers/:id` (overrides crudRouter's GET handlers, kept before the `router.use('/', crudRouter(...))` mount)
- Ran `node scripts/sweep-orphans.js` against prod DB — result: Friend 4, DirectMessage 81, GroupChatMessage 0, GroupChatMembers 4, ServerMembers 2, ServerBans 0, Server 1
- Wrote `unvibecode.md`: 56 web-src files, 2 electron shell files, 8 mobile app routes + 3 components + 1 lib file, grouped by page/component with symbol counts, cross-platform lockstep pairs, ranked replacement targets (SpidrBotEngine.jsx tops at 60+ emojis)

## Failed
None.

## Next Step
Commit the server-side orphan cleanup — `spidr-server/src/routes/accountAdmin.js` and `spidr-server/src/routes/servers.js` — via `/ship` (or `/git-workflow` if skipping the security audit) so the Electron client hits the pruned reads in prod. `unvibecode.md` is doc-only and can ship in the same or a separate push.
