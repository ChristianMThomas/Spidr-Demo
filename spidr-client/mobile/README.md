# Spidr Mobile

React Native + Expo build of Spidr. iOS + Android from one codebase. Lives at `spidr-client/mobile/`.

Patch 1.9 (TestFlight Phase 1): Feed, Servers + text channels, Friends + DMs, Profile.
Voice channels, Spotify OAuth, and DJ sessions are Phase 2 (require a custom dev client).

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK **54** |
| Routing | `expo-router` (file-based) |
| Styling | NativeWind v4 (Tailwind classnames → RN StyleSheet) |
| Storage | `@react-native-async-storage/async-storage` |
| Realtime | `socket.io-client` (shared backend with web) |
| Data fetching | `@tanstack/react-query` v5 |
| Lists | `@shopify/flash-list` |
| Images | `expo-image` |

---

## First-time setup

```powershell
cd spidr-client/mobile
npm install
```

> **Why the install needs care.** Expo's transitive deps occasionally trigger
> npm peer-dependency conflicts (e.g. `react-native-web` vs `react-dom`).
> `.npmrc` in this folder sets `legacy-peer-deps=true` to silence them. Do
> **not** run `npm audit fix` — it bumps `react-native` past Expo's pinned
> version and the bundler stops working. The vulns are in build-time tooling
> that never ships to the device. They're harmless for the dev workflow.

If you ever see a "missing peer dependency" warning during `npm install`,
the canonical fix is **not** `npm audit fix`. It's:

```powershell
npx expo install --fix
```

That re-pins every Expo-managed dep to the version your installed SDK
expects. Run it after pulling new changes too.

---

## Run the dev server

```powershell
npx expo start --tunnel --clear
```

- `--tunnel` routes Metro through ngrok so the phone doesn't need to be on
  the same Wi-Fi. The first run prompts to install `@expo/ngrok` — press `y`.
- `--clear` wipes the Metro cache (only needed after dep changes; you can
  drop it after the first boot).
- Scan the QR code with **Expo Go** on iPhone/Android.

If you get **"You need Expo Go for SDK X.Y"**, the SDK Expo Go bundles has
moved past ours. Bump us up:

```powershell
npm install expo@latest
npx expo install --fix
```

---

## Project layout

```
spidr-client/mobile/
  app/                    ← expo-router file-based routes
    _layout.tsx           ← providers + auth guard (AuthGate)
    (auth)/               ← login, register, OTP verify
    (tabs)/               ← Feed, Servers, Friends, Profile
    server/[id]/          ← channel list + text chat
    dm/[id].tsx           ← direct-message thread
  components/
    ui/                   ← Avatar, Spinner, EmptyState
    feed/                 ← PostCard
    chat/                 ← MessageBubble, MessageInput
    spidr/                ← NowPlayingCard
  lib/
    apiClient.ts          ← mirrors every export from web's src/api/apiClient.js
    authContext.tsx       ← AsyncStorage + emitter + expo-router redirects
    appShellContext.tsx   ← currentUser, theme
    eventEmitter.ts       ← replaces window.dispatchEvent / addEventListener
    socket.ts             ← getSocket() — same socket.io as web
    queryClient.ts        ← react-query client config
    config.ts             ← URL constants from expo-constants
  hooks/
    useNowPlaying.ts      ← copy of web hook (no DOM)
    useTension.ts         ← copy of web hook (window event → emitter)
  app.json                ← URLs in `expo.extra`
  tailwind.config.js
  babel.config.js
  metro.config.js
  global.css              ← NativeWind entry
```

Backend URLs live in `app.json` under `expo.extra` (`apiUrl`, `authUrl`,
`wsUrl`). The mobile app reads them via `expo-constants` — there is no
`process.env`/`import.meta.env` at runtime.

---

## Why the mobile app does NOT import from `../src/`

`spidr-client/src/api/apiClient.js` uses `localStorage`, `window.dispatchEvent`,
`window.location.reload`, and `import.meta.env` — none of which exist in React
Native. Importing it would crash the bundler. The mobile `lib/apiClient.ts`
mirrors every public export (`entities`, `auth`, `spotify`, `biomass`,
`tension`, `algorithm`, `follows`, `feedComments`, `moduleActions`,
`integrations`, `searchUsers`, `searchMessages`, plus `default api`), but its
internals use `AsyncStorage` + `emitter` + `expo-constants`. Same shape, RN-
safe innards.

---

## Adding a screen

Drop a `.tsx` file under `app/`. The filename is the route.

```tsx
// app/(tabs)/settings.tsx
import { View, Text } from 'react-native';
export default function Settings() {
  return <View className="flex-1 bg-spidr-dark"><Text className="text-white">Hi</Text></View>;
}
```

Add it to the tab bar by registering it in `app/(tabs)/_layout.tsx`.
Dynamic routes use `[param].tsx`. Layouts use `_layout.tsx`.

---

## Common errors

| Symptom | Fix |
|---|---|
| `Could not connect to the server` on phone scan | Use `--tunnel`, or fix Windows Firewall to allow `node.exe` on Private networks |
| `CommandError: ngrok tunnel took too long to connect` | `npx expo install @expo/ngrok` — Expo needs it as a **local** dep. `npm install -g ngrok` does nothing; Expo never uses the global binary |
| Dev client: `Failed to connect to http://<id>.exp.direct/` | Use **`https://`**, not `http://`. iOS App Transport Security blocks cleartext to non-local hosts, and the manifest advertises the `http` URL. Same host over HTTPS connects fine |
| Tunnel connects on the PC but the phone can't reach it | Guest/public WiFi often runs filtered DNS that won't resolve `*.exp.direct`. Turn WiFi off on the phone and retry over cellular — a tunnel works from any network, so cellular confirms whether the WiFi is the blocker |
| `Unable to resolve module react-native-worklets` | `npx expo install react-native-worklets` then restart Metro with `--clear` |
| `Plugin "react-native-reanimated/plugin" not found` | `babel.config.js` should use `react-native-worklets/plugin` (reanimated 4 split the plugin out) |
| `Missing peer dependency: react-dom` | `npx expo install react-dom` |
| Bundling never finishes / hangs | Stop Metro, `Remove-Item -Recurse -Force node_modules .expo`, `npm install`, `npx expo start --tunnel --clear` |
| Phone shows "You need Expo Go for SDK …" | `npm install expo@latest && npx expo install --fix` |

---

## Phase 2 (later)

- **Voice channels** — `react-native-webrtc` + `expo-dev-client` + EAS Build.
  Cannot run in Expo Go.
- **Spotify OAuth** — `expo-auth-session` against the existing `/spotify/auth/url`
  backend endpoint.

When voice ships, the workflow switches from Expo Go to a custom dev client:
`npx expo prebuild` + `npx expo run:ios` / `run:android`.
