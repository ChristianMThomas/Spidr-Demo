# Spidr Beta Landing — Architecture & Implementation Plan

## Overview

`spidr-landing` is a standalone Vite + React + TypeScript static site. It is **not** part of
`spidr-client` and has no connection to `spidrapp.infinitetechteam.com`. It is Phase 1 of
the real production environment at `spidrapp.com`.

---

## Environment Map

| Environment | Domain | Infra | Purpose |
|---|---|---|---|
| Local | `localhost` | — | Development |
| Dev / Test | `spidrapp.infinitetechteam.com` | Hostinger + Railway | All feature work, testing |
| **Prod Phase 1** | **`spidrapp.com`** | **Hostinger + Railway** | Beta signup landing only |
| Prod Phase 2 | `spidrapp.com` | Hostinger + Railway | Full app (future) |

`spidr-landing` deploys to Hostinger under `spidrapp.com` — completely separate from the
`infinitetechteam.com` setup.

---

## Beta Signup Form — How It Works

When a user fills out the beta form:
1. Frontend calls `POST /signup` on `spidr-beta-api` (new Railway service)
2. `spidr-beta-api` stores the signup in MongoDB Atlas (same cluster, new collection `betasignups`)
3. `spidr-beta-api` sends a confirmation email via **Resend** from `noreply@spidrapp.com`
4. Frontend shows the success screen

---

## New Service: `spidr-beta-api`

A minimal standalone Node.js + Express service (~50 lines). Deployed as its own Railway
service — this is the **first service in the production Railway project**.

### Endpoints

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/signup` | `{ fullName, email }` | Store signup + send confirmation email |
| `GET` | `/health` | — | Health check |

### Environment Variables (Railway)

```
MONGO_URI=<same Atlas URI as spidr-server>
RESEND_API_KEY=<from resend.com dashboard>
FROM_EMAIL=noreply@spidrapp.com
NODE_ENV=production
PORT=3000
```

### Rate Limiting

- 3 requests per hour per IP on `POST /signup`
- Deduplication: reject duplicate emails with a friendly message (not an error)

---

## Email: Resend Setup

Resend sends transactional email from a verified custom domain. It replaces Gmail/nodemailer
for all `spidrapp.com` branded emails.

### Why Resend over nodemailer + Gmail

- Sends from `noreply@spidrapp.com` (not a Gmail address)
- No spam filter issues — domain-verified, proper SPF/DKIM/DMARC
- Free tier: 3,000 emails/month, 100/day — sufficient for beta
- Simple API: one `POST` to `api.resend.com/emails`, no SMTP config

### Domain Verification Steps (GoDaddy)

1. Create a free account at [resend.com](https://resend.com)
2. Go to **Domains** → Add Domain → enter `spidrapp.com`
3. Resend gives you DNS records to add — typically:
   - `TXT` record for SPF
   - `CNAME` records for DKIM (usually 2–3)
   - `TXT` record for DMARC (optional but recommended)
4. In GoDaddy: **DNS → Add New Record** for each one
5. Click **Verify** in Resend — usually propagates within 5–30 minutes
6. Once verified, you can send from any address `@spidrapp.com`

### Confirmation Email Content

Subject: `You're on the Spidr beta list.`
From: `Spidr <noreply@spidrapp.com>`
Body: Branded HTML — confirms their spot, tells them they'll hear from us at launch.

---

## spidr-landing Changes

### New file: `spidr-landing/.env.production`
```
VITE_BETA_API_URL=https://<spidr-beta-api-railway-url>
```

### `BetaSignupModal.tsx` change

Replace the fake `setTimeout` stub (line 67) with a real fetch:
```ts
const res = await fetch(`${import.meta.env.VITE_BETA_API_URL}/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fullName, email }),
});
if (!res.ok) throw new Error('signup failed');
setFormState("success");
```

Add an error state so the form doesn't silently fail if the API is down.

---

## Deployment Order

1. **Resend** — verify `spidrapp.com` domain in GoDaddy (DNS records)
2. **MongoDB Atlas** — no changes needed; `betasignups` collection auto-creates on first write
3. **Railway** — create new project `spidr-prod`, add service `spidr-beta-api`, set env vars
4. **spidr-landing** — add `.env.production`, update `BetaSignupModal.tsx`, build + deploy to Hostinger at `spidrapp.com`

---

## Files to Create / Modify

| File | Action |
|---|---|
| `spidr-beta-api/` | Create — new Node.js service |
| `spidr-beta-api/src/index.js` | Express app, `/signup` + `/health` routes |
| `spidr-beta-api/src/mailer.js` | Resend email helper |
| `spidr-beta-api/package.json` | `express`, `mongoose`, `resend`, `express-rate-limit` |
| `spidr-landing/.env.production` | Add `VITE_BETA_API_URL` |
| `spidr-landing/.env.development` | Add `VITE_BETA_API_URL=http://localhost:3001` |
| `spidr-landing/src/app/components/BetaSignupModal.tsx` | Replace fake stub with real fetch |

---

## Notes

- `spidr-beta-api` lives in the monorepo under `spidr-app/spidr-beta-api/` but is deployed
  independently on Railway with no relation to `spidr-server`.
- When Prod Phase 2 launches (full app at `spidrapp.com`), the beta signup collection in Atlas
  already has early access emails ready to use.
- The Resend domain setup is a one-time step. Once `spidrapp.com` is verified, all future
  production emails (OTP, notifications, etc.) can also use Resend instead of Gmail/nodemailer.
