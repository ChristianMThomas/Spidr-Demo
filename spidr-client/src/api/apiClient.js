const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
  login:           (email, password) => api.post('/auth/login', { email, password }),
  register:        (data)            => api.post('/auth/register', data),
  verifyOTP:       (email, otp)      => api.post('/auth/verify-otp', { email, otp }),
  resendOTP:       (email)           => api.post('/auth/resend-otp', { email }),
  setupTotp:       ()                => api.post('/auth/setup-totp'),
  verifyTotpSetup: (token)           => api.post('/auth/verify-totp-setup', { token }),
  disableTotp:     ()                => api.post('/auth/disable-totp'),
  changePassword:  (data)            => api.post('/auth/change-password', data),
  overrideRequest: (email)           => api.post('/auth/override-request', { email }),
  overrideVerify:  (email, code, method) => api.post('/auth/override-verify', { email, code, method }),
  overrideConfirm: (resetToken, newPassword) => api.post('/auth/override-confirm', { resetToken, newPassword }),
  devGetOtp:       (email)           => api.post('/auth/dev-get-otp', { email }).catch(() => null),
  me:              ()                => api.get('/auth/me'),
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
