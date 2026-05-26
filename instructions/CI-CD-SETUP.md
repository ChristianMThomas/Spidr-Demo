# CI/CD Setup Guide

## Environments

| Environment | Frontend | Backend trigger |
|---|---|---|
| **Local** | `localhost:5173` | run manually in terminal |
| **Dev/Staging** | `spidrapp.infinitetechteam.com` | push to `dev` |
| **Production** | `spidrapp.com` | push to `master` |

---

## Overview

| Service | Mechanism | Dev trigger | Prod trigger |
|---|---|---|---|
| **spidr-server** (Node.js) | Railway GitHub integration | push to `dev` | push to `master` |
| **spidr-auth** (Spring Boot) | Railway GitHub integration | push to `dev` | push to `master` |
| **spidr-client** (React) | GitHub Actions → Hostinger FTP | push to `dev` | push to `master` |

---

## Step 1 — Wire Railway to GitHub (both backends)

Railway supports this natively — no workflow file needed.

1. Go to each Railway service → **Settings → Source**
2. Connect your GitHub repo
3. Set **Deploy Branch** = `dev` for your dev environment, `master` for prod
4. Railway auto-deploys on every push to that branch

You need **two Railway projects** (or two environments within one project): one for dev, one for prod. Each has its own env vars:

**Dev Railway env vars (CLIENT_ORIGIN)**
```
CLIENT_ORIGIN=https://spidrapp.infinitetechteam.com
```

**Prod Railway env vars (CLIENT_ORIGIN)**
```
CLIENT_ORIGIN=https://spidrapp.com
```

---

## Step 2 — Add a Staging Env File for the Client

You currently have `.env.development` (localhost) and `.env.production`. Add a third for the deployed dev environment:

**`spidr-client/.env.staging`**
```
VITE_API_URL=https://your-dev-node-service.up.railway.app
VITE_WS_URL=https://your-dev-node-service.up.railway.app
VITE_AUTH_URL=https://auth.spidrapp.infinitetechteam.com
```

Replace the Node.js URL with your actual Railway dev service URL.

Also update **`spidr-client/.env.production`** to use the prod domain auth URL once `auth.spidrapp.com` is set up:
```
VITE_API_URL=https://api.spidrapp.com
VITE_WS_URL=https://api.spidrapp.com
VITE_AUTH_URL=https://auth.spidrapp.com
```

---

## Step 3 — GitHub Actions Workflows

Create three files under `.github/workflows/`:

### `ci.yml` — PR build check
Runs on every pull request. Catches lint errors and build failures before merge.

```yaml
name: CI

on:
  pull_request:
    branches: [dev, master]

jobs:
  build-check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: spidr-client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: spidr-client/package-lock.json
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL_STAGING }}
          VITE_WS_URL: ${{ secrets.VITE_WS_URL_STAGING }}
          VITE_AUTH_URL: ${{ secrets.VITE_AUTH_URL_STAGING }}
```

### `deploy-dev.yml` — Deploy to `spidrapp.infinitetechteam.com` on push to `dev`

```yaml
name: Deploy — Dev (spidrapp.infinitetechteam.com)

on:
  push:
    branches: [dev]

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: spidr-client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: spidr-client/package-lock.json
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL_STAGING }}
          VITE_WS_URL: ${{ secrets.VITE_WS_URL_STAGING }}
          VITE_AUTH_URL: ${{ secrets.VITE_AUTH_URL_STAGING }}
          VITE_SPOTIFY_CLIENT_ID: ${{ secrets.VITE_SPOTIFY_CLIENT_ID }}
      - name: Deploy to Hostinger (dev)
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.HOSTINGER_FTP_HOST }}
          username: ${{ secrets.HOSTINGER_FTP_USER_DEV }}
          password: ${{ secrets.HOSTINGER_FTP_PASSWORD_DEV }}
          local-dir: spidr-client/dist/
          server-dir: /public_html/   # root of spidrapp.infinitetechteam.com
```

### `deploy-prod.yml` — Deploy to `spidrapp.com` on push to `master`

```yaml
name: Deploy — Production (spidrapp.com)

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # enables manual approval gate in GitHub
    defaults:
      run:
        working-directory: spidr-client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: spidr-client/package-lock.json
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL_PROD }}
          VITE_WS_URL: ${{ secrets.VITE_WS_URL_PROD }}
          VITE_AUTH_URL: ${{ secrets.VITE_AUTH_URL_PROD }}
          VITE_SPOTIFY_CLIENT_ID: ${{ secrets.VITE_SPOTIFY_CLIENT_ID }}
      - name: Deploy to Hostinger (production)
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.HOSTINGER_FTP_HOST_PROD }}
          username: ${{ secrets.HOSTINGER_FTP_USER_PROD }}
          password: ${{ secrets.HOSTINGER_FTP_PASSWORD_PROD }}
          local-dir: spidr-client/dist/
          server-dir: /public_html/   # root of spidrapp.com
```

> The `environment: production` line enables GitHub's manual approval gate. Go to **Repo → Settings → Environments → production** and add required reviewers — someone must click Approve before the deploy runs.

---

## Step 4 — GitHub Repository Secrets

Add these under **Repo → Settings → Secrets and variables → Actions**:

### Dev / Staging (`spidrapp.infinitetechteam.com`)

| Secret | Value |
|---|---|
| `HOSTINGER_FTP_HOST` | FTP hostname for infinitetechteam.com hosting |
| `HOSTINGER_FTP_USER_DEV` | FTP username for dev site |
| `HOSTINGER_FTP_PASSWORD_DEV` | FTP password for dev site |
| `VITE_API_URL_STAGING` | Railway dev Node.js service URL |
| `VITE_WS_URL_STAGING` | Same as above |
| `VITE_AUTH_URL_STAGING` | `https://auth.spidrapp.infinitetechteam.com` |

### Production (`spidrapp.com`)

| Secret | Value |
|---|---|
| `HOSTINGER_FTP_HOST_PROD` | FTP hostname for spidrapp.com hosting |
| `HOSTINGER_FTP_USER_PROD` | FTP username for prod site |
| `HOSTINGER_FTP_PASSWORD_PROD` | FTP password for prod site |
| `VITE_API_URL_PROD` | Railway prod Node.js service URL |
| `VITE_WS_URL_PROD` | Same as above |
| `VITE_AUTH_URL_PROD` | `https://auth.spidrapp.com` |

### Shared

| Secret | Value |
|---|---|
| `VITE_SPOTIFY_CLIENT_ID` | Spotify client ID (if used) |

---

## Final Flow

```
PR opened
  └── ci.yml runs → build check must pass before merge

Push to dev
  └── Railway auto-deploys spidr-server + spidr-auth (dev Railway environments)
  └── deploy-dev.yml → builds React (staging vars) → FTP to spidrapp.infinitetechteam.com

Push to master
  └── Railway auto-deploys spidr-server + spidr-auth (prod Railway environments)
  └── deploy-prod.yml → waits for manual approval → builds React (prod vars) → FTP to spidrapp.com
```
