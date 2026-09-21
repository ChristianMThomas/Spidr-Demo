import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitter } from './eventEmitter';
import { BASE_URL, AUTH_URL } from './config';

// ─── Auth-service fetch wrapper (Spring Boot on AUTH_URL) ────────────────────
async function authRequest(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await AsyncStorage.getItem('spidr_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(AUTH_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await AsyncStorage.removeItem('spidr_token');
    emitter.emit('spidr:auth-expired');
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    const err: any = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ─── Core fetch wrapper (Node.js core on BASE_URL) ───────────────────────────
interface RequestOpts {
  params?: Record<string, any>;
  body?: any;
  isFormData?: boolean;
}

async function request(method: string, path: string, opts: RequestOpts = {}) {
  let url = BASE_URL + path;

  if (opts.params) {
    const entries = Object.entries(opts.params).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length) {
      const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
      url += '?' + qs;
    }
  }

  const headers: Record<string, string> = {};
  const token = await AsyncStorage.getItem('spidr_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body && !opts.isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: opts.isFormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    await AsyncStorage.removeItem('spidr_token');
    emitter.emit('spidr:auth-expired');
  }

  let data: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) data = await res.json();
  else data = await res.text();

  if (!res.ok) {
    const err: any = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    if (res.status === 429) {
      const ra = res.headers.get('retry-after');
      let seconds = 5;
      if (ra) {
        const asInt = parseInt(ra, 10);
        if (!Number.isNaN(asInt) && asInt > 0) seconds = asInt;
        else {
          const asDate = Date.parse(ra);
          if (!Number.isNaN(asDate)) seconds = Math.max(1, Math.ceil((asDate - Date.now()) / 1000));
        }
      }
      err.retryAfter = seconds;
      err.isRateLimited = true;
    }
    throw err;
  }

  return data;
}

const api = {
  get:    (path: string, opts?: RequestOpts) => request('GET',    path, opts),
  post:   (path: string, body?: any)         => request('POST',   path, { body }),
  patch:  (path: string, body?: any)         => request('PATCH',  path, { body }),
  delete: (path: string)                     => request('DELETE', path),
  upload: (path: string, formData: any)      => request('POST',   path, { body: formData, isFormData: true }),
};

// ─── Entity CRUD factory ─────────────────────────────────────────────────────
const entity = (path: string) => ({
  list: (orderBy?: string, limit?: number) => {
    const params: Record<string, any> = {};
    if (orderBy) params._orderBy = orderBy;
    if (limit)   params._limit   = limit;
    return api.get(`/${path}`, { params });
  },
  filter: (query: Record<string, any>, orderBy?: string, limit?: number) => {
    const params: Record<string, any> = { ...query };
    if (orderBy) params._orderBy = orderBy;
    if (limit)   params._limit   = limit;
    return api.get(`/${path}`, { params });
  },
  get:    (id: string)              => api.get(`/${path}/${id}`),
  create: (data: any)               => api.post(`/${path}`, data),
  update: (id: string, data: any)   => api.patch(`/${path}/${id}`, data),
  delete: (id: string)              => api.delete(`/${path}/${id}`),
});

