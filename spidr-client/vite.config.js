import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ── Dev-only reverse proxy to deployed backends ─────────────────────────────
// Set SPIDR_PROXY_API (and optionally SPIDR_PROXY_AUTH) in .env.development.local
// to test the local client against a deployed backend. The browser then talks
// only to localhost:5173, so no CORS preflight is involved at all, and Vite
// forwards each call from Node with the Origin header removed - the same
// "no origin" path the packaged Electron app already uses. Without those vars
// set, this block is inert and dev behaves exactly as before.
//
// Why not just allowlist localhost on the deployed service: that reopens
// credentialed access from any page on any user's machine.
function buildProxy(env) {
  const apiTarget = env.SPIDR_PROXY_API
  const authTarget = env.SPIDR_PROXY_AUTH || apiTarget
  if (!apiTarget) return undefined

  // http-proxy forwards the browser's Origin by default, which would land us
  // right back in the CORS check we are trying to avoid.
  const stripOrigin = (proxy) => {
    proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
    proxy.on('proxyReqWs', (proxyReq) => proxyReq.removeHeader('origin'))
  }

  return {
      '/__api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__api/, ''),
        configure: stripOrigin,
      },
      '/__auth': {
        target: authTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__auth/, ''),
        configure: stripOrigin,
      },
      // socket.io-client is configured with transports: ['websocket'], so this
      // must upgrade rather than proxy plain HTTP polling.
      '/socket.io': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
        configure: stripOrigin,
      },
    }
  }

  export default defineConfig(({ mode }) => {
    // '' prefix: load non-VITE_ vars too. These stay server-side in the Vite
    // process and are never exposed to client code.
    const env = loadEnv(mode, process.cwd(), '')

    return {
    // './' base is needed for Electron packaged builds (file:// protocol)
    // In dev mode this is fine since Vite serves from root anyway
    base: './',

    plugins: [react()],

    resolve: {
      alias: { '@': path.resolve(__dirname, './src') }
    },

    server: {
      port: 5173,
      host: 'localhost',
      strictPort: true,
      // Allow cross-origin requests (fixes ERR_BLOCKED_BY_RESPONSE in dev)
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
      cors: true,
      proxy: buildProxy(env),
    },

    // `vite preview` serves the production bundle. It gets the same
    // Origin-stripping proxy as dev, because the deployed backends reject a
    // localhost Origin outright (403) — the only way to exercise a real prod
    // build against them from a browser is to forward from Node with no Origin.
    preview: {
      port: 4173,
      host: 'localhost',
      strictPort: true,
      proxy: buildProxy(env),
    },

    optimizeDeps: {
      include: [
        'react', 'react-dom', 'react-router-dom',
        'framer-motion', 'socket.io-client',
      ]
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
            ui:     ['lucide-react'],
            radix:  [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-tabs',
              '@radix-ui/react-select',
            ],
          }
        }
      }
    }
  }
})
