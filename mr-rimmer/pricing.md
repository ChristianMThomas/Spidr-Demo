# SPIDR APEX — Pricing & Monetization Reference

> Source of truth as implemented in code as of 2026-07-06 (branch `patch-1.9_Mobile`).
> Primary implementation: `spidr-client/src/components/spidr/ApexCommand.jsx` (checkout + manage UI),
> `spidr-server/src/models/UserProfile.js:42-49` (tier storage), `ApexStore.jsx` / `ApexVisuals.jsx` (customization).

## Tiers

Two tiers exist in the data model (`UserProfile.apex_tier`, enum `['free','apex']`). The manage screen labels the paid tier "APEX TIER 1", implying room for higher tiers later, but only one paid tier is implemented.

| Plan | Price | Billing | Notes |
|---|---|---|---|
| Free | $0 | — | Default for every profile |
| APEX — Monthly | **$7.99 / mo** | Monthly | |
| APEX — Yearly | **$6.39 / mo** ($76.68 billed annually) | Annual | 20% discount vs monthly |

Prices are hardcoded in `ApexCommand.jsx:42` (`planType === 'monthly' ? 7.99 : 6.39`). There is no server-side price table — changing pricing means editing the client and redeploying.

## What APEX Buys (as marketed in the upgrade modal)

1. ⚡ **Squad Overclock** — boost voice calls to 4K/60FPS
2. 🗄️ **Deep Storage** — unlimited media uploads
3. 🎨 **Thread Skins** — custom voice thread colors (rendered in `CallOverlay`, `ActiveCallTether`, `CommunityPanel`)
4. 🚀 **Entry Protocol** — custom join animations (`ApexEntrance.jsx` full-screen flash: thunder / ripple / glitch)
5. 🏆 **Apex Badge** — exclusive profile crown + custom badge URL/glow (`apexBadgeUrl`, `apexBadgeGlow`)
6. 🌐 **Priority Support** — faster response times

## What APEX Actually Gates in Code (broader than the marketing list)

- **Symbiote suite** (Patches 2.0–2.4): Profile Takeover overlay, Stream HUD with live telemetry, Frame Vault (`apexFrameStyle`, default `symbiote-tear`), Nexus Grid sidebar, custom Nameplates (`apexNameplateStyle`, `nameplate_url`)
- **Chat bubble gradients** — APEX-only gradients enforced in `spidr-client/src/lib/bubbleGradients.js:133` (falls back to default for free users)
- **Feed Overclock** (Patch 2.11) — boosts a clip's algorithm weight for 1 hour (`Clip.overclock_until`; +35 tension score in `lib/tensionScore.js:40`); owner-only per `routes/clips.js`
- **APEX Web-Strike** — slam reaction on feed clips
- Custom profile background formerly APEX-only (`custom_bg_url`) — now superseded by Theme Studio for everyone (`HomeDashboard.jsx:63`)

Feature flags are stored in `UserProfile.apex_features` (Mixed object: `thread_skin`, `squad_overclock`, `deep_storage`, `entry_protocol`, `bubble_gradient`, `entrance_style`, `frame_url`, `nameplate_url`, `plan_type`, `activated_at`, …). Visual fields are **duplicated** top-level on the profile (`apexFrameStyle`, `apexBadgeUrl`, `apexBadgeGlow`, `apexNameplateStyle`) — consumers read top-level first, then fall back to `apex_features`. Writers must update both (see `ApexVisuals.jsx` badge saver).

## Purchase / Cancel Flow (current state)

- Upgrade: choose plan → billing form (client-side validation only) → **simulated** 1.8 s delay → `UserProfile.update({ apex_tier: 'apex', apex_features: {...} })` → cache invalidation + `spidr-profile-updated` event so the APEX tab/badge unlock without reload.
- Cancel: confirmation dialog → sets `apex_tier: 'free'` **immediately**, though the UI copy says "Access until next billing cycle."

## ⚠️ Known Gaps (pre-launch blockers for real money)

1. **No payment processor.** The card form collects real card data into React state and discards it; `ApexCommand.jsx:68` has the TODO: "In production: call your Stripe checkout session endpoint here." Never ship the current form to production — collecting card numbers ourselves is PCI scope we don't want. Replace with Stripe Checkout/Elements.
2. **Tier is client-writable.** Activation is a plain `entities.UserProfile.update(...)` from the browser. Any logged-in user can grant themselves APEX by calling the profile update endpoint directly. Real monetization needs a server-side subscription check (Stripe webhook → server sets `apex_tier`; profile route must reject client writes to `apex_tier` / `apex_features.squad_overclock` etc.).
3. **Hardcoded billing metadata.** The manage screen shows a fixed "Next Billing: Apr 14, 2026 / Monthly / $7.99" regardless of the actual plan purchased.
4. **Cancel semantics mismatch.** Code downgrades instantly; copy promises end-of-cycle access. Pick one (end-of-cycle requires a `apex_expires_at` field + cron/worker check).
5. **No server enforcement of gated features.** Gating (bubble gradients, overclock, skins) is client-side; the API will happily persist APEX-only fields for free users.
