import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getSocket } from '@/api/apiClient';

export const markConversationRead = (scope, context_id, server_id) => api.post('/message-actions/read', { scope, context_id, server_id });
export function invalidateReadState(queryClient) {
  for (const key of ['read-state', 'all-dms', 'sidebar-dms', 'dm-messages', 'unread-dms', 'unread-dms-sidebar', 'unread-dms-friends', 'dm-quickheads', 'quickheads-dms']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}
export function useReadState(userId) {
  return useQuery({ queryKey: ['read-state', userId], queryFn: () => api.get('/message-actions/read-state'), enabled: !!userId, staleTime: 15000, refetchInterval: 30000 });
}
export function useReadStateEvents(userId) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    const refresh = () => invalidateReadState(queryClient);
    const events = ['messages:read', 'message:new', 'group:message', 'group-message:new', 'dm:new'];
    events.forEach(event => socket.on(event, refresh));
    return () => events.forEach(event => socket.off(event, refresh));
  }, [userId, queryClient]);
}
