import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { entities } from './apiClient';
import { useAuth } from './authContext';
import { getSocket } from './socket';

interface UnreadCtx {
  counts: Record<string, number>; // conversation_id → unread count
  total: number;
  markConversationRead: (conversationId: string) => Promise<void>;
}

const UnreadContext = createContext<UnreadCtx | null>(null);

// Ghost-mode messages are deliberately excluded — they're ephemeral by
// design and must never bump a badge.
const isGhost = (m: any) => m?.text_effect === 'ghost';

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadRows = [] } = useQuery({
    queryKey: ['unread-dms', user?.id],
    queryFn: () =>
      entities.DirectMessage.filter(
        { receiver_id: user?.id, is_read: false },
        '-created_date',
        200,
      ),
    enabled: isAuthenticated && !!user?.id,
    staleTime: 15_000,
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of unreadRows as any[]) {
      if (isGhost(m)) continue;
      if (m.sender_id === user?.id) continue;
      const cid = m.conversation_id;
      if (!cid) continue;
      map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [unreadRows, user?.id]);

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  // Any dm:notification (full payload or the empty REST "wake up" signal)
  // means the unread set may have changed — refetch it.
  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      const socket = await getSocket();
      if (!mounted) return;
      const onNotify = () =>
        queryClient.invalidateQueries({ queryKey: ['unread-dms', user?.id] });
      socket.on('dm:notification', onNotify);
      socket.on('dm:new', onNotify);
      cleanup = () => {
        socket.off('dm:notification', onNotify);
        socket.off('dm:new', onNotify);
      };
    })();
    return () => { mounted = false; cleanup?.(); };
  }, [isAuthenticated, user?.id, queryClient]);

  // Re-check unread when the app returns to the foreground. Socket events
  // don't fire while backgrounded, so a DM that arrived overnight would
  // otherwise never bump the badge until the user manually opened the DMs.
  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: ['unread-dms', user?.id] });
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, user?.id, queryClient]);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!user?.id || !conversationId) return;
      // Single server-side updateMany — replaces the per-message PATCH loop
      // whose race conditions (cache hydration + `is_read=false` boolean
      // coercion through URL query params) left Spidr System badges stuck.
      // Endpoint name must match the server route in
      // spidr-server/src/routes/directMessages.js — POST /read-conversation.
      // The old '/mark-conversation-read' name 404'd, so the badge never
      // cleared when a DM was opened.
      try {
        await api.post('/direct-messages/read-conversation', {
          conversation_id: conversationId,
        });
      } catch { /* non-fatal — still invalidate so the badge re-checks */ }
      queryClient.invalidateQueries({ queryKey: ['unread-dms', user.id] });
    },
    [user?.id, queryClient],
  );

  return (
    <UnreadContext.Provider value={{ counts, total, markConversationRead }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error('useUnread must be used inside <UnreadProvider>');
  return ctx;
}
