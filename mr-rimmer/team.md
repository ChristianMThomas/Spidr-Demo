# Spidr — Team

> Written 2026-07-06, re-verified 2026-07-20 on branch `dev` (no team, workflow, or ownership changes since). Update when roles, members, or workflow change.

## Members (2)

### Chris Thomas — Co-Founder / Product Lead / Full-Stack
- GitHub: [ChristianMThomas](https://github.com/ChristianMThomas) · git user: "Chris Laptop" · christhomas0634@gmail.com
- Wears every engineering hat: product vision and roadmap, full-stack development across all services, **mobile lead** (the Patch 1.9+ Expo app is his), and **backend/infra owner** (spidr-server, spidr-auth, Railway, MongoDB Atlas, deployments).
- Works on Windows 11, primarily through Claude Code with the project slash-command workflow (`/dev`, `/ship`, `/patch`, `/cross-check`).

### Safina Khan ("FiFi") — Co-Founder Design Lead / Frontend / Electron
- GitHub: [safinakh2000](https://github.com/safinakh2000)
- Gravitates toward **Figma design, frontend (spidr-client web UI), and the Electron desktop app**. The `spidr-beta/spidr-landing` Figma export ("Build Spidr Chat App") is her design lineage.
- The audience for `/cross-check` platform-impact summaries — when Chris's changes touch web/Electron surfaces, she's the partner who needs to know.

## Ownership Model

**Everyone everywhere** — no hard service boundaries; whoever picks up a task touches whatever it needs. In practice the *gravity* is: Chris → backend, infra, mobile, product; FiFi → design, web frontend, Electron. Treat gravity as "who to ask", not "who is allowed".

## How Decisions Get Made

- **By discussion, jointly** — no formal hierarchy. Conversations happen across Discord, in person / calls, plain texting, and **Spidr itself (dogfooding)**.
- **Self-merge, notify after**: branches + PRs to `master`, but authors merge their own work and share a summary afterwards (the `/cross-check` PLATFORM-IMPACT report is the standard artifact for this). There is no blocking review gate — which makes `/ship`'s security audit and the cross-check summary the de-facto quality gates.

## Non-Code Responsibilities (⚠️ known gap)

Beta recruitment, marketing, legal/ToS, and finances are **handled together ad hoc, and both founders self-describe as clueless here — they actively want help**. Nobody formally owns any of it. This matters *now*, not "soon": real APEX billing shipped in Patch 1.9.25 (see [pricing.md](pricing.md)), so payments / sales tax / PCI-scope questions are live concerns rather than hypothetical, and the closed beta (50-tester funnel, see [goal.md](goal.md)) still needs recruitment + the Beta Testing Agreement to hold up under actual signups. Flag business/legal implications proactively when advising — don't assume someone else is watching that side.

## Practical Implications for Mr. Rimmer

1. Two-person team, no dedicated reviewer → surface risks *before* merge; the summary-after-merge model means bugs ship fast if unflagged.
2. Chris is the primary Claude Code operator; anything written for "the team" should be readable by FiFi without backend context.
3. Cross-platform changes need the FiFi handoff (`/cross-check`) — especially anything touching web UI or Electron, her home turf.
4. Business/legal questions have no expert in the room — explain from first principles and recommend when to pull in outside help.
