# Spidr Beta Cost & Scaling Analysis

**Date:** May 2025
**Scenario:** 50-user closed beta on current infrastructure

---

## Current Infrastructure Costs (Monthly Estimates)

| Service | Provider | Est. Cost (50 users) |
|---|---|---|
| spidr-server (Node.js/Express) | Railway | $20–30 |
| spidr-auth (Spring Boot/JVM) | Railway | $5–10 |
| MongoDB Atlas | Free tier | $0 (but at risk — see below) |
| Cloudflare R2 (file storage) | Cloudflare | ~$0–5 (depends on uploads) |
| **Total** | | **~$30–50/month** |

## The Problem: Aggressive Polling

The client currently uses HTTP polling (repeated timed requests) instead of relying on our existing Socket.io real-time connection for most data updates. This means every connected user generates a high volume of background requests even while idle.

### Per-User Request Breakdown (Idle)

| Feature Area | Poll Interval | Requests/min |
|---|---|---|
| Chat (KineticChat, 2 queries) | Every 2s | 60 |
| Direct Messages | Every 2s | 30 |
| Community Panel | Every 3s | 20 |
| Mini Chat | Every 3s | 20 |
| Voice Channel | Every 4s | 15 |
| Active Call Tether | Every 5s (doubled) | 24 |
| Pulse Deck (2 queries) | Every 5–10s | 18 |
| Signal Requests, Audit Log, Feed | Every 10s | 18 |
| Servers Panel (2 queries) | Every 15s | 8 |
| Sidebar, Nerve Center, Friends | Every 20–60s | ~10 |
| App heartbeat ping | Every 25s | 2.4 |

**Estimated total: 100–150 requests/min per user** (not all components mount at once, but a user with chat + servers + DMs open easily hits this range).

### Scaled to 50 Users

| Metric | Value |
|---|---|
| Requests per minute | 5,000 – 7,500 |
| Requests per hour | 300,000 – 450,000 |
| Requests per day | 7 – 10 million |

## Biggest Risk: MongoDB Atlas Free Tier

Railway compute costs are manageable at this scale. The real bottleneck is **MongoDB Atlas free tier (M0)**:

- **500 connection limit** — each poll opens or reuses a connection; 50 users with high-frequency polling will push this
- **Limited IOPS** — 7–10M reads/day will likely trigger throttling
- **No performance guarantees** — Atlas can throttle or reject queries under load

**This will likely be the first thing that breaks during beta.**

## Recommended Fix: Socket-Driven Invalidation

We already have Socket.io running for real-time features (messages, presence, voice). The fix is to replace high-frequency polls with socket event listeners that trigger query refreshes only when data actually changes.

**Example (chat messages today):**
```
refetchInterval: 2000  →  60 requests/min/user, most returning unchanged data
```

**Example (after fix):**
```
socket.on('new-message') → invalidate query  →  only fetches when a message actually arrives
```

### Impact

- **80–90% reduction** in HTTP request volume
- Lower MongoDB load, well within free tier limits
- App feels **more responsive** (instant updates vs. up to 2s delay)
- Scales comfortably past 100+ users without infrastructure changes

### Priority Order for Conversion

1. **KineticChat** (2s poll, highest volume)
2. **DirectMessages** (2s poll)
3. **CommunityPanel / MiniChat** (3s poll)
4. **VoiceChannel / ActiveCallTether** (4–5s poll)
5. Everything else (10s+ polls are lower urgency)

## Decision Points

1. **Do we upgrade Atlas before beta?** M2/M5 shared clusters start at ~$9–25/month and remove the connection/IOPS ceiling.
2. **Do we fix polling before beta?** This is the right long-term fix but requires dev time. Could run beta on upgraded Atlas as a stopgap.
3. **Railway spend ceiling** — set a spending alert at $50/month to catch surprises early.

## Summary

Railway costs at 50 users are reasonable ($30–50/month). The risk is that our polling pattern overwhelms MongoDB Atlas free tier. The sustainable fix is converting high-frequency polls to socket-driven updates, which we're already architecturally set up to do. Short-term, upgrading Atlas to a paid shared tier buys us runway for beta without code changes.
