import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
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
  },

  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom',
      'framer-motion', 'axios', 'socket.io-client',
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
})
