# FIXME.md — Spidr App Bug List

Last audited: 2026-03-04

---

## PRIORITY 1 — CRITICAL (App-Breaking / Invisible UI) ✅ FIXED 2026-03-06

### ~~[P1-A] React Query v5 invalidateQueries — broken across entire app~~

**Root cause:** React Query v5 changed the `invalidateQueries` API. The old array syntax
`queryClient.invalidateQueries(['key'])` silently does nothing in v5. Every mutation that
calls this will succeed (record IS created/updated in Base44) but the UI never re-fetches.

**Required fix:** Replace every occurrence with the object form:
```js
// BROKEN (v4 syntax — silently no-ops in v5)
queryClient.invalidateQueries(['servers'])

// CORRECT (v5 syntax)
queryClient.invalidateQueries({ queryKey: ['servers'] })
```

**Key files affected (50+ locations):**
- `src/components/spidr/CreateServerModal.jsx:47`
- `src/components/spidr/CreateGroupChatModal.jsx:34`
- `src/components/spidr/SettingsPanel.jsx:100-102`
- `src/components/spidr/BotLaboratory.jsx`
- `src/components/nexus/ImportBotTab.jsx:75`
- `src/views/GlobalReports.jsx:53,73`
- `src/components/nexus/widgets/AudioDatabase.jsx:72`
- `src/components/nexus/widgets/FrequencyArchive.jsx:40-41`
- `src/components/spidr/AIPanel.jsx:133`
- `src/components/spidr/ActiveCallTether.jsx:39`
- And ~40 more across the codebase — do a global search for `invalidateQueries([`

---

### ~~[P1-B] UserProfilePod — invisible for new users (no profile record yet)~~

**File:** `src/components/spidr/UserProfilePod.jsx:55`

**Bug:** `if (!currentUser || !profile) return null`

- If the user has no `UserProfile` entity record yet (new account), the pod is permanently
  invisible — no loading state, no fallback, no auto-creation triggered.
- Also: while either query is still loading, the pod hides entirely.

**Fix needed:**
1. Show a skeleton/loading state while queries are in-flight
2. Auto-create a `UserProfile` record on first load if none exists

---

### ~~[P1-C] SystemArchive.jsx — lodash import crash on GifsEmojis page~~

**File:** `src/components/gifs/SystemArchive.jsx:6`

```js
import { debounce } from 'lodash'  // lodash is NOT in package.json
```

`lodash` was removed during the Vite → Next.js migration. This throws a runtime module
resolution error when the `/GifsEmojis` page loads, crashing the entire page.

**Fix:** Replace with a native debounce using `useRef` + `setTimeout`:
```js
const debounceRef = useRef(null);
const debouncedSearch = (value) => {
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => doSearch(value), 300);
};
```

---

### ~~[P1-D] CreateServerModal — "Failed to generate server" (no UI feedback)~~

**File:** `src/components/spidr/CreateServerModal.jsx:47`

Two issues:
1. Uses broken `invalidateQueries(['servers'])` syntax (see P1-A) — server IS created but
   list never refreshes, making it appear broken.
2. `onError` handler is missing from `createServerMutation` — user gets no toast or
   message on actual failure; they see a spinner that just stops.

**Fix:** Update invalidateQueries + add `onError: (err) => toast.error(err.message)`.

---

## PRIORITY 2 — HIGH (Feature Completely Non-Functional)

### [P2-A] Settings: Sound & Notification toggles — UI-only, not persisted

**File:** `src/components/spidr/SettingsPanel.jsx:443-539`

All sound and notification toggle `<Switch>` components update local React state only.
No `UserProfile.update()` or `base44.auth.updateMe()` call is made. Settings reset to
defaults on every page reload.

Affected settings: `sound_enabled`, `notification_preferences`, `message_preview`, etc.

**Fix:** On each toggle change, call `UserProfile.update(profileId, { field: value })`.

---

### [P2-B] Background / Theme Customization — not persisted

**File:** `src/views/Home.jsx` (ThemeStudio state)

`appTheme` state lives only in `Home.jsx` component-level state. Choosing a background
or theme is lost on every refresh. No write to `UserProfile` or `base44.auth.updateMe()`.

**Fix:** On theme save, persist to a `UserProfile` field (e.g., `theme` or `background`).
On load, read that field to rehydrate the theme.

---

### [P2-C] Discord Bot Import — shows official Discord bots, not user bots

**File:** `src/components/nexus/ImportBotTab.jsx:10-18`

The "Popular Discord Bots" catalog hardcodes MEE6, Dyno, Rythm, etc. — bots the user
does not own and cannot import. This is the wrong UX; users need to import their **own**
custom bots via a Client ID / token flow.

**Fix:** Remove the official bot catalog section entirely. Keep only the manual
"Import by Client ID" form.

---

### [P2-D] Group Chats — creation appears broken (list never refreshes)

**File:** `src/components/spidr/CreateGroupChatModal.jsx:34`

Direct consequence of P1-A. Group chat IS created in Base44 but
`invalidateQueries(['group-chats'])` silently fails. User sees an empty list and
thinks creation failed.

**Fix:** Update to `{ queryKey: ['group-chats'] }` syntax.

---

### [P2-E] Neural Links / Connections tab — verify `updateMe` API exists

**File:** `src/components/spidr/NeuralConfig.jsx`

Code calls `base44.auth.updateMe({ neural_links: ... })`. The Base44 SDK's `auth` object
may not expose `updateMe` as a public method. If it doesn't exist, all connection saves
fail silently.

**Action needed:** Verify `base44.auth.updateMe` exists in the SDK. If not, switch to
`base44.entities.UserProfile.update(profileId, { neural_links: ... })`.

---

### [P2-F] SpidrAIChat — verify Base44 LLM integration is configured

**File:** `src/components/spidr/SpidrAIChat.jsx:20`

Calls `base44.integrations.Core.InvokeLLM(...)`. This requires the LLM integration to be
explicitly enabled in the Base44 app dashboard. If not configured, calls fail with no
user-visible error (only success toast exists; no `onError` toast).

**Fix:**
1. Verify LLM integration is enabled in Base44 dashboard.
2. Add `onError` toast: `toast.error('AI unavailable: ' + err.message)`.
3. (Low priority) Make system prompt configurable via Base44 app settings.

---

## PRIORITY 3 — MEDIUM (Feature Partially Working / Degraded UX)

### [P3-A] Upload Clip — thumbnail generation produces black frame

**File:** `src/components/spidr/VideoStudio.jsx:144`

Canvas draws from the video element without checking `readyState >= 2`
(HAVE_CURRENT_DATA). If the video hasn't buffered a frame yet, the canvas captures a
blank/black image.

**Fix:** Wait for the `loadeddata` event before calling `drawImage`, and check
`video.readyState >= 2`.

---

### [P3-B] CinemaStage — SSR violation + stale object URL

**File:** `src/components/spidr/CinemaStage.jsx:22`

`window.location.hostname` is accessed directly (not inside a function or effect). While
all pages are `'use client'`, this is still a bad practice that could cause issues.

Also: `URL.createObjectURL` in `VideoStudio.jsx:90-92` can go stale if a video file
changes quickly (old URL not revoked, new URL not assigned).

**Fix:** Wrap `window.location.hostname` in `typeof window !== 'undefined'` guard.
Add `URL.revokeObjectURL` cleanup in the effect that creates the object URL.

---

### [P3-C] UserProfile query key inconsistency — stale data across views

Multiple components query `UserProfile` with different cache keys:
- `['userProfile', id]`
- `['profile', id]`
- `['user-profile', id]`

Each key creates a separate React Query cache entry, causing different profile views to
show different (potentially stale) data for the same user.

**Affected files:** `HolographicProfile.jsx`, `PCSpecsFlex.jsx`, `UserProfilePod.jsx`,
and others.

**Fix:** Standardize all `UserProfile` query keys to `['userProfile', userId]`.

---

### [P3-D] Mic / Deafen toggles in UserProfilePod — UI-only

**File:** `src/components/spidr/UserProfilePod.jsx:163-172`

Mic mute and deafen buttons update local component state only. They are not wired to
`getUserMedia`, any WebRTC stream, or `VoiceChannel` state. Clicking them has no
real audio effect.

**Fix:** Connect pod mic/deafen state to a shared audio context or the active
`VoiceChannel` component's stream controls.

---

### [P3-E] 2FA setup is mock/demo only

**File:** `src/components/spidr/SecurityMatrix.jsx:73-74`

The QR code generates an `otpauth://` URL with a randomly generated mock secret. No
secret is stored to the backend. When the user "verifies" the code, no real TOTP
validation occurs — any input is accepted.

