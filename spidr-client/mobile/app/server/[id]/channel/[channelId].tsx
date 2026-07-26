import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Hash, Users } from 'lucide-react-native';
import { entities } from '../../../../lib/apiClient';
import { getSocket } from '../../../../lib/socket';
import { useAuth } from '../../../../lib/authContext';
import { MessageBubble } from '../../../../components/chat/MessageBubble';
import { MessageInput } from '../../../../components/chat/MessageInput';
import { Spinner } from '../../../../components/ui/Spinner';
import { NotFound } from '../../../../components/ui/NotFound';

function formatDateDivider(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// Build the rendered list oldest→newest with date dividers + showHeader hints.
// Mirrors the DM screen pattern — we DON'T use FlashList `inverted` because
// the FlashList v2 + keyboard-avoiding interaction renders oldest-at-bottom.
// Each row also carries the message author's CURRENT name/avatar pulled from
// the profile lookup, so pfp changes propagate to every bubble instantly.
function useRenderRows(
  messages: any[],
  currentUserId: string | undefined,
  profilesByUserId: Record<string, any>,
  myProfile: any | null,
  meName: string,
  meAvatar: string | undefined,
) {
  return useMemo(() => {
    if (!messages.length) return [] as any[];
    const oldestFirst = [...messages].reverse();
    const out: any[] = [];
    let lastDate: string | null = null;
    let lastSender: string | null = null;
    for (const m of oldestFirst) {
      const ts = m.created_at || m.created_date || m.createdAt;
      const d = ts ? new Date(ts) : new Date();
      const dateKey = formatDateDivider(d);
      if (dateKey !== lastDate) {
        out.push({ kind: 'divider', id: `div-${dateKey}-${m.id || m._id}`, label: dateKey });
        lastDate = dateKey;
        lastSender = null;
      }
      const senderId = m.author_id || m.user_id;
      const mine = !!currentUserId && senderId === currentUserId;
      const showHeader = senderId !== lastSender;

      const authorProfile = senderId ? profilesByUserId[senderId] : null;
      const peerName =
        authorProfile?.display_name ||
        authorProfile?.username ||
        m.author_name ||
        m.user_name ||
        'User';
      const peerAvatar = authorProfile?.avatar_url || m.author_avatar || m.user_avatar;

      out.push({
        kind: 'msg',
        id: String(m.id || m._id),
        msg: m,
        mine,
        showHeader,
        peerName,
        peerAvatar,
        myName: meName,
        myAvatar: meAvatar,
      });
      lastSender = senderId;
    }
    return out;
  }, [messages, currentUserId, profilesByUserId, myProfile, meName, meAvatar]);
}

export default function Channel() {
  const { id: serverId, channelId } = useLocalSearchParams<{ id: string; channelId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const listRef = useRef<any>(null);
  const [extra, setExtra] = useState<any[]>([]);

  const { data: server, isError: serverError } = useQuery({
    queryKey: ['server', serverId],
    queryFn: () => entities.Server.get(serverId!),
    enabled: !!serverId,
    staleTime: 30_000,
  });

  const channel = useMemo(() => {
    const channels: any[] = (server as any)?.channels || [];
    return channels.find((c) => (c.id || c._id) === channelId) || null;
  }, [server, channelId]);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', serverId, channelId],
    queryFn: () =>
      // `-created_date` (the schema field) — not `-created_at`. Same fix as DMs.
      entities.Message.filter({ server_id: serverId, channel_id: channelId }, '-created_date', 100),
    enabled: !!serverId && !!channelId,
  });

  // Author profiles for live-avatar + name rendering across every bubble.
  // Cached globally so we don't refetch per channel switch.
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles-for-chat'],
    queryFn: () => entities.UserProfile.list('-created_date', 200),
    staleTime: 60_000,
  });
  const profilesByUserId = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of allProfiles as any[]) if (p?.user_id) map[p.user_id] = p;
    return map;
  }, [allProfiles]);

  // My own profile — auth.me() doesn't return avatar_url; it lives on UserProfile.
  const { data: myProfile } = useQuery({
    queryKey: ['profile-of', user?.id],
    queryFn: async () => {
      const list = await entities.UserProfile.filter({ user_id: user?.id });
      return (list as any[])[0] || null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  useEffect(() => { setExtra([]); }, [channelId]);

  useEffect(() => {
    if (!serverId || !channelId) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      const socket = await getSocket();
      if (!mounted) return;

      const onNew = (m: any) => {
        if (m?.channel_id !== channelId) return;
        setExtra((prev) =>
          prev.find((x) => (x.id || x._id) === (m.id || m._id)) ? prev : [m, ...prev]
        );
        queryClient.invalidateQueries({ queryKey: ['messages', serverId, channelId] });
      };
      const onUpdate = (m: any) => {
        if (m?.channel_id !== channelId) return;
        queryClient.invalidateQueries({ queryKey: ['messages', serverId, channelId] });
      };
      const onDelete = ({ id }: any) => {
        setExtra((prev) => prev.filter((x) => (x.id || x._id) !== id));
        queryClient.invalidateQueries({ queryKey: ['messages', serverId, channelId] });
      };

      // Server expects `join:channel` / `leave:channel` with `{ serverId, channelId }`.
      socket.emit('join:channel', { serverId, channelId });
      socket.on('message:new', onNew);
      socket.on('message:updated', onUpdate);
      socket.on('message:deleted', onDelete);

      cleanup = () => {
        socket.emit('leave:channel', { serverId, channelId });
        socket.off('message:new', onNew);
        socket.off('message:updated', onUpdate);
        socket.off('message:deleted', onDelete);
      };
    })();
    return () => { mounted = false; cleanup?.(); };
  }, [serverId, channelId, queryClient]);

  const meName = myProfile?.display_name || user?.full_name || user?.username || 'You';
  const meAvatar = myProfile?.avatar_url;

  const send = async (text: string, attachments?: string[]) => {
    if (!text.trim() && !attachments?.length) return;
    // Optimistic insert so the sender sees their own message instantly. The
    // REST POST doesn't broadcast `message:new` for normal messages, so
    // without this the sender's UI lags until the refetch lands.
    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      _id: tempId,
      server_id: serverId,
      channel_id: channelId,
      content: text,
      attachments: attachments || [],
      user_id: user?.id,
      author_id: user?.id,
      user_name: meName,
      author_name: meName,
      user_avatar: meAvatar || '',
      author_avatar: meAvatar || '',
      created_date: new Date().toISOString(),
    };
    setExtra((prev) => [optimistic, ...prev]);
    try {
      await entities.Message.create({
        server_id: serverId,
        channel_id: channelId,
        content: text,
        attachments: attachments || [],
        user_id: user?.id,
        user_name: meName,
        user_avatar: meAvatar || '',
        author_id: user?.id,
        author_name: meName,
        author_avatar: meAvatar || '',
      });
    } finally {
      setExtra((prev) => prev.filter((x) => (x.id || x._id) !== tempId));
      queryClient.invalidateQueries({ queryKey: ['messages', serverId, channelId] });
    }
  };

  const base: any[] = Array.isArray(data) ? data : [];
  const merged = useMemo(
    () =>
      [...extra, ...base].reduce<any[]>((acc, m) => {
        const key = m.id || m._id;
        if (acc.find((x) => (x.id || x._id) === key)) return acc;
        acc.push(m);
        return acc;
      }, []),
    [extra, base]
  );

  const rows = useRenderRows(merged, user?.id, profilesByUserId, myProfile, meName, meAvatar);

  const channelName = channel?.name || 'channel';
  const serverName = (server as any)?.name || '';
  const memberCount = (server as any)?.members?.length || 0;

  // Only the server's existence gates this screen. A null `channel` is normal:
  // servers with no channel list fall back to synthetic general/random, which
  // won't be found in server.channels.
  if (!serverId || serverError) return <NotFound what="channel" />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#050505' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
          backgroundColor: 'rgba(5,5,5,0.95)',
          gap: 8,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <ArrowLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>

        <Hash size={18} color="#ef4444" />

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
            {channelName}
          </Text>
          <Text style={{ color: '#71717a', fontSize: 11 }} numberOfLines={1}>
            {serverName}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
          <Users size={14} color="#71717a" />
          <Text style={{ color: '#71717a', fontSize: 12, fontWeight: '700' }}>{memberCount}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        {isLoading ? (
          <Spinner />
        ) : (
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={(r: any) => r.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
            renderItem={({ item }) => {
              if (item.kind === 'divider') {
                return (
                  <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <View
                      style={{
                        backgroundColor: '#1a1a1a',
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: '#a1a1aa', fontSize: 11 }}>{item.label}</Text>
                    </View>
                  </View>
                );
              }
              return (
                <MessageBubble
                  msg={item.msg}
                  mine={item.mine}
                  showHeader={item.showHeader}
                  peerName={item.peerName}
                  peerAvatar={item.peerAvatar}
                  myName={item.myName}
                  myAvatar={item.myAvatar}
                  onAvatarPress={(uid) => router.push(`/user/${uid}`)}
                />
              );
            }}
          />
        )}

        <MessageInput onSend={send} placeholder={`Message #${channelName}`} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