export const entities = {
  User:             entity('users'),
  UserProfile:      entity('user-profiles'),
  Friend:           entity('friends'),
  Server: {
    ...entity('servers'),
    leave: (id: string) => api.post(`/servers/${id}/leave`, {}),
    generateInvite: (id: string, rotate = false) =>
      api.post(`/servers/${id}/invite`, { rotate }),
    joinByCode: (invite_code: string, user: any) =>
      api.post('/servers/join', {
        invite_code,
        user_name: user?.full_name || user?.username || user?.display_name || 'User',
        user_avatar: user?.avatar_url || '',
      }),
    lookupByCode: (code: string) => api.get(`/servers/lookup/${code}`),
  },
  Message:          entity('messages'),
  DirectMessage:    entity('direct-messages'),
  GroupChat: {
    ...entity('group-chats'),
    // Self-removal (see server groupChats.js POST /:id/leave). Non-owner
    // members can't use update() to drop themselves — the collaborative-field
    // allowlist rejects `members`/`member_ids` writes with 403.
    leave: (id: string) => api.post(`/group-chats/${id}/leave`, {}),
  },
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
  login: (email: string, password: string) =>
    authRequest('POST', '/auth/login', { email, password }),

  register: async ({ email, password, username }: { email: string; password: string; username: string }) => {
    await authRequest('POST', '/auth/signup', { email, password, username });
    return { requiresVerification: true, email };
  },

  verifyOTP: (email: string, otp: string) =>
    authRequest('POST', '/auth/verify', { email, verificationCode: otp }),

  resendOTP: (email: string) =>
    authRequest('POST', '/auth/resend', { email }),

  me: () => authRequest('GET', '/users/me'),

  changePassword: (data: any) =>
    authRequest('PATCH', '/users/change-password', data),

  overrideRequest: async (email: string) => {
    await authRequest('POST', '/auth/forgot-password', { email });
    return { method: 'email' };
  },

  overrideVerify: async (email: string, code: string, _method?: string) => {
    await authRequest('POST', '/auth/verify-reset-code', { email, resetCode: code });
    return { resetToken: email };
  },

  overrideConfirm: (resetToken: string, newPassword: string) =>
    authRequest('POST', '/auth/reset-password', { email: resetToken, newPassword }),

  // TOTP still routes to Node.js
  setupTotp:       ()             => api.post('/auth/setup-totp'),
  verifyTotpSetup: (token: string) => api.post('/auth/verify-totp-setup', { token }),
  disableTotp:     ()             => api.post('/auth/disable-totp'),

  devGetOtp: () => Promise.resolve(null),

  logout: async () => { await AsyncStorage.removeItem('spidr_token'); },
  storeToken: async (token: string) => { await AsyncStorage.setItem('spidr_token', token); },
};

// ─── Module actions ──────────────────────────────────────────────────────────
export const moduleActions = {
  install:   (moduleId: string)                  => api.post(`/modules/${moduleId}/install`, {}),
  uninstall: (moduleId: string)                  => api.post(`/modules/${moduleId}/uninstall`, {}),
  report:    (moduleId: string, reason: string)  => api.post(`/modules/${moduleId}/report`, { reason }),
};

// ─── Integrations ────────────────────────────────────────────────────────────
export const integrations = {
  Core: {
    UploadFile: async ({ file }: { file: any }) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload('/upload', fd);
    },
    InvokeLLM: async ({ prompt, response_json_schema }: { prompt: string; response_json_schema?: any }) => {
      const data = await api.post('/ai/invoke', { prompt, response_json_schema });
      return (data as any)?.result ?? data;
    },
  },
};

// ─── Search ──────────────────────────────────────────────────────────────────
export const searchUsers = (q: string) =>
  api.get('/users/search', { params: { q } }).catch(() => []);

export const searchMessages = ({ serverId, channelId, q, limit = 40 }: { serverId: string; channelId?: string; q: string; limit?: number }) => {
  if (!serverId || !q?.trim()) return Promise.resolve([]);
  const params: Record<string, any> = { server_id: serverId, q, _limit: limit };
  if (channelId) params.channel_id = channelId;
  return api.get('/messages/search', { params }).catch(() => []);
};

// ─── Algorithm / FYP ─────────────────────────────────────────────────────────
export const algorithm = {
  trackEngagement: (data: any) =>
    api.post('/algorithm/track', data).catch(() => null),
  getFeed: (limit = 50) =>
    api.get('/algorithm/feed', { params: { limit } }),
};

