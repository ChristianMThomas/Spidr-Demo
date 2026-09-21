# Apple Music Setup

Spidr uses the existing Settings > Connections (Neural Links) and profile connection panel, alongside Spotify. Apple Music uses MusicKit authorization, not Spotify's OAuth endpoints.

## Apple Developer

1. Open Certificates, Identifiers & Profiles in your Apple Developer account.
2. Under Identifiers, create a Media ID. Set its description to Spidr, choose your reverse-domain identifier, and enable MusicKit.
3. Under Keys, create a Media Services key with MusicKit enabled and associate it with that Media ID.
4. Download the .p8 file and keep it outside the repository. Record its Key ID and your membership Team ID. Do not paste the private key into chat or frontend configuration.

Apple's instructions: https://developer.apple.com/help/account/capabilities/create-a-media-identifier-and-private-key
Token authentication: https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens
User authorization: https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit

## Backend Configuration

Set these in spidr-server/.env locally and in your hosting provider's secrets for production:

```dotenv
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_MUSICKIT_KEY_ID=YOUR_KEY_ID
APPLE_MUSICKIT_PRIVATE_KEY_PATH=C:/path/outside/repo/AuthKey_YOUR_KEY_ID.p8
APPLE_MUSIC_STOREFRONT=us
SERVER_URL=http://localhost:4000
```

For hosting that injects key contents instead of mounting a file, use APPLE_MUSICKIT_PRIVATE_KEY with the PEM contents. Literal newlines and escaped \\n are supported. Use only one of the two private-key settings. Neither belongs in a VITE_ variable. Existing .gitignore rules exclude .env files and .p8 keys.

Set SERVER_URL to your public HTTPS API origin in production. The desktop browser handoff is served at /apple-music/connect on that origin. It is not a Spotify callback and does not require a Spotify redirect URI. Do not change your Spotify credentials.

Restart the Node API after changing credentials. From spidr-server:

```powershell
node scripts/check-apple-music.js
node scripts/check-apple-music.js --live
```

The first command checks local signing without exposing keys or JWTs. The second also checks Apple's catalog with the developer token. Neither links a user's account.

## Verification

- Web: Settings > Connections > Apple Music > Connect Apple Music. Approve Apple's prompt. Connected appears only after Apple validates the Music User Token and the backend saves it.
- Desktop: the same button opens the system browser with a five-minute, single-use connection link. Approve Apple Music there; Spidr refreshes its connection status automatically.
- Refresh Spidr and confirm the connection persists. Disconnect and confirm the saved credential and pending browser links are removed.
- Test profile recently played, catalog search in the DJ picker, and playback using an Apple Music subscriber in a supported browser.
- Authorization on another device does not authorize the local browser player. Use Authorize this device when prompted.

Private Music User Tokens live in the dedicated AppleMusicConnection collection, never in public profile responses. Old scaffold connections must reconnect once to move off the legacy profile-token format.

Full-track playback requires each listener's own Apple Music subscription and a browser with protected-media support. Stock Electron is not guaranteed to provide that support; desktop connection and catalog access do not imply full-track in-app playback. The existing preview/live-audio fallback is retained.

Apple's recently-played API is labeled Last played, never fabricated as live playback. Live MusicKit playback inside Spidr uses the existing now-playing presence channel. This does not add a native Expo MusicKit SDK.

## Tests

```powershell
node --test test/appleMusic.test.js
$env:SPIDR_LOCAL_INTEGRATION='1'
node --test test/appleMusic.integration.test.js
```

Integration tests use a disposable local MongoDB database and mocked Apple responses. Real authorization, subscription playback, and production deployment still require the configured developer account and a consenting Apple Music subscriber.
