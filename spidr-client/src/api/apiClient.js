const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:8080';

// ─── Auth-service fetch wrapper (points at Spring Boot on AUTH_URL) ───────────
async function authRequest(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('spidr_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(AUTH_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('spidr_token');
    window.dispatchEvent(new Event('spidr:auth-expired'));
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request(method, path, { params, body, isFormData } = {}) {
  let url = BASE_URL + path;

  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += '?' + qs;
  }

  const headers = {};
  const token = localStorage.getItem('spidr_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('spidr_token');
    window.dispatchEvent(new Event('spidr:auth-expired'));
  }

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

const api = {
  get:    (path, opts)  => request('GET',    path, opts),
  post:   (path, body)  => request('POST',   path, { body }),
  patch:  (path, body)  => request('PATCH',  path, { body }),
  delete: (path)        => request('DELETE', path),
  upload: (path, formData) => request('POST', path, { body: formData, isFormData: true }),
};

// ─── Entity CRUD factory ─────────────────────────────────────────────────────
const entity = (path) => ({
  list: (orderBy, limit) => {
    const params = {};
    if (orderBy) params._orderBy = orderBy;
    if (limit)   params._limit   = limit;
    return api.get(`/${path}`, { params });
  },
  filter: (query, orderBy, limit) => {
    const params = { ...query };
    if (orderBy) params._orderBy = orderBy;
    if (limit)   params._limit   = limit;
    return api.get(`/${path}`, { params });
  },
  get:    (id)       => api.get(`/${path}/${id}`),
  create: (data)     => api.post(`/${path}`, data),
  update: (id, data) => api.patch(`/${path}/${id}`, data),
  delete: (id)       => api.delete(`/${path}/${id}`),
});

export const entities = {
  User:             entity('users'),
  UserProfile:      entity('user-profiles'),
  Friend:           entity('friends'),
  Server: {
    ...entity('servers'),
    // POST /servers/:id/invite → { invite_code, invite_url }
    generateInvite: (id, rotate = false) =>
      api.post(`/servers/${id}/invite`, { rotate }),
    // POST /servers/join → { id, name, already_member }
    joinByCode: (invite_code, user) =>
      api.post('/servers/join', {
        invite_code,
        user_name: user?.full_name || user?.username || user?.display_name || 'User',
        user_avatar: user?.avatar_url || '',
      }),
    // GET /servers/lookup/:code → { id, name, description, icon_url, banner_url, member_count }
    lookupByCode: (code) => api.get(`/servers/lookup/${code}`),
  },
  Message:          entity('messages'),
  DirectMessage:    entity('direct-messages'),
  GroupChat:        entity('group-chats'),
  GroupChatMessage: entity('group-chat-messages'),
  VoiceSession:     entity('voice-sessions'),
  Feed:             entity('feeds'),
  FeedComment:      entity('feed-comments'),
  Comment:          entity('comments'),
  Report:           entity('reports'),
  AudioTrack:       entity('audio-tracks'),
  Clip:             entity('clips'),
  SavedAudio:       entity('saved-audio'),
  Collection:       entity('collections'),
  CommunityAsset:   entity('community-assets'),
  Event:            entity('events'),
  CustomBot:        entity('custom-bots'),
  Module:           entity('modules'),
  InstalledModule:  entity('installed-modules'),
  AIChatLog:        entity('ai-chat-logs'),
  AIConversation:   entity('ai-conversations'),
  ServerAuditLog:   entity('server-audit-logs'),
};

// ─── Auth (Spring Boot spidr-auth on AUTH_URL) ───────────────────────────────
export const auth = {
  // POST /auth/login → {token, expiresIn}
  login: (email, password) =>
    authRequest('POST', '/auth/login', { email, password }),

  // POST /auth/signup → {message}
  // Normalised → {requiresVerification: true, email} so AuthContext shows OTP screen
  register: async ({ email, password, username }) => {
    await authRequest('POST', '/auth/signup', { email, password, username });
    return { requiresVerification: true, email };
  },

  // POST /auth/verify — Spring Boot field is 'verificationCode', not 'otp'
  // Returns {token, expiresIn}
  verifyOTP: (email, otp) =>
    authRequest('POST', '/auth/verify', { email, verificationCode: otp }),

  // POST /auth/resend — body {email}
  resendOTP: (email) =>
    authRequest('POST', '/auth/resend', { email }),

  // GET /users/me → {id, username, email, role, enabled}
  me: () => authRequest('GET', '/users/me'),

  // PATCH /users/change-password
  changePassword: (data) =>
    authRequest('PATCH', '/users/change-password', data),

  // POST /auth/forgot-password → {message}
  // Normalised → {method: 'email'} so LoginPage ForgotPassword component works
  overrideRequest: async (email) => {
    await authRequest('POST', '/auth/forgot-password', { email });
    return { method: 'email' };
  },

  // POST /auth/verify-reset-code — Spring Boot field is 'resetCode', not 'code'
  // Normalised → {resetToken: email} so ForgotPassword can identify the user in overrideConfirm
  overrideVerify: async (email, code, _method) => {
    await authRequest('POST', '/auth/verify-reset-code', { email, resetCode: code });
    return { resetToken: email };
  },

  // POST /auth/reset-password — resetToken IS the email (set by overrideVerify above)
  overrideConfirm: (resetToken, newPassword) =>
    authRequest('POST', '/auth/reset-password', { email: resetToken, newPassword }),

  // TOTP — AUTH-F3 is still open; keep pointing to Node.js until Spring Boot adds it
  setupTotp:       ()        => api.post('/auth/setup-totp'),
  verifyTotpSetup: (token)   => api.post('/auth/verify-totp-setup', { token }),
  disableTotp:     ()        => api.post('/auth/disable-totp'),

  // devGetOtp — no Spring Boot equivalent; silently return null (LoginPage handles this)
  devGetOtp: () => Promise.resolve(null),

  logout: () => { localStorage.removeItem('spidr_token'); },
  redirectToLogin: () => { localStorage.removeItem('spidr_token'); window.location.reload(); },
};

// ─── Integrations ────────────────────────────────────────────────────────────
export const integrations = {
  Core: {
    UploadFile: async ({ file }) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload('/upload', fd);
    },
    InvokeLLM: async ({ prompt, response_json_schema }) => {
      const data = await api.post('/ai/invoke', { prompt, response_json_schema });
      return data?.result ?? data;
    },
  },
};

// ─── Algorithm / FYP ─────────────────────────────────────────────────────────
export const searchUsers = (q) =>
  api.get('/users/search', { params: { q } }).catch(() => []);

export const algorithm = {
  trackEngagement: (data) =>
    api.post('/algorithm/track', data).catch(() => null),
  getFeed: (limit = 50) =>
    api.get('/algorithm/feed', { params: { limit } }),
};

// ─── Biomass currency ────────────────────────────────────────────────────────
// One wallet per user (auto-created on first fetch). Earn from in-app actions
// (server grants automatically) or daily claim. Spend at the shop or via
// direct spend calls. All endpoints return the updated wallet.
export const biomass = {
  wallet:    ()                  => api.get('/biomass/wallet'),
  claimDaily:()                  => api.post('/biomass/daily', {}),
  spend:     (amount, reason)    => api.post('/biomass/spend', { amount, reason }),
  shop:      ()                  => api.get('/biomass/shop'),
  buy:       (itemId)            => api.post('/biomass/shop/buy', { itemId }),
};

// ─── Feed comments — extra endpoint beyond CRUD ──────────────────────────────
// React toggle endpoint: posts {emoji} and gets back the updated comment.
export const feedComments = {
  react: (commentId, emoji) => api.post(`/feed-comments/${commentId}/react`, { emoji }),
};

// ─── Named export matching old base44 import shape ───────────────────────────
export const base44 = { entities, auth, integrations };

export default api;

// ─── Socket.io client ────────────────────────────────────────────────────────
import { io } from 'socket.io-client';

let _socket = null;

export function getSocket() {
  if (!_socket) {
    const token = localStorage.getItem('spidr_token');
    _socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    _socket.on('connect_error', (err) => {
      console.error('Socket.io connection error:', err.message);
    });
  }
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
