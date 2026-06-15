# Spidr — "Sonic Uplink" Listening-To & Audio-Sync Implementation Plan

A phased blueprint for a Discord-style "Listening To" presence feature plus a synced "Jam Session" / Spidr DJ mode, built around Spidr's real stack (React/Vite client, Node/Express/Mongoose, MongoDB, Socket.io, Electron wrapper, P2P WebRTC mesh, Render.com, JWT auth).

---

## 0. Read this first — the two platform walls

Everything below is shaped by two non-negotiable Spotify constraints (verified June 2026):

**Wall A — the quota cap.** A Spotify app in *development mode* now serves **5 allowlisted users max**, and the dev account must be Premium. Going past 5 requires *extended quota*: registered business + launched service + 250k MAU + organization-only application. There is no graceful ramp. **A pre-launch Spidr cannot legally serve Spotify-API data to more than 5 users.**

**Wall B — Premium-gated control.** Reading what someone is playing (metadata) does **not** require the listener to be Premium. But *controlling/streaming* playback — the actual "Sync Audio" and DJ playback — requires **full Spotify Premium on both ends** (the host being listened to, and the listener). Lite/Mini don't qualify.

There are also three Spotify ToS clauses that specifically threaten the most ambitious visuals:
- "may not synchronize any sound recordings with any visual media… video, or similar content" — relevant to the bass-reactive DJ grid / orbiting avatars if it reads as audio→visual sync.
- "can not be used for non-interactive broadcasting" — relevant to one DJ broadcasting to a passive room.
- "can not be used to develop commercial streaming integrations."

**Consequence:** the *display* feature is safe and unlimited if we get it from the OS, not Spotify. The *audio-sync* feature is Premium-only, low-user-count, and ToS-sensitive. We design so the product degrades gracefully across these tiers instead of betting the whole feature on Spotify API access.

---

## 1. The architecture that gets around the walls

### Provider-agnostic presence layer
Don't model this as "Spotify presence." Model it as **NowPlaying presence** with a `source` field. Spotify is one source; the OS media session is another; a manual "set status" is a third. The roster pulse and Sonic Card render identically regardless of source.

### Three feature tiers (graceful degradation)

| Tier | What the user sees | Data source | Premium? | User cap |
|------|--------------------|-------------|----------|----------|
| **T1 — Display** | Roster equalizer pulse + Sonic Card (art, title, live scrubber) | **Electron OS media session** (Win SMTC / macOS MediaRemote) | No | Unlimited |
| **T1+ — Display (enriched)** | Same, plus canonical Spotify links/IDs, color-extracted glow | Spotify Web API (`/me/player/currently-playing`) | No | ≤5 (dev) |
| **T2 — Soft sync** | "Open in Spotify" / deep-link to the exact track at ~position | `spotify:track:` URI / `open.spotify.com` link | No | Unlimited |
| **T3 — True sync** | "SYNCED" — listener's audio actually plays in lockstep | Web Playback SDK or Connect `PUT /me/player/play` | **Yes, both ends** | ≤5 (dev) |
| **T4 — Spidr DJ** | Shared conductor-driven room playback | Web Playback SDK per listener, server as conductor | **Yes, everyone** | ≤5 (dev) |

**Recommendation:** ship T1 (OS-based) as the real product. It's the genuine Discord-"Listening to" equivalent, works for everyone, and needs zero Spotify approval. Treat T1+/T2 as enrichment for the ≤5 allowlist (and your own dogfooding). Treat T3/T4 as a flagged, Premium-only "Pro" experience you build once you either have extended quota or accept the 5-user demo ceiling.

### Why OS media session is the unlock
Because Spidr ships as Electron, the **main process** can subscribe to the OS "now playing" feed:
- **Windows:** `GlobalSystemMediaTransportControlsSessionManager` (WinRT). Native bridge via a module like `node-nowplaying` / NodeRT / koffi. Gives title, artist, album, thumbnail bytes, timeline (position + duration), play/pause state, and emits on change.
- **macOS:** historically `MediaRemote.framework` (`MRMediaRemoteGetNowPlayingInfo`). **Caveat: Apple restricted MediaRemote for non-entitled apps in recent macOS versions — verify against your target macOS before committing; a small bundled Swift helper or an npm wrapper (`media-control`) may be needed, and it may break across OS updates.**

