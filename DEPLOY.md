# 🚀 Spidr Production Deployment Guide

## Step 1: Deploy Backend to Render.com (Free)

1. Push `spidr-server/` to a GitHub repository
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
   - **Environment:** Node

5. Set Environment Variables in Render dashboard:
```
MONGO_URI=mongodb+srv://spidradmin:PASSWORD@cluster.mongodb.net/spidr
JWT_SECRET=your-256-bit-secret
PORT=10000
NODE_ENV=production
CLIENT_ORIGIN=https://your-app-name.onrender.com
REDIS_URL=redis://default:PASSWORD@redis-host:port  (optional)
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
SPOTIFY_CLIENT_ID=your_spotify_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
SERVER_URL=https://your-api-name.onrender.com
```

6. Deploy → copy the live URL (e.g. `https://spidr-api.onrender.com`)

---

## Step 2: Update Frontend Config

Edit `spidr-client/.env.production`:
```
VITE_API_URL=https://spidr-api.onrender.com
VITE_WS_URL=https://spidr-api.onrender.com
```

---

## Step 3: Build the .exe

```batch
cd spidr-client
npm install
build-windows.bat
```

Output: `dist_installer/SpidrSetup-1.0.0.exe`

The compiled `.exe` will connect to your live Render server automatically.

---

## Alternative Hosting

| Provider | Free Tier | WebSocket | Notes |
|---|---|---|---|
| **Render** | ✅ 750h/mo | ✅ | Sleeps after 15min inactive |
| **Railway** | ✅ $5 credit | ✅ | Best DX, auto-deploy |
| **Fly.io** | ✅ 3 VMs | ✅ | Best performance |
| **Azure App Service** | B1 free trial | ✅ | Enterprise grade |

For best results with Socket.io, use **Railway** or **Fly.io** — they don't sleep.

---

## MongoDB Atlas (Free Tier Setup)

1. [atlas.mongodb.com](https://cloud.mongodb.com) → Create free M0 cluster
2. Database Access → Add user `spidradmin`
3. Network Access → Allow `0.0.0.0/0` (all IPs)
4. Connect → Drivers → copy `mongodb+srv://...` connection string

---

## Spotify Setup (Optional)

1. [developer.spotify.com](https://developer.spotify.com) → Create App
2. Copy Client ID + Client Secret to server `.env`
3. Music search in THE WEB will use real Spotify data with 30s previews

Without Spotify keys, music search falls back to your own uploaded audio tracks.
