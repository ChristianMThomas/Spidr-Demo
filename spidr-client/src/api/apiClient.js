import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every outbound request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('spidr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear token (expired / invalid)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('spidr_token');
    }
    return Promise.reject(err.response?.data || err);
  }
);

// ─── Entity CRUD factory ─────────────────────────────────────────────────────
// Mirrors the entities.XXX interface exactly so components need
// minimal changes after the import swap.
const entity = (path) => ({
  list: (orderBy, limit) => {
    const params = {};
    if (orderBy) params._orderBy = orderBy;
    if (limit)   params._limit   = limit;
    return api.get(`/${path}`, { params }).then((r) => r.data);
  },
  filter: (query, orderBy, limit) => {
    const params = { ...query };
    if (orderBy) params._orderBy = orderBy;
    if (limit)   params._limit   = limit;
    return api.get(`/${path}`, { params }).then((r) => r.data);
  },
  get: (id) =>
    api.get(`/${path}/${id}`).then((r) => r.data),
  create: (data) =>
    api.post(`/${path}`, data).then((r) => r.data),
  update: (id, data) =>
    api.patch(`/${path}/${id}`, data).then((r) => r.data),
  delete: (id) =>
    api.delete(`/${path}/${id}`).then((r) => r.data),
});

export const entities = {
  User:             entity('users'),
  UserProfile:      entity('user-profiles'),
  Friend:           entity('friends'),
  Server:           entity('servers'),
  Message:          entity('messages'),
  DirectMessage:    entity('direct-messages'),
  GroupChat:        entity('group-chats'),
  GroupChatMessage: entity('group-chat-messages'),
  VoiceSession:     entity('voice-sessions'),
  Feed:             entity('feeds'),
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

// ─── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (data) =>
    api.post('/auth/register', data).then((r) => r.data),
  verifyOTP: (email, otp) =>
    api.post('/auth/verify-otp', { email, otp }).then((r) => r.data),
  setupTotp:        () => api.post('/auth/setup-totp').then(r => r.data),
  verifyTotpSetup:  (token) => api.post('/auth/verify-totp-setup', { token }).then(r => r.data),
  disableTotp:      () => api.post('/auth/disable-totp').then(r => r.data),
  changePassword: (data) => api.post('/auth/change-password', data).then(r => r.data),
  overrideRequest:  (email) => api.post('/auth/override-request', { email }).then(r => r.data),
  overrideVerify:   (email, code, method) => api.post('/auth/override-verify', { email, code, method }).then(r => r.data),
  overrideConfirm:  (resetToken, newPassword) => api.post('/auth/override-confirm', { resetToken, newPassword }).then(r => r.data),
  devGetOtp: (email) => api.post('/auth/dev-get-otp', { email }).then(r => r.data).catch(() => null),
  resendOTP: (email) =>
    api.post('/auth/resend-otp', { email }).then((r) => r.data),
  me: () =>
    api.get('/auth/me').then((r) => r.data),
  logout: () => {
    localStorage.removeItem('spidr_token');
  },
  redirectToLogin: () => {
    localStorage.removeItem('spidr_token');
    window.location.reload();
  },
};

// ─── Integrations ────────────────────────────────────────────────────────────
export const integrations = {
  Core: {
    UploadFile: async ({ file }) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data; // { url: 'https://...' }
    },
    InvokeLLM: async ({ prompt, response_json_schema }) => {
      const res = await api.post('/ai/invoke', { prompt, response_json_schema });
      // Server returns { result: string|object } — unwrap so callers get the value directly
      return res.data?.result ?? res.data;
    },
  },
};


// ─── Algorithm / FYP ─────────────────────────────────────────────────────────
export const searchUsers = (q) =>
  api.get('/users/search', { params: { q } }).then(r => r.data).catch(() => []);

export const algorithm = {
  trackEngagement: (data) =>
    api.post('/algorithm/track', data).then((r) => r.data).catch(() => null), // fire-and-forget safe
  getFeed: (limit = 50) =>
    api.get('/algorithm/feed', { params: { limit } }).then((r) => r.data),
};

// ─── Named export matching old base44 import shape ───────────────────────────
export const base44 = { entities, auth, integrations };

export default api;

// ─── Socket.io client ────────────────────────────────────────────────────────
// Import and call getSocket() anywhere in the app to get the shared instance.
// It connects lazily on first call and reuses the connection afterwards.
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
