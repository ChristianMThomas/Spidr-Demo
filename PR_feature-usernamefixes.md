# PR: Fix username display — stop leaking email addresses as display names

**Branch:** `feature-usernamefixes` → `dev`

## Problem

User-facing display names across the app were falling back to `currentUser.email` when no `full_name` was set. This exposed private email addresses in:

- Chat messages (`sender_name` stored in the database)
- Friend request payloads (`friend_name`)
- Voice session rosters (`user_name`)
- Server audit logs (`actor_name`)
- Comments, reports, bots, modules, and more

The root cause: the display name fallback chain was:
```
display_name → full_name → email         ← (broken)
display_name → full_name → username      ← (fixed)
```

`auth.me()` from Spring Boot already returns a `username` field guaranteed to be present for every user — it just wasn't being used as the fallback.

## Changes

### 20 client files updated

Every occurrence of `currentUser?.full_name || currentUser?.email` (and the non-optional-chaining variant) was replaced with `currentUser?.full_name || currentUser?.username`.

`email?.split('@')[0]` fallbacks were also removed in favour of `username`.

| File | Fields fixed |
|---|---|
| `DirectMessages.jsx` | `sender_name`, `user_name`, typing `userName` |
| `KineticChat.jsx` | `sender_name`, `user_name`, `author_name` |
| `ServersPanel.jsx` | `user_name`, `author_name`, `actor_name`, `friend_name` |
| `ServerSettingsModal.jsx` | `actor_name` (5 audit log events) |
| `FriendsPanel.jsx` | Outgoing `friend_name`, success toast |
| `RichComments.jsx` | `user_name`, `author_name` |
| `AIPanel.jsx` | Group chat member `user_name` |
| `CreateGroupChatModal.jsx` | Member `user_name` |
| `CreateServerModal.jsx` | Founding member `user_name` |
| `ReportModal.jsx` | `reporter_name` |
| `ImportBotTab.jsx` | `author_name` |
| `MyBotsTab.jsx` | `author_name` |
| `ShareWeb.jsx` | DM `sender_name` |
| `VoiceChannel.jsx` | Voice session `user_name` |
| `useWebRTC.js` | WebRTC socket `userName` |
| `VideoStudio.jsx` | Clip `author_name` |
| `ModuleFabricator.jsx` | Module `author_name` |
| `gifs/Fabricator.jsx` | GIF `author_name` |
| `UserProfilePod.jsx` | Display name + auto-profile seed |
| `feed/WebProfile.jsx` | Feed profile display name |


## Notes

- `username` is required and unique at registration (enforced by Spring Boot) — it is always present on `currentUser`.
- Denormalized `sender_name` / `author_name` fields already stored in MongoDB with email values will not be retroactively updated; only new records written after this deploy will use `username`.
- No backend changes were needed.
