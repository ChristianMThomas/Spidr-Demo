# SPIDR APEX — Pricing & Monetization Reference

> Source of truth as implemented in code as of 2026-07-20 (branch `dev`).
> Primary implementation: `spidr-client/src/components/spidr/ApexCommand.jsx` (checkout + manage UI),
> `spidr-server/src/models/UserProfile.js:42-70` (tier + Stripe state),
> `spidr-server/src/routes/webhooks/stripe.js` (signed webhook — only writer of `apex_tier`),
> `ApexStore.jsx` / `ApexVisuals.jsx` (customization).

## Tiers

Two tiers exist in the data model (`UserProfile.apex_tier`, enum `['free','apex']`). The manage screen labels the paid tier "APEX TIER 1", implying room for higher tiers later, but only one paid tier is implemented.

| Plan | Price | Effective /mo | Billing | Notes |
|---|---|---|---|---|
| Free | $0 | — | — | Default for every profile |
| APEX — Monthly | **$7.99 / mo** | $7.99 | Monthly | |
| APEX — Yearly | **$69.99 / yr** | $5.83 | Annual | ~27% discount vs monthly |

Prices are hardcoded in `ApexCommand.jsx:11-14` (`MONTHLY_PRICE = 7.99`, `YEARLY_PRICE = 69.99`; savings % is computed). There is no server-side price table — changing prices means editing the client, redeploying, **and** updating the corresponding Stripe Price IDs on the server.

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

## Stripe Data Model (Patch 1.9.25)

Real subscription state lives on `UserProfile` as server-only fields (`spidr-server/src/models/UserProfile.js:58-70`, comment: "in crudRouter's PROTECTED_FIELDS … no client PATCH can touch them"):

| Field | Type | Notes |
|---|---|---|
| `stripe_customer_id` | String (indexed) | Set on first Checkout Session |
| `stripe_subscription_id` | String | Current active/trialing subscription |
| `stripe_subscription_status` | String | `'active' \| 'trialing' \| 'canceled' \| 'past_due' \| …` — drives the manage-screen status pill |
| `stripe_current_period_end` | Date | Powers the "Next Billing" / "Trial Ends" row (`ApexCommand.jsx:105-111`) |
| `stripe_cancel_at_period_end` | Boolean | End-of-cycle cancel flag from Stripe |
| `apex_first_activated_at` | Date | **Burn-once trial gate.** `null` → user has never held APEX → Checkout Session includes the 30-day trial. Set on first activation, never cleared, so cancel-and-resubscribe pays from day one. Client reads this at `ApexCommand.jsx:74` for the "$0.00 due today" hint; server is authoritative. |

## Purchase / Cancel Flow (current state)

- **Upgrade**: choose plan → `payments.createCheckoutSession(planType)` (`ApexCommand.jsx:79`) returns a Stripe Checkout URL → opened in a new tab / system browser (`window.open(url, '_blank')`) → Stripe webhook flips `apex_tier` server-side. Card data never touches Spidr servers.
- **Return-from-Checkout refresh** (`ApexCommand.jsx:47-66`): on window `focus`, every profile-related React Query cache is invalidated so the APEX badge, tab, and features unlock without a manual reload. Electron-aware — `window.electronAPI.onWindowFocus` fires even when the OS focus target is still the external browser tab.
- **Cancel / manage**: `payments.createPortalSession()` (`ApexCommand.jsx:94`) opens the Stripe Billing Portal in a new tab. Cancellation, plan changes, and payment-method updates all happen there; the webhook mirrors the resulting state back into `stripe_*` fields.
- **Manage screen** reads live Stripe fields — status pill from `stripe_subscription_status` (trialing → yellow "Free trial active"; else green "Active Subscription"), next-billing row from `stripe_current_period_end`, plan/amount from `apex_features.plan_type` + `MONTHLY_PRICE` / `YEARLY_PRICE` constants.

## Remaining Gaps

Patch 1.9.25 closed the big four (real Stripe checkout, server-only tier writes, real cancel semantics, live billing metadata). What's left:

1. **Feature-level enforcement is still client-side.** Tier writes are locked, but the API will still persist APEX-only fields (`bubbleGradients.js:133`, entrance styles, frame URLs) if a free user PATCHes them directly. Belt-and-braces would be server-side rejection of APEX-gated field writes when `apex_tier === 'free'`.
2. **No higher tier.** The UI hints at "APEX TIER 1" but the enum is binary. Adding TIER 2 means extending the enum, the price table, the Checkout Session catalog, and the webhook mapping.
3. **No self-serve refund / dunning UX inside Spidr.** All of it goes through the Stripe portal — fine for now, but note it before any consumer-support-heavy launch.

Historical / resolved gaps (kept for context): PCI scope from client-side card collection, client-writable `apex_tier`, hardcoded billing metadata, and instant-vs-end-of-cycle cancel semantics were the four fixed by Patch 1.9.25 (see `spidr-server/src/routes/system.js:13-20`, NEWS id `p1925`).
