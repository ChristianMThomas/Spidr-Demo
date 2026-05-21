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

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,  // Disabled - frontend handles CSP via meta tags
}));
// Explicit CORP header for all responses
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use(morgan('dev'));
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Electron .exe, mobile apps, curl)
    if (!origin) return cb(null, true);

    // In development: allow any localhost port
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return cb(null, true);
    }

    // In production: allow configured CLIENT_ORIGIN + any subdomain of it
    const allowed = process.env.CLIENT_ORIGIN || '';
    const allowedExtra = (process.env.CLIENT_ORIGINS_EXTRA || '').split(',').map(s => s.trim()).filter(Boolean);

    if (allowed && (origin === allowed || origin.endsWith('.' + allowed.replace(/^https?:\/\//, '')))) {
      return cb(null, true);
    }
    if (allowedExtra.includes(origin)) return cb(null, true);

    // Electron packaged apps: file:// origin shows as null, but some show as custom protocol
    if (origin.startsWith('file://') || origin.startsWith('app://')) return cb(null, true);

    cb(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.use('/auth',               require('./routes/auth'));
app.use('/users',              require('./routes/users'));
app.use('/user-profiles',      require('./routes/userProfiles'));
app.use('/servers',            require('./routes/servers'));
app.use('/messages',           require('./routes/messages'));
app.use('/direct-messages',    require('./routes/directMessages'));
app.use('/group-chats',        require('./routes/groupChats'));
app.use('/group-chat-messages',require('./routes/groupChatMessages'));
app.use('/friends',            require('./routes/friends'));
app.use('/voice-sessions',     require('./routes/voiceSessions'));
app.use('/feeds',              require('./routes/feeds'));
app.use('/comments',           require('./routes/comments'));
app.use('/reports',            require('./routes/reports'));
app.use('/audio-tracks',       require('./routes/audioTracks'));
app.use('/clips',              require('./routes/clips'));
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
app.use('/feed-comments',      require('./routes/feedComments'));
app.use('/uploads',            require('express').static(path.join(__dirname, '../uploads')));

// WebRTC ICE config (STUN+TURN) for voice channels
const { getTurnConfig } = require('./socket/voiceSignaling');
app.get('/voice/ice', getTurnConfig);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Socket.io — with optional Redis adapter ───────────────────────────────────
function startSocketIO(withRedis) {
  const io = new Server(server, {
    cors: {
      // Mirror Express CORS: allow no-origin (packaged Electron .exe), localhost, file://, configured origin
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return cb(null, true);
        if (origin.startsWith('file://') || origin.startsWith('app://')) return cb(null, true);
        const allowed = process.env.CLIENT_ORIGIN || '';
        if (allowed && origin === allowed) return cb(null, true);
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
    const { seedDefaultModules } = require('./utils/seedDefaultModules');
    const { seedDefaultBots }    = require('./utils/seedDefaultBots');
    seedDefaultModules();
    seedDefaultBots();
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => console.log(`✓ Spidr server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });
