# Handoff

## Goal
Make DM unread counts visible and Discord-style clearable on the Spidr mobile app so users know when someone has messaged them.

## Current State
DM unread counts are fixed on mobile. The root bug was a client/server endpoint mismatch that made `markConversationRead` 404, so opening a DM never cleared the badge. Count is now surfaced in three visible places (home Friends tile, friends-tab bottom-nav badge, RECENTS avatar overlay) and clears on DM open. Live socket updates already worked; added AppState refetch for backgrounded arrivals. Not yet tested on a physical device — needs an EAS dev build or Expo Go run to confirm end-to-end.

## Files
- spidr-client/mobile/lib/unreadContext.tsx      — fixed mark-read endpoint, added AppState refetch
- spidr-client/mobile/app/(tabs)/friends.tsx     — SpidrWebHead unread badge + unread-first sort in RECENTS
- spidr-client/mobile/app/(tabs)/index.tsx       — StatTile badge prop + Friends tile shows unreadTotal
- spidr-client/mobile/app/(tabs)/_layout.tsx     — cast bottom-tab badge value to string

## Changes
- Fix `/direct-messages/mark-conversation-read` → `/direct-messages/read-conversation` in `unreadContext.tsx` so opening a DM actually clears the badge (server route is `/read-conversation`).
- Add `AppState` `change → active` listener that invalidates the `unread-dms` query, so DMs that arrive while the app is backgrounded bump the badge on foreground.
- Add optional `unread` prop to `SpidrWebHead` with a red count badge overlay on the avatar.
- Re-sort friends `webHeads` unread-first so DM'd friends bubble to the front of the RECENTS strip.
- Add optional `badge` prop to home `StatTile` and wire `useUnread().total` into the Friends tile.
- Coerce Friends tab-bar `tabBarBadge` value to a string for cross-platform safety.

## Failed
None this session.

## Next Step
Run the mobile app (Expo Go or EAS dev build) with two accounts and verify: (a) unread count appears on home Friends tile, tab badge, RECENTS avatar, and per-friend row when a DM arrives; (b) opening the DM clears all four immediately.
