# Spidr — Launch Instructions

## Prerequisites

- **Node.js** v18+ installed
- **MongoDB** running locally (`mongod`) OR a MongoDB Atlas connection string
- Two terminal windows open at the same time

---

## First-Time Setup

### 1. Set up the backend environment

```bash
cd spidr-server
cp .env.example .env
```

Then open `spidr-server/.env` and set at minimum:

```
MONGO_URI=mongodb://localhost:27017/spidr
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
PORT=4000
```

### 2. Install dependencies (only needed once)

**Backend:**
```bash
cd spidr-server
npm install
```

**Frontend:**
```bash
cd spidr-client
npm install
```

---

## Running the App (Every Time)

You need **two terminals** running simultaneously.

### Terminal 1 — Backend Server

```bash
cd spidr-server
npm run dev
```

Expected output:
```
✓ MongoDB connected
✓ Spidr server running on port 4000
```

Keep this terminal open.

### Terminal 2 — Frontend (Web)

```bash
cd spidr-client
npm run dev
```

Expected output:
```
  VITE v6.x.x  ready in 1234 ms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

> **Note:** OTP codes (for 2FA login) are printed directly in the backend terminal when no email is configured — just copy the code from Terminal 1.

---

## Running as a Desktop App (Electron)

With both Terminal 1 and Terminal 2 already running, open a **third terminal**:

```bash
cd spidr-client
npm run electron-dev
```

This launches the Electron desktop window pointing at `http://localhost:5173`.

---

## Video/Audio Processing (Optional — FFmpeg Worker)

Required for video trimming and audio processing features. Open an additional terminal:

```bash
cd spidr-server
npm run worker
```

Keep this terminal open while using video/audio features. Without it those features will silently fail.

---

## Building the Windows .exe

### Method 1 — Batch file (easiest, no terminal needed)

Double-click:
```
spidr-client\build-windows.bat
```

### Method 2 — PowerShell

Right-click `spidr-client\build-windows.ps1` → "Run with PowerShell"

If you see a policy error, first run this once in PowerShell:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Method 3 — Terminal

```bash
cd spidr-client
npm install
npm run build-exe
```

Output file: `spidr-client/dist_installer/SpidrSetup-1.0.0.exe`

> Windows SmartScreen may block the .exe since it's unsigned — click "More info" → "Run anyway".

---

## Full Terminal Summary (Quick Reference)

| What | Directory | Command |
|---|---|---|
| Backend server | `spidr-server` | `npm run dev` |
| Frontend (web) | `spidr-client` | `npm run dev` |
| Electron desktop | `spidr-client` | `npm run electron-dev` |
| FFmpeg worker | `spidr-server` | `npm run worker` |
| Build .exe | `spidr-client` | `npm run build-exe` |
| Install deps (backend) | `spidr-server` | `npm install` |
| Install deps (frontend) | `spidr-client` | `npm install` |

---

## Common Errors

| Error | Fix |
|---|---|
| `localhost:5173 refused to connect` | Run `npm run dev` in `spidr-client` |
| `Cannot connect to MongoDB` | Start MongoDB: run `mongod` in a new terminal, or use Atlas |
| `Something went wrong` on login | Make sure the backend is running on port 4000 |
| OTP code not arriving | Check Terminal 1 — the code is printed there in dev mode |
| `Cannot create symbolic link` | Use `build-windows.bat` instead of `npm run build-exe` directly |
| Windows SmartScreen blocks the .exe | Click "More info" then "Run anyway" (app is unsigned) |