// ─── Biomass currency ────────────────────────────────────────────────────────
export const biomass = {
  wallet:    ()                              => api.get('/biomass/wallet'),
  claimDaily:()                              => api.post('/biomass/daily', {}),
  catchFly:  ()                              => api.post('/biomass/fly', {}),
  spend:     (amount: number, reason: string) => api.post('/biomass/spend', { amount, reason }),
  shop:      ()                              => api.get('/biomass/shop'),
  buy:       (itemId: string)                => api.post('/biomass/shop/buy', { itemId }),
};

// ─── Account lifecycle (Apple 5.1.1(v) / Play deletion policy) ───────────────
export const account = {
  deactivate: () => api.post('/users/me/deactivate', {}),
  // Routes through spidr-server's cascading delete (accountAdmin.js) which
  // purges every user-referencing collection AND removes the User row that
  // spidr-auth shares. Prior version hit /users/me on spidr-auth which only
  // dropped the User doc and left ~28 collections orphaned.
  deleteAccount: () => api.delete('/account/me'),
};

// ─── Tension (XP / leveling) ─────────────────────────────────────────────────
export const tension = {
  me:     ()                                                    => api.get('/tension/me'),
  action: (source: string, reason?: string, ref_id?: string)    => api.post('/tension/action', { source, reason, ref_id }),
};

// ─── Feed comments ───────────────────────────────────────────────────────────
export const feedComments = {
  react: (commentId: string, emoji: string) =>
    api.post(`/feed-comments/${commentId}/react`, { emoji }),
};

// ─── Web signals (sling) ─────────────────────────────────────────────────────
// Slung clips land in THE WEB's own SIGNALS inbox, deliberately separate from
// real DMs. Mirrors the web client's webMessages helper.
export const webMessages = {
  inbox:    ()            => api.get('/web-messages', { params: { box: 'inbox' } }),
  sent:     ()            => api.get('/web-messages', { params: { box: 'sent' } }),
  unread:   ()            => api.get('/web-messages/unread-count'),
  sling:    (d: any)      => api.post('/web-messages', d),
  markRead: (id: string)  => api.patch(`/web-messages/${id}/read`, {}),
  remove:   (id: string)  => api.delete(`/web-messages/${id}`),
};

// ─── Follows ─────────────────────────────────────────────────────────────────
export const follows = {
  following: (userId: string)  => api.get('/follows', { params: { follower_id: userId } }),
  followers: (userId: string)  => api.get('/follows', { params: { following_id: userId } }),
  status:    (userId: string)  => api.get(`/follows/status/${userId}`),
  follow:    (payload: any)    => api.post('/follows', payload),
  unfollow:  (userId: string)  => api.delete(`/follows/${userId}`),
};

// ─── Spotify ─────────────────────────────────────────────────────────────────
export const spotify = {
  search: (q: string, limit = 12) =>
    api.get('/spotify/search', { params: { q, limit } }).catch(() => ({ tracks: [] })),
  track: (id: string) =>
    api.get(`/spotify/tracks/${id}`).catch(() => null),
  nowPlaying: (userId: string) =>
    api.get(`/spotify/now-playing/${userId}`).catch(() => null),
  authUrl: () => api.get('/spotify/auth/url').catch(() => null),
  disconnect: () => api.delete('/spotify/auth/disconnect').catch(() => null),
  djSession: {
    get:   (channelId: string) => api.get(`/voice-channels/${channelId}/dj-session`).catch(() => null),
    start: (channelId: string, track_id: string) =>
      api.post(`/voice-channels/${channelId}/dj-session`, { track_id }),
    next:  (channelId: string, track_id: string) =>
      api.patch(`/voice-channels/${channelId}/dj-session`, { track_id }),
    end:   (channelId: string) =>
      api.delete(`/voice-channels/${channelId}/dj-session`),
  },
};

// ─── Spidr System (patch notes) ──────────────────────────────────────────────
export const system = {
  news: () => api.get('/system/news').catch(() => []),
};

export const base44 = { entities, auth, integrations };

export default api;
