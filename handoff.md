# Handoff

## Goal
Keep the Spidr friends flow bidirectional and per-user localStorage isolated so shared browsers don't cross-leak state — ship as Patch 1.9.66.

## Current State
Patch 1.9.66 shipped. Committed `ce9fc6e` on `dev` and pushed to `origin/dev`. Security audit was clean (0 critical / 0 high / 0 medium, 2 informational). SPIDR_SYS server `NEWS` and client `MOCK_NEWS` are in lockstep for `p1966`.

## Files
- spidr-server/src/routes/friends.js — added mirror backfill in PATCH `/:id` (accept) + dedicated DELETE `/:id` that wipes both sides atomically, skipping `blocked` mirrors
- spidr-server/scripts/fix-stuck-friend-requests.js — added orphan-accepted-mirror backfill and ghost pending_incoming cleanup passes
- spidr-server/scripts/_inspect-user.js — new dev spot-check utility (queries User/UserProfile/Friend rows by username/full_name)
- spidr-client/src/lib/spidrWebPins.js — rewrote around per-user scoped key `spidr_web_pins:<uid>`; `setCurrentUser` / `clearCurrentUser` / `hydratePins(uid)` API; legacy `spidr_web_pins` key purged on first use
- spidr-client/src/lib/AuthContext.jsx — wired `setCurrentUser` on boot/login/verify/register, `clearCurrentUser` on logout + auth-expired, `hydratePins(uid)` after `auth.me()`
- spidr-client/src/components/spidr/FriendsPanel.jsx — pinned groups now use per-user key `spidr_pinned_groups:<uid>` with legacy key purge
- spidr-server/src/routes/system.js — inserted `p1966` at index 0 of `NEWS`
- spidr-client/src/components/spidr/SpidrSystem.jsx — inserted `p1966` at index 0 of `MOCK_NEWS` (byte-identical to server)

## Changes
- Backfill missing mirror row on friend-request accept so accepter's list is no longer one-sided when the original request never mirrored
- Add dedicated DELETE `/friends/:id` doing a mutual unfriend (both sides), preserving the other side if they've independently set `blocked`
- Extend fix-stuck-friend-requests.js with orphan-accepted backfill + ghost pending_incoming cleanup for legacy rows
- Scope `spidrWebPins` and `FriendsPanel` pinned-groups localStorage to per-user keys with legacy-key purge; wire lifecycle through AuthContext
- Log Patch 1.9.66 in both SPIDR_SYS sources of truth
- Ran /ship: security-cleanup (clean) → /patch (p1966) → /git-workflow (commit + push)

## Failed
None.

## Next Step
Run `node spidr-server/scripts/fix-stuck-friend-requests.js --apply` against production once the deploy is live so legacy orphan accepted mirrors and ghost pending_incoming rows get healed for existing users.
