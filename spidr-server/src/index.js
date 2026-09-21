require('dotenv').config();
const express      = require('express');
const http         = require('http');
const path         = require('path');
const mongoose     = require('mongoose');
const { Server }   = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis        = require('ioredis');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const app    = express();
const server = http.createServer(app);

// Behind Railway's proxy, trust the first X-Forwarded-For hop so req.ip resolves
// to the real client IP. One hop (not `true`) satisfies express-rate-limit's
// permissive-trust-proxy guard.
app.set('trust proxy', 1);

// Single source of truth for "are we live". Several allowances below exist only
// for local development and MUST NOT apply in production.
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  // API-only CSP: this service returns JSON and serves images from /uploads
  // and /public. Nothing renders HTML, so lock everything else down as
  // defense-in-depth (clickjacking, injected-form actions, base-tag hijack).
  // The web client's own document CSP is served as an HTTP header by
  // spidr-client/public/.htaccess (not a meta tag - Electron loads the same
  // index.html over file://, where 'self' is unreliable).
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src':     ["'none'"],
      'img-src':         ["'self'", 'data:'],
      'frame-ancestors': ["'none'"],
      'base-uri':        ["'none'"],
      'form-action':     ["'none'"],
    },
  },
}));
// Explicit CORP header for all responses
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
// The socket layer accepts a ?token= query fallback, and an unmatched
// /socket.io/ polling request still reaches Express - so an unredacted access
// log would write JWTs to stdout and Railway's log store.
morgan.token('safeurl', (req) => String(req.originalUrl || req.url || '')
  .replace(/([?&](?:token|access_token|code|state)=)[^&]*/gi, '$1[redacted]'));
app.use(morgan(':method :safeurl :status :response-time ms - :res[content-length]'));