The 2FA prompt at login may be the Base44 platform's own auth requirement (not
controllable from this codebase).

**Action needed:**
1. Investigate whether the login-time 2FA prompt is Base44-level or app-level.
2. Either implement real TOTP (store secret in `UserProfile`, validate server-side)
   or remove the UI and document that 2FA is handled by Base44 auth.

---

### [P3-F] DynamicModuleWidget — silent JSON parse failures + fake weather data

**File:** `src/components/nexus/DynamicModuleWidget.jsx:36,230`

1. Line 36: JSON parse errors are caught and result in a `{ raw: '...' }` object. This
   breaks typed widget renderers downstream without any visible error.
2. Line 230: Weather widget calls `base44.integrations.Core.InvokeLLM` to generate
   *fake* weather data (not a real weather API).

Also: `GamingUplink.jsx` and `AudioResonance.jsx` render fully hardcoded static content
with no Base44 entity data.

**Fix:**
1. Log parse errors and render an error state instead of a `{ raw }` fallback.
2. Replace fake LLM weather with a real weather API or remove the widget.
3. Connect gaming/audio widgets to Base44 data entities.

---

### [P3-G] Bot Laboratory — installations not persisted

**File:** `src/components/spidr/BotLaboratory.jsx:88-90`

```js
setInstalledBots(prev => new Set([...prev, botId]))
```

Bot installations are stored in local React state only. Clearing or refreshing the page
resets the installed bots list. No `base44.entities.BotInstallation.create()` call.

**Fix:** On install, write to a `BotInstallation` Base44 entity. On load, query and
hydrate `installedBots` from that entity.

---

## PRIORITY 4 — LOW (Polish / Non-Critical)

### [P4-A] CinemaStage chat — static stub

Chat section in `CinemaStage` shows one hardcoded message. No real Base44 entity
integration. Should connect to a `ChannelMessage` or `ChatMessage` entity scoped to the
active cinema room.

---

### [P4-B] SpidrAIChat — hardcoded system prompt

System prompt is baked directly into the component. Should be read from a Base44 app
setting or `UserProfile` field so it can be customized per user or per deployment.

---

### [P4-C] PCSpecsFlex widget — non-standard query key

Uses `['user-profile', userId]` while the standard (post P3-C fix) should be
`['userProfile', userId]`. Part of the P3-C standardization effort.

**File:** `src/components/nexus/widgets/PCSpecsFlex.jsx`

---

### [P4-D] SettingsPanel — missing cache invalidation after profile updates

Several `UserProfile.update()` mutation calls in `SettingsPanel.jsx` have no
`onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userProfile', userId] })`
handler. Profile data shown elsewhere in the UI can go stale after saving settings.

---

### [P4-E] CreateServerModal — banner has no file upload

**File:** `src/components/spidr/CreateServerModal.jsx`

Server icon has a file upload button. Server banner accepts only a pasted URL string.
Inconsistent UX — both should support file upload with drag-and-drop or a file picker.

---

## Quick Reference: High-Impact One-Liners

| ID | File | Issue Summary |
|----|------|---------------|
| P1-A | 50+ files | `invalidateQueries(['x'])` → `{ queryKey: ['x'] }` |
| P1-B | `UserProfilePod.jsx:55` | `return null` when no profile — show skeleton instead |
| P1-C | `SystemArchive.jsx:6` | `import { debounce } from 'lodash'` — lodash removed |
| P1-D | `CreateServerModal.jsx:47` | No onError handler + broken invalidateQueries |
| P2-A | `SettingsPanel.jsx:443-539` | Sound/notification toggles not persisted |
| P2-B | `Home.jsx` | Theme state lost on refresh |
| P2-C | `ImportBotTab.jsx:10-18` | Remove official Discord bot catalog |
| P2-D | `CreateGroupChatModal.jsx:34` | invalidateQueries broken → list never refreshes |
| P2-E | `NeuralConfig.jsx` | Verify `base44.auth.updateMe` exists in SDK |
| P2-F | `SpidrAIChat.jsx:20` | Missing onError + verify LLM integration enabled |
| P3-A | `VideoStudio.jsx:144` | Thumbnail black — drawImage before video buffers |
| P3-C | Multiple | Inconsistent UserProfile query keys → stale cache |
| P3-G | `BotLaboratory.jsx:88` | Bot installs lost on refresh — save to Base44 |
