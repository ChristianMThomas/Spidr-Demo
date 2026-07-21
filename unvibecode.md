# unvibecode.md

Inventory of hardcoded emojis, unicode glyphs, and text symbols used as UI in the Spidr client. These are the "vibe coded" placeholders — literal characters standing in for what should be `lucide-react` icons, image assets, or a shared icon component. Replace them with proper icons/components before shipping polished UI.

**Legend** — `x(N)` = symbol appears N times in that file. Single occurrences show the glyph alone.

**Scope note** — Electron and Web share the React codebase in `spidr-client/src/`. The **Electron** section below covers only the Electron shell (`spidr-client/electron/`). Everything the Electron app renders inside its window is the **Web** section.

**Ignored** — dedicated emoji-picker product UIs are called out explicitly (`⚠️ legitimate`) so they aren't confused with vibe-coded assets. Server-side node code is excluded — no user-facing render surface.

---

## Web (spidr-client/src) — also renders inside Electron

### Pages (`spidr-client/src/pages/`)

| Page | Symbols |
|---|---|
| `Biomass.jsx` | ✓ |
| `ProtocolOverlay.jsx` | ✓ ⚠ |
| `SeedFriends.jsx` | 🔥×3 ✅ 🚀 |

*Every other page in `pages/` uses lucide icons only — no vibe-coded glyphs found.*

### Feed components (`components/feed/`)

| Component | Symbols |
|---|---|
| `AudioGraftNode.jsx` | ♪ |
| `AudioInjector.jsx` | ✓ |
| `ClipFeed.jsx` | ⚡×2 🔥 🎮 🕸 |
| `FrequencyArchive.jsx` | 🎵 |
| `MusicSearch.jsx` | 🔥 |
| `SoundsBrowser.jsx` | 🔥 |

### Gifs / archive (`components/gifs/`)

| Component | Symbols |
|---|---|
| `HivePanel.jsx` | 🕸 |
| `SystemArchive.jsx` | ⚠️ legitimate — emoji browser (~200 emojis in a category grid, product feature, not vibe-coded) |

### Nexus / widgets (`components/nexus/`)

| Component | Symbols |
|---|---|
| `ModuleFabricator.jsx` | 📝 🖼 🌐 📡 |
| `widgets/AppleMusicNowPlaying.jsx` | ● |
| `widgets/DynamicModuleWidget.jsx` | 🌧×2 ☀ ⛅ 🌫 🌦 ❄ 🌨 ⛈ 📍 *(weather-icon lookup table)* |
| `widgets/previews/index.jsx` | 🔥 ⛅ 📍 |

### Spidr shell components (`components/spidr/`)