// ── Production error-message hygiene ────────────────────────────────────────
// ~100 handlers do `res.status(500).json({ error: err.message })`, which leaks
// raw Mongoose/driver text (cast errors, validation paths, field names) to any
// caller. Rather than rewrite every call site, sanitise 5xx bodies here. 4xx
// messages are deliberate and clients branch on some of them
// ('already_exists', 'invalid_status'), so those pass through untouched.
if (IS_PROD) {
  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 500 && body && typeof body === 'object' && 'error' in body) {
        console.error(`[500] ${req.method} ${req.path} - ${body.error}`);
        return json({ error: 'Internal server error' });
      }
      return json(body);
    };
    next();
  });
}
// ── Shared CORS origin allowlist ────────────────────────────────────────────
// One decision function for both Express and Socket.io. These were previously
// two separate copies and had drifted: the Socket.io copy never read
// CLIENT_ORIGINS_EXTRA, so an origin allowed for HTTP was still refused the
// websocket handshake.
function isOriginAllowed(origin) {
  // Requests with no origin (Electron .exe, mobile apps, curl)
  if (!origin) return true;

  // Development only. Ungated, this let any page served from a victim's own
  // localhost make credentialed (credentials: true) requests against the
  // live production API.
  if (!IS_PROD && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    return true;
  }

  // Electron packaged apps: file:// origin shows as null, but some show as custom protocol
  if (origin.startsWith('file://') || origin.startsWith('app://')) return true;

  // In production: allow configured CLIENT_ORIGIN + any subdomain of it
  const allowed = process.env.CLIENT_ORIGIN || '';
  if (allowed && (origin === allowed || origin.endsWith('.' + allowed.replace(/^https?:\/\//, '')))) {
    return true;
  }

  // Explicit extra origins, comma-separated. Lets a local dev client talk to a
  // deployed backend for testing without reopening all of localhost.
  const allowedExtra = (process.env.CLIENT_ORIGINS_EXTRA || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowedExtra.includes(origin)) return true;

  return false;
}

app.use(cors({
  origin: (origin, cb) => {
    if (isOriginAllowed(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
}));
// Stripe webhook MUST be mounted BEFORE express.json — signature verification
// requires the raw request bytes exactly as Stripe sent them. If express.json
// parses first, the buffer is replaced with a JS object and verification fails.
app.use(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  require('./routes/webhooks/stripe'),
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Rate limiting (tiered, per-user) ──────────────────────────────────────────
// Key on the authenticated user when a valid Bearer token is present so abuse
// can't hide behind IP rotation; fall back to IP for unauthenticated requests.
// authMiddleware is per-route, so we verify the token here independently
// (same base64-decoded HS256 secret as middleware/auth.js + socket handlers).
const jwt = require('jsonwebtoken');
const { getSecret } = require('./utils/jwtSecret');
const rateLimitKey = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), getSecret());
      const uid = decoded.userId || decoded.id;
      if (uid) return 'user:' + uid;
    } catch { /* invalid/expired token → fall through to IP */ }
  }
  return 'ip:' + (req.ip || 'unknown');
};

const isUpload = (req) => req.path === '/upload' || req.path.startsWith('/upload/');
const isStaticUpload = (req) => req.path.startsWith('/uploads');
const limiterBase = {
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  validate: false, // custom key handles auth/IP; trust proxy is set explicitly above
};

// Each tier is its own bucket; a request only counts against the tier it matches.
const readLimiter   = rateLimit({ ...limiterBase, max: 300, skip: (req) => req.method !== 'GET' || isStaticUpload(req) });
const writeLimiter  = rateLimit({ ...limiterBase, max: 30,  skip: (req) => !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || isUpload(req) });
const uploadLimiter = rateLimit({ ...limiterBase, max: 10,  skip: (req) => !isUpload(req) });
app.use(readLimiter, writeLimiter, uploadLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
// Legacy /auth router — Spring Boot handles all prod auth (register, login,
// OTP, password reset). Only TOTP-related endpoints still live here because
// Spring Boot doesn't have TOTP yet (AUTH-F3). Everything else is blocked
// with 410 Gone so a client can't bypass Spring Boot MFA/security policy by
// hitting the old Node.js JWT-issuance endpoints.
app.use(
  '/auth',
  (req, res, next) => {
    const allowedLegacy = new Set(['/setup-totp', '/verify-totp-setup', '/disable-totp']);
    if (!allowedLegacy.has(req.path)) {
      return res.status(410).json({
        error: 'endpoint_moved',
        message: 'This auth endpoint has moved to the Spring Boot service. Use AUTH_URL/auth/* instead.',
      });
    }
    next();
  },
  require('./routes/auth'),
);
app.use('/users',              require('./routes/users'));
app.use('/user-profiles',      require('./routes/userProfiles'));
app.use('/servers',            require('./routes/servers'));
app.use('/search-hub',        require('./routes/searchHub'));
app.use('/messages',           require('./routes/messages'));
app.use('/message-actions',    require('./routes/messageActions'));
app.use('/conversation-settings', require('./routes/conversationSettings'));
app.use('/direct-messages',    require('./routes/directMessages'));
app.use('/group-chats',        require('./routes/groupChats'));
app.use('/group-chat-messages',require('./routes/groupChatMessages'));
app.use('/friends',            require('./routes/friends'));
app.use('/voice',              require('./routes/voice'));
app.use('/account',            require('./routes/accountAdmin'));
app.use('/voice-sessions',     require('./routes/voiceSessions'));
app.use('/voice-channels',     require('./routes/djSessions'));
app.use('/feeds',              require('./routes/feeds'));
app.use('/comments',           require('./routes/comments'));
app.use('/reports',            require('./routes/reports'));
app.use('/audio-tracks',       require('./routes/audioTracks'));
app.use('/clips',              require('./routes/clips'));
app.use('/web-messages',       require('./routes/webMessages'));
app.use('/apple-music',        require('./routes/appleMusic'));
app.use('/saved-audio',        require('./routes/savedAudio'));
app.use('/collections',        require('./routes/collections'));
app.use('/community-assets',   require('./routes/communityAssets'));
app.use('/events',             require('./routes/events'));
app.use('/custom-bots',        require('./routes/customBots'));
app.use('/modules',            require('./routes/modules'));
app.use('/installed-modules',  require('./routes/installedModules'));
app.use('/ai-chat-logs',       require('./routes/aiChatLogs'));
app.use('/ai-conversations',   require('./routes/aiConversations'));
app.use('/server-audit-logs',  require('./routes/serverAuditLogs'));
app.use('/upload',             require('./routes/upload'));
app.use('/ai',                 require('./routes/ai'));
app.use('/algorithm',          require('./routes/algorithm'));
app.use('/audio',              require('./routes/audio'));
app.use('/biomass',            require('./routes/biomass'));
app.use('/tension',            require('./routes/tension'));
app.use('/follows',            require('./routes/follows'));
app.use('/feed-comments',      require('./routes/feedComments'));
app.use('/system',             require('./routes/system'));
app.use('/push-tokens',        require('./routes/pushTokens'));
app.use('/weaver',             require('./routes/weaver'));
app.use('/spotify',            require('./routes/spotify'));
app.use('/steam',              require('./routes/steam'));
app.use('/streak',             require('./routes/streak'));
app.use('/payments',           require('./routes/payments'));
app.use('/support',            require('./routes/support'));
app.use('/uploads',            require('express').static(path.join(__dirname, '../uploads')));
// Stable, publicly-fetchable asset URL — needed for the iOS rich-notification
// fallback image (APNs downloads the avatar/logo over plain HTTP; it can't
// reach anything behind auth or bundled into the app).
app.use('/public',             require('express').static(path.join(__dirname, '../public')));

// NOTE: GET /voice/ice is served by the '/voice' router mounted above.
// A second app.get('/voice/ice', getTurnConfig) used to sit here and was
// unreachable - app.use('/voice') already matched the path - so its TURN
// fallback never ran and every client got a STUN-only list. Folded into
// routes/voice.js; do not re-register it here.

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Global error handler ────────────────────────────────────────────────────
// Catches anything thrown outside a route's own try/catch (and the CORS
// rejection above). Without this, Express's default handler renders a stack
// trace into the response body whenever NODE_ENV isn't 'production'.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || (/Not allowed by CORS/.test(err.message || '') ? 403 : 500);
  if (status >= 500) console.error(`[error] ${req.method} ${req.path} -`, err.message);
  res.status(status).json({
    error: status >= 500 && IS_PROD ? 'Internal server error' : (err.message || 'Error'),
  });
});

// ── Socket.io — with optional Redis adapter ───────────────────────────────────
function startSocketIO(withRedis) {
  const io = new Server(server, {
    cors: {
      // Exactly the Express allowlist - see isOriginAllowed above.
      origin: (origin, cb) => {
        if (isOriginAllowed(origin)) return cb(null, true);
        cb(new Error('Socket.io: origin not allowed: ' + origin));
      },
      credentials: true,
    },
    maxHttpBufferSize: 5e6,
  });
  app.set('io', io);
  if (withRedis) {
    const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    io.adapter(createAdapter(pub, sub));
    console.log('✓ Socket.io + Redis adapter ready');
  } else {
    console.log('✓ Socket.io ready (no Redis — single instance mode)');
  }
  require('./socket/handlers')(io);

  // Add nerve-center room handler — server-side admin check required
  const User = require('./models/User');
  io.on('connection', (socket) => {
    socket.on('join:nerve-center', async () => {
      try {
        const user = await User.findById(socket.userId).select('role').lean();
        if (user?.role === 'admin') {
          socket.join('nerve-center-telemetry');
        }
      } catch { /* deny silently */ }
    });
    socket.on('leave:nerve-center', () => {
      socket.leave('nerve-center-telemetry');
    });
  });

  // Start real-time telemetry broadcast
  require('./services/telemetryManager').start(io);
}

// Try Redis; if it errors or times out, fall back to no-Redis mode
const testRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
let socketStarted = false; // guard against double-start

function maybeStartSocketIO(withRedis) {
  if (socketStarted) return;
  socketStarted = true;
  testRedis.quit().catch(() => {});
  startSocketIO(withRedis);
}

testRedis.on('ready', () => maybeStartSocketIO(true));
testRedis.on('error', () => maybeStartSocketIO(false));

// Guarantee startup even if Redis never responds within 2 seconds
setTimeout(() => maybeStartSocketIO(false), 2000);

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/spidr')
  .then(() => {
    console.log('✓ MongoDB connected');
    // Seed defaults — idempotent, safe to run on every start
    const { seedDefaultModules }     = require('./utils/seedDefaultModules');
    const { seedDefaultBots }        = require('./utils/seedDefaultBots');
    const { syncInstallCounts }      = require('./utils/syncInstallCounts');
    const { cleanupRemovedModules }  = require('./utils/cleanupRemovedModules');
    cleanupRemovedModules();
    seedDefaultModules();
    seedDefaultBots();
    syncInstallCounts();
    // Auto-expire past server events (3.3) — runs on boot + every 6h.
    const { scheduleEventExpiry } = require('./utils/expireEvents');
    scheduleEventExpiry();
    // Give any legacy tagless profile a real #tag (idempotent).
    const { backfillDiscriminators } = require('./utils/backfillDiscriminators');
    backfillDiscriminators();
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => console.log(`✓ Spidr server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });
