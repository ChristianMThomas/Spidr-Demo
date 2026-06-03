# Spotify Now Playing — WIP

**Session:** 2026-06-03  
**Status:** Code complete — needs credentials + redirect URI to go live

---

## What was built

| File | Change |
|------|--------|
| `spidr-server/src/routes/spotify.js` | New route — OAuth start, callback, now-playing, disconnect |
| `spidr-server/src/index.js` | Registered `/spotify` route |
| `spidr-client/src/components/nexus/widgets/SpotifyNowPlaying.jsx` | New widget — album art, track, artist, live progress bar, last-played fallback |
| `spidr-client/src/components/nexus/InstalledModules.jsx` | Added `'Spotify Now Playing'` to `BUILTIN_WIDGETS` |
| `spidr-client/src/components/spidr/NeuralConfig.jsx` | Rewrote Spotify card to use real OAuth connect/disconnect (Settings → Neural tab) |
| `spidr-client/src/components/spidr/SettingsPanel.jsx` | Added `?tab=` URL param support so `/settings?tab=connections` deep-links directly to Neural tab |

### Also shipped this session
- **Gaming Uplink** — elapsed session timer (MM:SS + "elapsed"), League game mode badge (ARAM / Swiftplay / Arena etc.), R.E.P.O. log parsing infrastructure
- **Spotify route** registered and responding at `http://localhost:4000/spotify/auth/start`

---

## How it works

Each Spidr user connects **their own** Spotify account. The platform has one Spotify Developer app (CLIENT_ID/SECRET on the server); each user goes through a standard OAuth flow to grant access to their personal data. User A sees their tracks, User B sees theirs — nobody shares anyone else's account.

Flow:
1. User opens **Settings → Neural** tab
2. Clicks **Connect Spotify** → browser opens Spotify auth page
3. User approves → Spotify redirects to `/spotify/auth/callback`
4. Server exchanges code for tokens, stores them in `UserProfile.neural_links`
5. Window regains focus → TanStack Query refetches profile → widget lights up

---

## To finish — next session

### 1. Add credentials to `spidr-server/.env`
```
SPOTIFY_CLIENT_ID=<your client id>
SPOTIFY_CLIENT_SECRET=<your client secret>
```
Get these from https://developer.spotify.com/dashboard — create an app if you don't have one.

### 2. Register redirect URIs in Spotify Dashboard
```
http://localhost:4000/spotify/auth/callback       ← local dev
https://<your-railway-url>/spotify/auth/callback  ← production
```

### 3. Fix local dev redirect URI
The server's `.env` has `SERVER_URL` pointing to the production Railway domain, so the OAuth callback goes to prod even when running locally. For dev testing, temporarily set:
```
SERVER_URL=http://localhost:4000
```
Then revert before pushing to Railway.

### 4. Test the full flow
- Start dev stack (`/dev`)
- Go to `http://localhost:5173/settings?tab=connections`
- Click Connect Spotify, authorize, come back
- Open **Modules → My Repository → Spotify Now Playing** — should show your current track

### 5. R.E.P.O. log parsing (bonus)
The log parsing regexes in `parseRepoLog()` (`electron/main.js`) are educated guesses. Once you have an actual R.E.P.O. session running, grab `%USERPROFILE%\AppData\LocalLow\Semiwork\REPO\Player.log` and tune the patterns for level detection and lobby size.

---

## Spotify Developer app limits

Spotify apps start in **Development mode** — capped at **25 users**. To go beyond that, submit your app for Extended Quota via the Spotify Dashboard. This is just a form submission, no code change required.
