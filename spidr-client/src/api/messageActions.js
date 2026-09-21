import { api } from './apiClient';

export const messageActions = {
  destinations: () => api.get('/message-actions/destinations'),
  forward: (source, target) => api.post('/message-actions/forward', {
    source_type: source.scope, message_id: source.id, target_type: target.type, target_id: target.id,
  }),
  save: source => api.post('/message-actions/saved', { source_type: source.scope, message_id: source.id }),
  saved: cursor => api.get(`/message-actions/saved${cursor ? `?before=${encodeURIComponent(cursor)}` : ''}`),
  remove: savedId => api.delete(`/message-actions/saved/${encodeURIComponent(savedId)}`),
};
