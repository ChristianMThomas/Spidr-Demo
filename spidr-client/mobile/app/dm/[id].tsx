import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Phone,
  Video,
  Pin,
  Search,
  MoreVertical,
  Sparkles,
  X as XIcon,
  UserX,
  Flag,
  User as UserIcon,
  VolumeX,
} from 'lucide-react-native';
import { Modal, Pressable, TextInput } from 'react-native';
import { entities, integrations } from '../../lib/apiClient';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/authContext';
import { useUnread } from '../../lib/unreadContext';
import { Avatar } from '../../components/ui/Avatar';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { MessageInput } from '../../components/chat/MessageInput';
import { Spinner } from '../../components/ui/Spinner';
import { NotFound } from '../../components/ui/NotFound';
import OutgoingCallModal from '../../components/call/OutgoingCallModal';
import { callManager } from '../../lib/callManager';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  online: { label: 'ONLINE', color: '#22c55e' },
  idle: { label: 'IDLE', color: '#eab308' },
  dnd: { label: 'DND', color: '#ef4444' },
  streaming: { label: 'STREAMING', color: '#a855f7' },
  offline: { label: 'OFFLINE', color: '#71717a' },
};

function formatDateDivider(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// Build the rendered list oldest→newest and inject pseudo-rows for date
// dividers + "showHeader" hints for consecutive messages from the same
// sender. The FlashList is NOT inverted — newest naturally sits at the
// bottom (social-media style).
function useRenderRows(messages: any[], currentUserId?: string) {
  return useMemo(() => {
    if (!messages.length) return [] as any[];
    // `messages` come back newest-first from the server; walk oldest-first
    // so date dividers & consecutive grouping are computed in time order.
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
      const senderId = m.sender_id || m.user_id;
      const showHeader = senderId !== lastSender;
      out.push({ kind: 'msg', id: String(m.id || m._id), msg: m, mine: senderId === currentUserId, showHeader });
      lastSender = senderId;
    }
    return out;
  }, [messages, currentUserId]);
}

// ── Catch Me Up bar ──────────────────────────────────────────────────────────
function CatchMeUpBar({ messages, peerName }: { messages: any[]; peerName: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const limit = 30;
  const count = Math.min(limit, messages.length);

  const run = async () => {
    if (loading) return;
    const recent = [...messages].reverse().slice(-limit).filter((m) => (m.content || '').trim());
    if (recent.length === 0) {
      Alert.alert('Catch Me Up', 'Nothing to summarize yet.');
      return;
    }
    setLoading(true);
    setSummary(null);
    try {
      const lines = recent.map((m) => `${m.user_name || m.sender_name || 'someone'}: ${String(m.content || '').slice(0, 160)}`);
      const prompt = `You are Spidr AI. Summarize the following recent messages from a conversation with ${peerName} as a short, scannable recap. Highlight key topics, decisions, and anything that seems to need a reply. Keep it under 120 words, use short bullet points, and do not invent details.\n\nMessages (oldest to newest):\n${lines.join('\n')}`;
      const reply = await integrations.Core.InvokeLLM({ prompt });
      setSummary(typeof reply === 'string' ? reply : JSON.stringify(reply));
    } catch {
      Alert.alert('Catch Me Up', 'Could not generate a summary right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 }}>
      <TouchableOpacity
        onPress={run}
        disabled={loading}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.35)',
          backgroundColor: 'rgba(239,68,68,0.08)',
          gap: 8,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#ef4444" size="small" />
        ) : (
          <Sparkles size={14} color="#ef4444" />
        )}
        <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 13 }}>Catch Me Up</Text>
        <Text style={{ color: '#71717a', fontSize: 11, flex: 1 }} numberOfLines={1}>
          — AI summary of last {count} messages
        </Text>
      </TouchableOpacity>

      {summary && (
        <View
          style={{
            marginTop: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(10,10,10,0.85)',
            borderRadius: 12,
            padding: 12,
            paddingRight: 30,
            position: 'relative',
          }}
        >
          <TouchableOpacity
            onPress={() => setSummary(null)}
            style={{ position: 'absolute', top: 8, right: 8 }}
            hitSlop={8}
          >
            <XIcon size={14} color="#71717a" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
            <Sparkles size={11} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>
              SPIDR AI RECAP
            </Text>
          </View>
          <Text style={{ color: '#e4e4e7', fontSize: 13, lineHeight: 19 }}>{summary}</Text>
        </View>
      )}
    </View>
  );
}