This is provider-agnostic (captures Spotify, Apple Music, browser audio, etc.), needs no OAuth, and has no user cap. The trade-off: no canonical Spotify track ID unless you also do T1+, so the "Open in Spotify" deep-link is best-effort (search-by-title) rather than exact unless enriched.

---

## 2. Data model (Mongoose)

### UserProfile additions
```
nowPlaying: {
  isPlaying:   Boolean,
  source:      String,          // 'os' | 'spotify' | 'manual'
  provider:    String,          // 'spotify' | 'apple_music' | 'other'
  trackName:   String,
  artists:     [String],
  albumArt:    String,          // URL or cached blob ref (Azure)
  trackUri:    String,          // 'spotify:track:...' when known (enables T2)
  durationMs:  Number,
  positionMs:  Number,          // snapshot
  positionAt:  Date,            // server time the snapshot was taken (for extrapolation)
  accentColor: String,          // extracted dominant color for the glow
  updatedAt:   Date
}

spotifyAuth: {                  // only for T1+/T2/T3 users on the allowlist
  accessToken:  String,         // ENCRYPTED at rest
  refreshToken: String,         // ENCRYPTED at rest
  expiresAt:    Date,
  scopes:       [String],
  product:      String          // 'premium' | 'free' | ... gates T3/T4
}
```
- Never send tokens to the client. Tokens live server-side; client only ever sees `nowPlaying`.
- Extrapolate live position on the client from `positionMs + (now - positionAt)` so the scrubber moves smoothly between updates instead of jumping each poll.

### Jam / DJ session doc (T3/T4)
```
JamSession {
  hostId, roomId, sessionType: 'jam' | 'dj',
  current: { trackUri, positionMs, positionAt, isPlaying },
  participants: [{ userId, synced: Boolean, localVolume: Number }],
  createdAt, endedAt
}
```

---

## 3. Real-time flow (Socket.io)

Keep it on the existing Socket.io layer; this is presence, not media, so it does **not** touch the P2P WebRTC mesh.

**Capture → normalize → broadcast:**
1. **Source emits a change.**
   - T1: Electron main process media-session listener fires → IPC to renderer → client emits `nowplaying:update` to server.
   - T1+: server-side poller hits Spotify `/me/player/currently-playing` per allowlisted user on a backoff cadence (active listener ~every 5s; idle backs off to 30s+; respect 429 `Retry-After`).
