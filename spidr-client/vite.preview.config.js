// Local-only helper (user-approved): serves the production build at
// http://localhost:4173 and forwards API / auth / socket traffic to the
// PRODUCTION backends so the prod bundle can be exercised from a browser.
//
// Production CORS deliberately rejects localhost origins, so the browser
// cannot call prod directly. This proxy handles it the same way the packaged
// desktop app does: it drops the browser's Origin header, so the forwarded
// request arrives with no Origin — the case both backends already allow
// (curl, Electron, mobile). No production config is changed and no allowed
// origin is impersonated.
//
// Not referenced by any build script. Delete freely.
import base from './vite.config.js';

const PROD_API = 'https://cooperative-simplicity-production-bb44.up.railway.app';
const PROD_AUTH = 'https://auth.spidrapp.infinitetechteam.com';

const dropBrowserOrigin = (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
  });
  // The websocket upgrade is a separate request and does not pass through
  // 'proxyReq'. Without this the socket.io upgrade still carries the localhost
  // Origin, prod rejects it with a 400 and the client silently degrades to
  // long-polling.
  proxy.on('proxyReqWs', (proxyReq) => {
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
  });
};

export default {
  ...base,
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/prod-auth': {
        target: PROD_AUTH,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/prod-auth/, ''),
        configure: dropBrowserOrigin,
      },
      '/socket.io': {
        target: PROD_API,
        changeOrigin: true,
        ws: true,
        configure: dropBrowserOrigin,
      },
      '/prod-api': {
        target: PROD_API,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/prod-api/, ''),
        configure: dropBrowserOrigin,
      },
    },
  },
};