// ── Date divider pill ────────────────────────────────────────────────────────
function DateDivider({ label }: { label: string }) {
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
        <Text style={{ color: '#a1a1aa', fontSize: 11 }}>{label}</Text>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function DM() {
  const { id: conversationId, friendId, friendName, inCall: inCallParam } = useLocalSearchParams<{
    id: string;
    friendId?: string;
    friendName?: string;
    inCall?: string;
  }>();
  // `inCall=1` is set by IncomingCallModal when accepting a call, so the DM
  // screen can show an in-call banner (media stream itself needs a WebRTC
  // dev build — Phase 2). Toggled off by the "Hang up" chip below.
  const [callActive, setCallActive] = useState(inCallParam === '1');
  useEffect(() => { setCallActive(inCallParam === '1'); }, [inCallParam, conversationId]);
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [extra, setExtra] = useState<any[]>([]);
  const [ghostMode, setGhostMode] = useState(false);
  const [callKind, setCallKind] = useState<'voice' | 'video' | null>(null);
  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const [showStickyWeb, setShowStickyWeb] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 250ms debounce — avoids re-filtering the FlashList on every keystroke,
  // which stutters on long DM histories.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const listRef = useRef<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dms', conversationId],
    queryFn: () =>
      // Sort by `-created_date`, NOT `-created_at`. The DirectMessage
      // schema has `created_date` (and Mongoose-generated `createdAt`)
      // but no `created_at` field — sorting by a non-existent field
      // makes Mongo return docs in essentially random order, which is
      // what was producing the "shuffled dates" symptom.
      entities.DirectMessage.filter({ conversation_id: conversationId }, '-created_date', 100),
    enabled: !!conversationId,
  });

  // Does the person on the other end still exist? An empty message list can't
  // answer that — a brand-new DM and a DM with a deleted account both come
  // back as []. GET /users/:id 404s only for a genuinely missing account, so
  // we key "not found" off a 4xx and let network errors fall through to the
  // normal empty-conversation view.
  const { error: peerError } = useQuery({
    queryKey: ['user-exists', friendId],
    queryFn: () => entities.User.get(String(friendId)),
    enabled: !!friendId,
    staleTime: 300_000,
  });
  const peerStatus = (peerError as any)?.status;
  const peerMissing = peerStatus >= 400 && peerStatus < 500;

  // Pull the peer's profile for the header (name, avatar, status) AND
  // for live-avatar rendering on every received bubble.
  const { data: peerProfile } = useQuery({
    queryKey: ['profile-of', friendId],
    queryFn: async () => {
      const list = await entities.UserProfile.filter({ user_id: friendId });
      return (list as any[])[0] || null;
    },
    enabled: !!friendId,
    staleTime: 60_000,
  });

  // Pull MY profile too so my own bubbles render with my CURRENT pfp,
  // not the snapshot baked onto each message at send time. auth.me()
  // doesn't return avatar_url — it lives on UserProfile.
  const { data: myProfile } = useQuery({
    queryKey: ['profile-of', user?.id],
    queryFn: async () => {
      const list = await entities.UserProfile.filter({ user_id: user?.id });
      return (list as any[])[0] || null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // Friend row holds the per-user `nickname` field — the private name the
  // current user has set for this friend. Highest-priority display name.
  const { data: friendRow } = useQuery({
    queryKey: ['friend-row', user?.id, friendId],
    queryFn: async () => {
      const list = await entities.Friend.filter({ user_id: user?.id, friend_id: friendId });
      return (list as any[])[0] || null;
    },
    enabled: !!user?.id && !!friendId,
    staleTime: 60_000,
  });

  useEffect(() => { setExtra([]); }, [conversationId]);

  // Clear the unread badge for this thread whenever it's open and new data
  // lands (covers both entering the screen and receiving while inside it).
  const { markConversationRead } = useUnread();
  useEffect(() => {
    if (conversationId) markConversationRead(String(conversationId));
  }, [conversationId, data, markConversationRead]);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      const socket = await getSocket();
      if (!mounted) return;
      const onNew = (m: any) => {
        // The server's REST DM path doesn't emit a full payload — the web
        // pattern is: POST → emit `dm:notify` → server broadcasts EMPTY
        // `dm:new` to the room as a "wake up and re-fetch" signal. So if
        // the payload has no id, treat it as a refetch trigger. If it
        // does have an id (rare — socket `dm:send` path), also splice it
        // in optimistically.
        const hasPayload = m && (m.id || m._id);
        if (hasPayload) {
          if (m.conversation_id && m.conversation_id !== conversationId) return;
          setExtra((prev) =>
            prev.find((x) => (x.id || x._id) === (m.id || m._id)) ? prev : [m, ...prev]
          );
        }
        // Always refetch — guarantees the sender + receiver both see the
        // newest message regardless of which broadcast path was used.
        queryClient.invalidateQueries({ queryKey: ['dms', conversationId] });
      };
      const onDelete = ({ id }: any) => {
        setExtra((prev) => prev.filter((x) => (x.id || x._id) !== id));
        queryClient.invalidateQueries({ queryKey: ['dms', conversationId] });
      };
      socket.emit('join:dm', { conversationId });
      socket.on('dm:new', onNew);
      socket.on('dm:deleted', onDelete);
      cleanup = () => {
        socket.off('dm:new', onNew);
        socket.off('dm:deleted', onDelete);
      };
    })();
    return () => { mounted = false; cleanup?.(); };
  }, [conversationId, queryClient]);

  const send = async (text: string, attachments?: string[]) => {
    if (!text.trim() && !attachments?.length) return;
    // Match the web's send pattern (DirectMessages.jsx). The REST POST
    // stores the message; the socket `dm:notify` emit is what tells the
    // recipient's client to refetch. Without the notify, the recipient
    // sees nothing live; without the local invalidate, neither does
    // the sender.
    await entities.DirectMessage.create({
      conversation_id: conversationId,
      sender_id: user?.id,
      sender_name: myProfile?.display_name || user?.full_name || user?.username,
      sender_avatar: myProfile?.avatar_url || '',
      receiver_id: friendId,
      recipient_id: friendId,
      content: text,
      attachments: attachments || [],
      is_read: false,
      text_effect: ghostMode ? 'ghost' : 'normal',
    });
    queryClient.invalidateQueries({ queryKey: ['dms', conversationId] });
    try {
      const socket = await getSocket();
      socket.emit('dm:notify', { conversationId, recipientId: friendId });
    } catch {
      /* socket unavailable — receive side will catch up on next focus */
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

  const rows = useRenderRows(merged, user?.id);

  const status = peerProfile?.status || 'offline';
  const statusInfo = STATUS_LABEL[status] || STATUS_LABEL.offline;
  // Priority: user's private nickname → friend's display name → username → route param.
  const displayName =
    friendRow?.nickname ||
    peerProfile?.display_name ||
    peerProfile?.username ||
    friendName ||
    'Direct Message';
  const headerAvatar = peerProfile?.avatar_url;

  const togglePin = (msgId: string) => {
    setPinned((prev) => {
      const next = { ...prev };
      if (next[msgId]) delete next[msgId];
      else next[msgId] = true;
      return next;
    });
  };

  const pinnedMessages = useMemo(
    () => merged.filter((m: any) => pinned[String(m.id || m._id)]),
    [merged, pinned],
  );

  const visibleRows = useMemo(() => {
    if (!debouncedQuery.trim()) return rows;
    const q = debouncedQuery.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (r.kind === 'divider') return false;
      const content = String(r.msg?.content || '').toLowerCase();
      return content.includes(q);
    });
  }, [rows, debouncedQuery]);

  if (!conversationId || peerMissing) return <NotFound what="conversation" />;

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

        <TouchableOpacity
          style={{ position: 'relative' }}
          onPress={() => friendId && router.push(`/user/${friendId}`)}
          hitSlop={6}
        >
          <Avatar uri={headerAvatar} name={displayName} size={36} />
          <View
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: statusInfo.color,
              borderWidth: 2,
              borderColor: '#050505',
            }}
          />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
            {displayName}
          </Text>
          <Text
            style={{
              color: statusInfo.color,
              fontSize: 9,
              fontFamily: 'monospace',
              letterSpacing: 2,
              fontWeight: '800',
            }}
          >
            {statusInfo.label}
          </Text>
        </View>

        {/* Action cluster */}
        <TouchableOpacity onPress={() => setCallKind('voice')} style={{ padding: 6 }} hitSlop={4}>
          <Phone size={18} color="#a1a1aa" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCallKind('video')} style={{ padding: 6 }} hitSlop={4}>
          <Video size={18} color="#a1a1aa" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowStickyWeb(true)} style={{ padding: 6 }} hitSlop={4}>
          <Pin size={18} color={pinnedMessages.length > 0 ? '#ef4444' : '#a1a1aa'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSearchOpen((s) => !s)} style={{ padding: 6 }} hitSlop={4}>
          <Search size={18} color={searchOpen ? '#ef4444' : '#a1a1aa'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMoreMenu(true)} style={{ padding: 6 }} hitSlop={4}>
          <MoreVertical size={18} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      {/* In-call banner — shown after accepting an incoming call. Media
          stream is a Phase-2 (WebRTC dev build) task; the banner lets the
          user confirm they joined and hang up. */}
      {callActive && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          marginHorizontal: 10, marginTop: 6,
          paddingHorizontal: 12, paddingVertical: 8,
          backgroundColor: 'rgba(34,197,94,0.12)',
          borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
          borderRadius: 10,
        }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
          <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '800', letterSpacing: 1, flex: 1 }}>
            IN CALL WITH {(friendName || 'FRIEND').toUpperCase()}
          </Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                const socket = await getSocket();
                socket.emit('call:cancel', { recipientId: friendId, conversationId });
              } catch { /* non-fatal */ }
              setCallActive(false);
            }}
            style={{
              paddingHorizontal: 10, paddingVertical: 4,
              backgroundColor: '#dc2626', borderRadius: 6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>HANG UP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inline search bar */}
      {searchOpen && (
        <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#0f0f0f', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Search size={14} color="#71717a" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              placeholder="Search this DM..."
              placeholderTextColor="#52525b"
              style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 2 }}
            />
            <TouchableOpacity onPress={() => { setSearchOpen(false); setSearchQuery(''); setDebouncedQuery(''); }} hitSlop={6}>
              <XIcon size={14} color="#71717a" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        <CatchMeUpBar messages={merged} peerName={displayName} />

        {isLoading ? (
          <Spinner />
        ) : (
          <FlashList
            data={visibleRows}
            keyExtractor={(r: any) => r.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
            ref={listRef}
            renderItem={({ item }) => {
              if (item.kind === 'divider') return <DateDivider label={item.label} />;
              const msgId = String(item.msg?.id || item.msg?._id);
              const isPinned = !!pinned[msgId];
              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={() => togglePin(msgId)}
                  delayLongPress={400}
                >
                  <View>
                    <MessageBubble
                      msg={item.msg}
                      mine={item.mine}
                      showHeader={item.showHeader}
                      peerName={displayName}
                      peerAvatar={headerAvatar}
                      myName={myProfile?.display_name || user?.full_name || user?.username}
                      myAvatar={myProfile?.avatar_url}
                      currentUserId={user?.id}
                      onAvatarPress={(uid) => router.push(`/user/${uid}`)}
                    />
                    {isPinned && (
                      <View style={{
                        position: 'absolute', top: 4, right: item.mine ? 46 : undefined, left: item.mine ? undefined : 46,
                        backgroundColor: '#ef4444', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
                        flexDirection: 'row', alignItems: 'center', gap: 3,
                      }}>
                        <Pin size={8} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 }}>PINNED</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <MessageInput
          onSend={send}
          placeholder={ghostMode ? `Ghost DM to ${displayName.split(' ')[0] || ''}...` : `Message ${displayName.split(' ')[0] || ''}...`}
          ghostMode={ghostMode}
          onGhostToggle={() => setGhostMode((g) => !g)}
        />
      </KeyboardAvoidingView>

      {/* Outgoing call */}
      {callKind && friendId && (
        <OutgoingCallModal
          visible={!!callKind}
          kind={callKind}
          onClose={() => setCallKind(null)}
          onAccepted={async () => {
            const kind = callKind || 'voice';
            setCallKind(null);
            const ok = await callManager.startOutgoing({
              conversationId: conversationId!,
              peer: { id: friendId!, name: displayName, avatar: headerAvatar },
              kind,
            });
            if (ok) {
              router.push({
                pathname: '/call/[id]',
                params: {
                  id: conversationId!,
                  peerId: friendId!,
                  peerName: displayName,
                  peerAvatar: headerAvatar,
                  kind,
                },
              });
            } else {
              setCallActive(true); // Expo Go fallback — original in-app UI
            }
          }}
          recipientId={friendId}
          recipientName={displayName}
          recipientAvatar={headerAvatar}
          conversationId={conversationId!}
          caller={{
            id: user?.id!,
            name: myProfile?.display_name || user?.full_name || user?.username,
            avatar: myProfile?.avatar_url,
          }}
        />
      )}

      {/* Sticky Web (pinned messages) */}
      <StickyWebSheet
        visible={showStickyWeb}
        onClose={() => setShowStickyWeb(false)}
        pinned={pinnedMessages}
        onUnpin={(msgId) => togglePin(msgId)}
      />

      {/* More options */}
      <MoreMenuSheet
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        onViewProfile={() => { setShowMoreMenu(false); friendId && router.push(`/user/${friendId}`); }}
        onGhostToggle={() => { setShowMoreMenu(false); setGhostMode((g) => !g); }}
        ghostMode={ghostMode}
        currentUser={user}
        friendId={friendId ? String(friendId) : undefined}
        friendName={displayName}
        friendRow={friendRow}
      />
    </SafeAreaView>
  );
}

// ── Sticky Web sheet — bottom sheet listing pinned messages ────────────────
function StickyWebSheet({
  visible, onClose, pinned, onUnpin,
}: {
  visible: boolean;
  onClose: () => void;
  pinned: any[];
  onUnpin: (msgId: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
        <View style={{
          maxHeight: 480, backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTopWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
          padding: 16, paddingBottom: 28,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Pin size={14} color="#ef4444" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, flex: 1 }}>
              MEMORY WEB
            </Text>
            <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '700' }}>
              {pinned.length} pinned
            </Text>
          </View>

          {pinned.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <Pin size={28} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>
                Long-press any message to preserve it in silk.
              </Text>
            </View>
          ) : (
            <ScrollView>
              {pinned.map((m: any) => {
                const msgId = String(m.id || m._id);
                return (
                  <View key={msgId} style={{
                    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
                    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
                    padding: 12, marginBottom: 8,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '900' }} numberOfLines={1}>
                        {m.sender_name || m.user_name || 'User'}
                      </Text>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity onPress={() => onUnpin(msgId)} hitSlop={8}>
                        <Text style={{ color: '#71717a', fontSize: 10 }}>Unpin</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: '#e4e4e7', fontSize: 13 }} numberOfLines={4}>
                      {m.content || '(attachment)'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Same reason list the web ReportModal + mobile profile ReportSheet ship.
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam / Bot Activity', severity: 'low' },
  { id: 'harassment', label: 'Harassment / Abuse', severity: 'medium' },
  { id: 'nsfw', label: 'Inappropriate Content (NSFW)', severity: 'medium' },
  { id: 'impersonation', label: 'Impersonation', severity: 'medium' },
  { id: 'threats', label: 'Threats / Violence', severity: 'high' },
  { id: 'underage', label: 'Underage User', severity: 'high' },
  { id: 'hacking', label: 'Hacking / Exploits', severity: 'critical' },
  { id: 'doxxing', label: 'Doxxing / Leaking Personal Info', severity: 'critical' },
  { id: 'other', label: 'Other', severity: 'medium' },
];

// ── More options sheet ────────────────────────────────────────────────────
function MoreMenuSheet({
  visible, onClose, onViewProfile, onGhostToggle, ghostMode,
  currentUser, friendId, friendName, friendRow,
}: {
  visible: boolean;
  onClose: () => void;
  onViewProfile: () => void;
  onGhostToggle: () => void;
  ghostMode: boolean;
  currentUser: any;
  friendId?: string;
  friendName: string;
  friendRow: any;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [muted, setMuted] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const closeAll = () => {
    setReporting(false);
    setReason(null);
    setDetails('');
    onClose();
  };

  // Real report — same Report entity + shape the web ReportModal writes.
  const submitReport = async () => {
    if (!reason || submitting || !friendId) return;
    setSubmitting(true);
    try {
      const reasonObj = REPORT_REASONS.find((r) => r.id === reason);
      await entities.Report.create({
        reporter_id: currentUser?.id,
        reporter_name: currentUser?.full_name || currentUser?.username,
        target_type: 'user',
        target_id: friendId,
        target_name: friendName,
        reason,
        details,
        severity: reasonObj?.severity || 'medium',
        status: 'pending',
      });
      closeAll();
      Alert.alert('Report submitted', 'The Spidr team will review it.');
    } catch (err: any) {
      Alert.alert('Could not submit report', err?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Real block — flips the existing Friend row to blocked (or creates one),
  // same model the profile-view Sever action uses.
  const blockUser = () => {
    if (!friendId) return;
    Alert.alert('Block user?', `${friendName} won't be able to message you or see your activity.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            if (friendRow?.id) {
              await entities.Friend.update(friendRow.id, { status: 'blocked' });
            } else {
              await entities.Friend.create({
                user_id: currentUser?.id,
                friend_id: friendId,
                friend_name: friendName,
                status: 'blocked',
              });
            }
            queryClient.invalidateQueries({ queryKey: ['friends'] });
            queryClient.invalidateQueries({ queryKey: ['friend-row'] });
            closeAll();
            router.back();
          } catch (err: any) {
            Alert.alert('Could not block', err?.message || 'Try again.');
          }
        },
      },
    ]);
  };
  const item = (Icon: any, label: string, onPress: () => void, color = '#fff') => (
    <TouchableOpacity onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 6,
    }}>
      <Icon size={17} color={color} />
      <Text style={{ color, fontSize: 14, fontWeight: '700', flex: 1 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={closeAll} />
        <View style={{
          backgroundColor: '#0a0a0a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          padding: 16, paddingBottom: 28,
        }}>
          {!reporting ? (
            <>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 }}>
                MORE OPTIONS
              </Text>
              {item(UserIcon, 'View profile', onViewProfile)}
              {item(
                () => <Sparkles size={17} color={ghostMode ? '#a855f7' : '#a1a1aa'} />,
                ghostMode ? 'Ghost mode: ON' : 'Ghost mode: OFF',
                onGhostToggle,
                ghostMode ? '#a855f7' : '#fff',
              )}
              {item(
                VolumeX,
                muted ? 'Unmute notifications' : 'Mute notifications',
                () => { setMuted((m) => !m); Alert.alert(muted ? 'Unmuted' : 'Muted', 'This DM will ' + (muted ? 'resume' : 'stop') + ' notifying you.'); onClose(); },
              )}
              {item(Flag, 'Report user', () => setReporting(true), '#f97316')}
              {item(UserX, 'Block user', blockUser, '#ef4444')}
            </>
          ) : (
            <>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 }}>
                REPORT {friendName.toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {REPORT_REASONS.map((r) => {
                  const active = reason === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => setReason(r.id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 999,
                        backgroundColor: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                        borderWidth: 1,
                        borderColor: active ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <Text style={{ color: active ? '#ef4444' : '#a1a1aa', fontSize: 11, fontWeight: '700' }}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Add details (optional)..."
                placeholderTextColor="#52525b"
                multiline
                style={{
                  backgroundColor: '#18181b',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.07)',
                  color: '#fff',
                  fontSize: 13,
                  padding: 10,
                  minHeight: 64,
                  textAlignVertical: 'top',
                  marginBottom: 12,
                }}
              />
              <TouchableOpacity
                onPress={submitReport}
                disabled={!reason || submitting}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: reason ? '#dc2626' : '#3f3f46',
                  alignItems: 'center',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>
                    SUBMIT REPORT
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