| Component | Symbols |
|---|---|
| `AIPanel.jsx` | 🔊 🕸 ⚠ |
| `ApexCommand.jsx` | 🔒 🟡 🟢 ⚡ 🗄 🎨 🚀 🏆 🌐 |
| `BotLaboratory.jsx` | ✓×4 🤖×3 ◆ 🛡 |
| `CallOverlay.jsx` | ⚡×2 🔴 |
| `CommunityPanel.jsx` | 🕷 |
| `DJMatrix.jsx` | ▶ ♫ |
| `DirectMessages.jsx` | 🕸 |
| `EmojiPicker.jsx` | ⚠️ legitimate — the emoji-picker product itself |
| `EnhancedFeed.jsx` | 🔥 ❤ 👀 💀 🕷 |
| `ErrorBoundary.jsx` | ⚠ |
| `EventModal.jsx` | 🔊 |
| `FeedCommentsSection.jsx` | 👍×2 ❤×2 😂×2 🔥 🕷 ✕ 😊 |
| `FriendsPanel.jsx` | 💬 |
| `HolographicProfile.jsx` | 🕷 🖊 ✏ |
| `LoginPage.jsx` | 🛡 🔧 ✓ ⚠ 📱 ✉ |
| `MessageBubble.jsx` | 😊 |
| `MessageInputBar.jsx` | ✏ 📄 ✕ |
| `MessageItem.jsx` | 🕷×2 ▶ 🕸 |
| `NeuralConfig.jsx` | ●×2 ○×2 |
| `NotificationCenter.jsx` | 🕸 |
| `SecurityMatrix.jsx` | 🔒×2 📱×2 ✉×2 🕸 ⚡ ⚠ |
| `ServerInviteCard.jsx` | ✓×2 |
| `ServerSettingsModal.jsx` | ⏳ ✓ |
| `ServersPanel.jsx` | 🛡 🤖 🔇 ⏳ 🕸 |
| `SettingsPanel.jsx` | ✓×2 🟢 🟡 🔴 ⚫ ⚡ |
| `ShareWeb.jsx` | 🕸 |
| `SignalRadar.jsx` | ⚡ |
| `SpidrAIProfile.jsx` | 🕷 🤖 🟢 🎵 📺 💬 🕸 |
| `SpidrBotEngine.jsx` | 🛡×25 👋×9 🕷×8 📊×3 📈×3 🧠×3 🎲×2 🕸 🎯 🎱 ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ 🌊 🔥 🌙 ⚡ 🎮 🪙 ✅ 🚫 *(bot-response templates — highest emoji density in the codebase)* |
| `SpidrProtocolSettings.jsx` | ◎ |
| `StreamSelector.jsx` | 🖥×2 ⚔ 🎮 📝 💬 💻 |
| `TheaterStage.jsx` | 🔥 💀 😂 ❤ ⚡ |
| `ThemeStudio.jsx` | 🎨 |
| `VideoScrubber.jsx` | ▶ |
| `VideoStudio.jsx` | ✓×2 🕷 ✕ ▶ ⏹ |
| `VoiceMessageCapsule.jsx` | ● |
| `VoiceWeb.jsx` | 🔇 🔊 |

### UI primitives (`components/ui/`)

| Component | Symbols |
|---|---|
| `SpidrMenu.jsx` | 🔥 ❤ 😂 👍 💀 😱 ▸ *(reaction picker)* |

### Lib / helpers (`src/lib/`)

| File | Symbols |
|---|---|
| `aiIconText.jsx` | 🕷×5 🕸×3 🛡×2 ❤×2 ⚠×2 👋 ⚡ 🔥 📊 ✅ ❌ 💡 🎵 🎶 🔴 😂 🤣 🤖 ✨ 🚀 👀 🐛 🎉 🎯 🧠 🔧 🔍 ⭐ 🌟 *(text→emoji lookup table used across the app)* |
| `roguePersonalities.js` | 🕷 😈 👁 🔥 🧘 🕵 *(bot persona avatars)* |
| `soundboardEngine.js` | 👽×2 🕸 ⚡ 🔵 📢 📉 🥁 🪙 🎙 🐿 🔊 🤖 🌀 *(soundboard button labels)* |

---

## Electron shell (`spidr-client/electron/`)

| File | Symbols | Where |
|---|---|---|
| `splash.html` | 🕷 | Splash screen logo, line 107 |
| `main.js` | ✓ ✗ | Boot-log status glyphs, line 178 |
| `preload.js` | — | none |

---

## Mobile (`spidr-client/mobile/`)

### App routes (`mobile/app/`)

| Page | Symbols |
|---|---|
| `(auth)/verify.tsx` | ✓ *(OTP success check)* |
| `gifs-emojis.tsx` | ⚠️ legitimate — mirror of `SystemArchive.jsx`, emoji browser (~200 emojis) |
| `settings/connections.tsx` | ● ○ *(radio toggle glyphs)* |
| `settings/notifications.tsx` | ● ○ |
| `settings/privacy.tsx` | ● |
| `settings/protocol.tsx` | ● ○ |
| `settings/security.tsx` | ✉ 🔒 📱 |
| `spidr-ai.tsx` | 🕷×2 ⚡×2 🔊 🕸 |

*All other routes under `mobile/app/` render icons via lucide-react-native / expo-vector-icons — no hardcoded glyphs.*

### Mobile components (`mobile/components/`)