2. **Server normalizes** into the `nowPlaying` shape, extracts `accentColor` (server-side color quantization of album art, cached so it's computed once per track), persists to UserProfile, and **broadcasts `presence:nowplaying` only to that user's friends / shared-room members** (not globally — scope to relationship/room to limit fan-out and respect privacy).
3. **Clients update** the roster pulse + any open Sonic Card.

**Patterns to carry over from existing Spidr work:**
- **Dedup participants by `user_id`** in Jam/DJ rosters (same bug class you already fixed in voice sessions).
- **Null-guard** `nowPlaying.trackName` / `msg.content`-style fields before any string ops.
- Drive UI state from context (`AppShellContext`), not local component state — mirror how `inCall` is derived from `voiceSession`, so a minimized pill and the full card never desync.
- Broadcast a `spidr-nowplaying-state` event on any toggle so a minimized "now playing" pill stays in sync, exactly like `spidr-call-state`.

**Privacy:** add a per-user toggle ("Broadcast my listening activity") in Appearance/Privacy settings. Default it **off** until the user opts in — listening data is sensitive and some users won't want it visible.

---

## 4. Phased build, mapped to the blueprint and real files

### Phase 0 — Presence plumbing (no UI)
- Add `nowPlaying` to UserProfile + the normalize/persist/broadcast path on the server.
- New Socket.io events: `nowplaying:update` (in), `presence:nowplaying` (out, room/friend-scoped).
- Client-side `NowPlayingContext` (or fold into `AppShellContext`) holding a `Map<userId, nowPlaying>` with smooth position extrapolation.

### Phase 1 — Tier 1 display (the real shippable feature)
**Blueprint Part 1 (Roster Pulse):**
- Component: small `<SonicPulse>` — the animated 3-bar equalizer in Spotify green `#1DB954`. Drop it into the member roster rows in **`CommunityPanel`**, **`FriendsPanel`**, **`DMsSidebar`** (the same components that already host `NameplateBackground`). Render only when that user's `nowPlaying.isPlaying`.
- Use the existing `eq-bar` keyframes from your `gemini-code-1781313647808.html` mockup — they're already on-brand.

**Blueprint Part 2 (Sonic Card):**
- Component: `<SonicCard>` rendered in the profile popover / expanded member view.
- Frosted-glass pill (`backdrop-blur-2xl bg-[#050505]/80 border border-white/5`), album art left with a **dynamic glow** driven by `accentColor` (`box-shadow` using the server-extracted color), live scrubber bound to extrapolated `positionMs/durationMs`, equalizer header.
- **Electron side:** main-process media-session listener (Windows SMTC first; macOS behind a capability check with the verify-caveat above) → IPC → `nowplaying:update`.
- Brand note: keep Spotify green + the Spotify wordmark on Spotify-attributed elements (Spotify's brand guidelines require their logo, no recoloring, and attribution/link-back); let Spidr's red/purple own the surrounding chrome.

*Exit criteria for Phase 1: any number of Spidr users see each other's real now-playing with a live scrubber, with zero Spotify API dependency.*

### Phase 2 — Spotify OAuth + Tier 1+ enrichment + Tier 2 soft-sync
- **Production OAuth, not the localhost tutorial.** The Medium guide's `localhost:8888` example-server flow is dev-only. For Spidr: implement Authorization Code **with PKCE**, redirect URI = a real Spidr backend route on Render (e.g. `https://api.spidrapp.com/auth/spotify/callback`), and **fold the resulting Spotify tokens into the existing JWT-authenticated user**, not a separate session. Store encrypted tokens on `spotifyAuth`, refresh on expiry (tokens last 1h).
- Scopes: `user-read-currently-playing user-read-playback-state user-read-private` (add `streaming user-modify-playback-state` only for T3 users).
- Server-side poller for allowlisted users enriches `nowPlaying` with canonical `trackUri` + cleaner art.
- **Tier 2 soft-sync:** wire the blueprint's **SYNC AUDIO** button. For non-Premium / non-synced users it becomes "Open in Spotify" → deep-links `spotify:track:<id>` (or `open.spotify.com`) so they jump to the exact track in their own client. Zero friction, unlimited users, no SDK.
- **Reconcile to the 5-user reality:** gate the whole OAuth/poller path behind an allowlist + a feature flag. Build the business-entity registration now if you intend to pursue extended quota later, but don't make T1 depend on it.

### Phase 3 — Tier 3 true sync (Premium "SYNCED" state)
- Gate on `spotifyAuth.product === 'premium'` for **both** host and listener; otherwise the button stays in Tier-2 soft-sync mode.
- **Electron + DRM:** the Web Playback SDK plays DRM-protected (Widevine/EME) audio. Stock Electron ships **without** Widevine — you'll need the **castlabs `electron-releases` fork with Widevine + VMP signing**, or route playback to the user's existing Spotify Connect device via `PUT /me/player/play` (`uris` + `position_ms`) instead of an in-app player. **Decide early**, because Widevine changes your Electron build/`electron-builder` pipeline. *(Verify current Widevine availability for your Electron version.)*
- Sync mechanic: server sends `current.trackUri + positionMs + positionAt`; listener seeks to `positionMs + (now - positionAt)`; re-nudge on drift. Button → pulsing "SYNCED"; mirror the host's equalizer locally (decorative).

### Phase 4 — Spidr DJ Matrix (highest complexity + ToS risk)
- **Server = conductor.** One `JamSession{type:'dj'}`; host's media controls broadcast `dj:transport` (play/pause/seek/next); every listener's local Web Playback SDK player follows. Each listener needs Premium.
- **Center stage** lives in the voice shell (your real `VoiceChile` / voice-session component, *not* a Mediasoup-named file — reconcile per usual). Individual panes collapse into the pulsing album-art reactor with expanding rings; non-DJ avatars move to the "Front Row" semicircle.
- **DJ dock:** Prev/Play-Pause/Next + scrubber (global, via `dj:transport`). **Listener dock:** "Local Volume" slider → `player.setVolume()` locally only (this is genuinely per-client with the Web Playback SDK, so the blueprint's "turn the DJ down to 10% without affecting the room" is feasible for Premium listeners).
- **ToS flag:** the bass-reactive grid + orbiting avatars + one-DJ-to-room model are the parts most exposed to the "sync to visual media" and "non-interactive broadcasting" clauses. Keep visuals decorative/ambient rather than literal audio-waveform-driven, frame it as interactive (everyone controls their own volume / can leave), and get the lawyer who's already reviewing the beta form to glance at the Spotify Developer Policy for this mode specifically.

---

## 5. Honest feasibility summary

| Blueprint piece | Feasible? | For whom | Blocking dependency |
|-----------------|-----------|----------|---------------------|
| Roster equalizer pulse | ✅ Yes | Everyone | OS media session (Electron) |
| Sonic Card + live scrubber + glow | ✅ Yes | Everyone | OS media session; color extraction |
| Canonical Spotify links / exact track | ⚠️ Limited | ≤5 allowlisted | Spotify dev-mode cap |
| "Open in Spotify" soft-sync | ✅ Yes | Everyone | Deep links only |
| True "SYNCED" audio sync | ⚠️ Premium-only | Both ends Premium, ≤5 | Premium + Widevine/Connect + quota |
| Spidr DJ Matrix (shared audio) | ⚠️ Hardest | All Premium, ≤5 | Premium everyone + ToS review + quota |
| DJ Matrix *visuals* (no real audio) | ✅ Yes | Everyone | None — can be a pure visualizer mode |

A pragmatic shipping order: **Phase 0 → 1 → 2 (soft-sync)**, ship that as the headline feature, then treat **Phase 3/4** as a Premium "Pro" beta limited to your allowlist until/unless extended quota lands. You could also ship a **DJ Matrix "visualizer-only" mode** (everyone hears their own local audio, the room shares the *visual* show synced to a host-broadcast beat clock) that delivers the spectacle without the Premium/quota/ToS exposure — worth considering as the version that actually scales.

---

## 6. Decisions I need from you before building

1. **Display source:** confirm OS-media-session (T1) as the primary path? (My recommendation — it's the only one that scales without Spotify approval.)
2. **Sync ambition:** for the "Sync Audio" button, are you OK shipping **soft-sync (deep link)** as the universal behavior and gating **true SYNCED** behind Premium + allowlist? Or do you want to chase true sync first for demos despite the 5-user ceiling?
3. **Electron playback path (if T3):** in-app Web Playback SDK (requires castlabs Widevine build) vs. controlling the user's existing Spotify Connect device (no Widevine, but no in-app player)?
4. **DJ mode:** real shared audio (Premium-gated, ≤5, ToS review) vs. the **visualizer-only** shared-show version that scales? 
5. **Business entity:** do you want to register the Spidr business now to keep the extended-quota door open, even though 250k MAU is the stated bar?

Tell me 1–4 and I'll start building Phase 0 + Phase 1 into `Spidr-Demo-dev` (presence plumbing, `SonicPulse`, `SonicCard`, the Electron media-session bridge) and fold it into the cumulative ZIP — build-verified per the usual esbuild pass, with an honest done-vs-deferred note.