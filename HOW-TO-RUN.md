# How to Run Spidr

## ⚡ Every Time You Want to Use the App

You need **two terminals** open at the same time.

---

### Terminal 1 — Start the Backend Server

```
cd spidr-server
npm install         (only needed first time)
npm run dev
```

You should see:
```
✓ MongoDB connected
✓ Spidr server running on port 4000
```

**Keep this terminal open.**

---

### Terminal 2 — Start the Frontend

```
cd spidr-client
npm install         (only needed first time)
npm run dev
```

You should see:
```
  VITE v6.x.x  ready in 1234 ms
  ➜  Local:   http://localhost:5173/
```

Now open **http://localhost:5173** in your browser.

---

## 🖥 Build the .exe (Windows)

**Method 1 — Batch file (easiest):**
1. Double-click `spidr-client\build-windows.bat`

**Method 2 — PowerShell:**
1. Right-click `spidr-client\build-windows.ps1`
2. Click "Run with PowerShell"
   - If it says "cannot be loaded", first run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**Method 3 — Command Prompt:**
```
cd spidr-client
npm install
npm run build-exe
```

Output: `spidr-client\dist_installer\SpidrSetup-1.0.0.exe`

---

## ❗ Common Errors

| Error | Fix |
|---|---|
| `localhost:5173 refused to connect` | You haven't run `npm run dev` in the spidr-client folder |
| `Cannot connect to MongoDB` | Start MongoDB: run `mongod` in a new terminal, or use MongoDB Atlas |
| `Cannot create symbolic link` | Use `build-windows.bat` instead of `npm run build-exe` directly |
| `Something went wrong` on login | Make sure the backend server is running on port 4000 |
| OTP code not arriving | Check server terminal — the code is printed there in dev mode |

---

## 🔑 Minimum .env for spidr-server

```
MONGO_URI=mongodb://localhost:27017/spidr
JWT_SECRET=any-long-random-string-here
PORT=4000
```