| Component | Symbols |
|---|---|
| `chat/EmojiGifPicker.tsx` | ⚠️ legitimate — the mobile emoji-picker product (~1000 emojis across categories) |
| `profile/ModuleWidget.tsx` | ☀ ⛅ 🌫 🌦 🌧×2 ❄ 🌨 ⛈ *(weather widget)*, plus 🕷 😻 😾 *(pet module)* |
| `profile/ProfileView.tsx` | 🎵×2 ✨ |

### Mobile lib (`mobile/lib/`)

| File | Symbols |
|---|---|
| `roguePersonalities.ts` | 🕷 😈 👁 🔥 🧘 🕵 *(same personas as web lib, mobile mirror)* |

---

## Cross-platform lockstep pairs

These pairs render the same glyphs on both platforms — if you swap one, swap the other or the UIs desync:

1. **Emoji browser** — `web: components/gifs/SystemArchive.jsx` ≡ `mobile: app/gifs-emojis.tsx` (identical ~200-emoji category grid).
2. **Rogue personas** — `web: lib/roguePersonalities.js` ≡ `mobile: lib/roguePersonalities.ts` (identical 6 avatar glyphs).
3. **Weather icons** — `web: components/nexus/widgets/DynamicModuleWidget.jsx` ≡ `mobile: components/profile/ModuleWidget.tsx` (identical weather-code → emoji table).
4. **Reaction glyphs** — `web: components/ui/SpidrMenu.jsx` (🔥 ❤ 😂 👍 💀 😱) — mobile has no equivalent picker yet.
5. **AI-icon-text substitution** — `web: lib/aiIconText.jsx` centralizes text→emoji conversion for AI output. Mobile has no equivalent — it renders raw AI text without substitution, so text like `[shield]` won't get replaced with 🛡 on mobile.

---

## Highest-priority replacement targets

Ranked by product visibility × symbol density:

1. **`components/spidr/SpidrBotEngine.jsx`** — 60+ emojis in bot response templates. Every chat interaction with the bot shows one.
2. **`lib/aiIconText.jsx`** — the substitution table itself. Replace with a single `<Icon name="..." />` mapping so mobile picks it up too.
3. **`components/spidr/LoginPage.jsx`, `SecurityMatrix.jsx`, `mobile/settings/security.tsx`** — 🔒 📱 ✉ used as auth-flow icons on both platforms; use lucide's `Lock` / `Smartphone` / `Mail`.
4. **`components/spidr/BotLaboratory.jsx`** — ✓×4 as status glyphs; use lucide `Check`.
5. **`mobile/app/settings/*.tsx`** — ● ○ used as radio-toggle glyphs; use lucide `Circle` / `CircleDot`.
6. **`components/spidr/SettingsPanel.jsx`** — 🟢 🟡 🔴 ⚫ as status dots; use styled `<span>` or lucide `Circle`.
7. **`components/nexus/widgets/DynamicModuleWidget.jsx` + mobile `ModuleWidget.tsx`** — weather emojis on lockstep; swap both to `lucide-react` weather icons.
8. **`components/spidr/FeedCommentsSection.jsx`, `EnhancedFeed.jsx`, `TheaterStage.jsx`, `ui/SpidrMenu.jsx`** — reaction bar glyphs; consolidate into one shared reaction component with SVG-backed reactions.

---

## What was **not** flagged

- `EmojiPicker.jsx` (web) and `EmojiGifPicker.tsx` (mobile) — legitimate emoji picker products; the emojis are the feature.
- `SystemArchive.jsx` (web) / `gifs-emojis.tsx` (mobile) — legitimate emoji browser page.
- All server code (`spidr-server/`, `spidr-auth/`, `spidr-beta/`) — no user-render surface. Any emojis in server logs are console-only.
- Every page under `spidr-client/src/pages/` not listed above (AI, Bots, Friends, GifsEmojis, GlobalReports, LandingPage, Modules, NerveCenter, PopoutCall, Settings, TheWeb, Radar, Servers, Admin, HomeDashboard, Legal, JoinServer) — uses lucide icons cleanly.
- Every mobile route not listed — same, uses lucide-react-native / expo-vector-icons.
