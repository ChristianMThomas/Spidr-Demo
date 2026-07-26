import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users as UsersIcon, MoreVertical, Crown, LogOut, UserMinus, Pencil } from 'lucide-react-native';
import { TextInput } from 'react-native';
import { Image } from 'expo-image';
import { entities } from '../../lib/apiClient';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../../components/ui/Avatar';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { MessageInput } from '../../components/chat/MessageInput';
import { Spinner } from '../../components/ui/Spinner';
import { NotFound } from '../../components/ui/NotFound';

function formatDateDivider(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// Build the rendered list oldest→newest with date dividers + showHeader
// hints, resolving every author's CURRENT name/avatar from live profiles —
// same pattern as the channel screen (multi-author).
function useRenderRows(
  messages: any[],
  currentUserId: string | undefined,
  profilesByUserId: Record<string, any>,
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
      const senderId = m.user_id || m.sender_id;
      const mine = !!currentUserId && senderId === currentUserId;
      const showHeader = senderId !== lastSender;

      const authorProfile = senderId ? profilesByUserId[senderId] : null;
      const peerName =
        authorProfile?.display_name || authorProfile?.username || m.user_name || m.sender_name || 'User';
      const peerAvatar = authorProfile?.avatar_url || m.user_avatar || m.sender_avatar;

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
  }, [messages, currentUserId, profilesByUserId, meName, meAvatar]);
}

function DateDivider({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ backgroundColor: '#1a1a1a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
        <Text style={{ color: '#a1a1aa', fontSize: 11 }}>{label}</Text>
      </View>
    </View>
  );
}

// ── Members sheet ────────────────────────────────────────────────────────────
function MembersSheet({
  visible,
  onClose,
  group,
  profilesByUserId,
  onOpenProfile,
}: {
  visible: boolean;
  onClose: () => void;
  group: any;
  profilesByUserId: Record<string, any>;
  onOpenProfile: (userId: string) => void;
}) {
  const members: any[] = group?.members || [];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View
        style={{
          maxHeight: 420,
          backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(124,58,237,0.35)',
          padding: 16,
          paddingBottom: 28,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 12 }}>
          {members.length} NODES IN THIS WEB
        </Text>
        <ScrollView>
          {members.map((m: any) => {
            const uid = typeof m === 'string' ? m : m?.user_id;
            if (!uid) return null;
            const p = profilesByUserId[uid];
            const name = p?.display_name || m?.user_name || 'Member';
            const isAdmin = m?.role === 'admin' || group?.owner_id === uid;
            return (
              <TouchableOpacity
                key={uid}
                onPress={() => {
                  onClose();
                  onOpenProfile(uid);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                  marginBottom: 4,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Avatar uri={p?.avatar_url || m?.user_avatar} name={name} size={36} />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {name}
                </Text>
                {isAdmin && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Crown size={12} color="#eab308" />
                    <Text style={{ color: '#eab308', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>ADMIN</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function GroupChat() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const listRef = useRef<any>(null);
  const [extra, setExtra] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: group, isError: groupError } = useQuery({
    queryKey: ['group-chat', groupId],
    queryFn: () => entities.GroupChat.get(groupId!),
    enabled: !!groupId,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: () => entities.GroupChatMessage.filter({ group_id: groupId }, '-created_date', 100),
    enabled: !!groupId,
  });

  // Live profiles for every author bubble (same cache the channel screen uses).
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

  const { data: myProfile } = useQuery({
    queryKey: ['profile-of', user?.id],
    queryFn: async () => {
      const list = await entities.UserProfile.filter({ user_id: user?.id });
      return (list as any[])[0] || null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  useEffect(() => { setExtra([]); }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      const socket = await getSocket();
      if (!mounted) return;
      const onMessage = (m: any) => {
        // Payload messages (socket group:send path) splice in optimistically;
        // empty payloads are the REST wake-up signal — either way, refetch.
        const hasPayload = m && (m.id || m._id);
        if (hasPayload) {
          if (m.group_id && m.group_id !== groupId) return;
          setExtra((prev) =>
            prev.find((x) => (x.id || x._id) === (m.id || m._id)) ? prev : [m, ...prev]
          );
        }
        queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
      };
      socket.emit('join:group', { groupId });
      socket.on('group:message', onMessage);
      cleanup = () => {
        socket.off('group:message', onMessage);
      };
    })();
    return () => { mounted = false; cleanup?.(); };
  }, [groupId, queryClient]);

  const meName = myProfile?.display_name || user?.full_name || user?.username || 'You';
  const meAvatar = myProfile?.avatar_url;

  const send = async (text: string, attachments?: string[]) => {
    if (!text.trim() && !attachments?.length) return;
    // REST create (persists user_name/user_avatar snapshots like the web),
    // then the group:notify relay wakes every member's client to refetch.
    await entities.GroupChatMessage.create({
      group_id: groupId,
      user_id: user?.id,
      user_name: meName,
      user_avatar: meAvatar || '',
      content: text,
      attachments: attachments || [],
    });
    queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
    try {
      const socket = await getSocket();
      socket.emit('group:notify', { groupId });
    } catch {
      /* socket unavailable — members catch up on next focus */
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

  const rows = useRenderRows(merged, user?.id, profilesByUserId, meName, meAvatar);

  const groupName = (group as any)?.name || 'Group Chat';
  const memberCount = ((group as any)?.members || []).length;

  if (!groupId || groupError) return <NotFound what="group chat" />;

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
          gap: 10,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <ArrowLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>

        {(group as any)?.icon_url ? (
          <Image source={{ uri: (group as any).icon_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
        ) : (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(124,58,237,0.25)',
              borderWidth: 1,
              borderColor: 'rgba(124,58,237,0.5)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#a78bfa', fontSize: 15, fontWeight: '900' }}>
              {groupName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={{ color: '#a78bfa', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, fontWeight: '800' }}>
            {memberCount} NODES
          </Text>
        </View>

        <TouchableOpacity onPress={() => setShowMembers(true)} style={{ padding: 6 }} hitSlop={4}>
          <UsersIcon size={18} color="#a1a1aa" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 6 }} hitSlop={4}>
          <MoreVertical size={18} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
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
              if (item.kind === 'divider') return <DateDivider label={item.label} />;
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

        <MessageInput onSend={send} placeholder={`Message ${groupName}...`} />
      </KeyboardAvoidingView>

      <MembersSheet
        visible={showMembers}
        onClose={() => setShowMembers(false)}
        group={group}
        profilesByUserId={profilesByUserId}
        onOpenProfile={(uid) => router.push(`/user/${uid}`)}
      />

      <GroupSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        group={group}
        currentUserId={user?.id}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ['group-chat', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-chats'] });
        }}
        onLeft={() => router.back()}
      />
    </SafeAreaView>
  );
}

// ── Group settings sheet ─────────────────────────────────────────────────────
// Rename (owner only), Leave (member), Kick a member (owner). Runs REST-only —
// GroupChatMessage schema doesn't broadcast, so members refetch on their next
// visit; a real-time roster update is Phase 3.
function GroupSettingsSheet({
  visible,
  onClose,
  group,
  currentUserId,
  onDone,
  onLeft,
}: {
  visible: boolean;
  onClose: () => void;
  group: any;
  currentUserId?: string;
  onDone: () => void;
  onLeft: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group?.name || '');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { setName(group?.name || ''); }, [group?.name]);

  const isOwner = group?.owner_id === currentUserId;
  const members: any[] = group?.members || [];

  const save = async () => {
    if (!group?.id || !name.trim() || busy) return;
    setBusy(true);
    try {
      await entities.GroupChat.update(group.id, { name: name.trim() });
      onDone();
      setRenaming(false);
    } catch (err: any) {
      Alert.alert('Rename failed', err?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!group?.id || busy) return;
    Alert.alert('Leave group?', `You'll stop receiving messages from ${group?.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const nextMembers = members.filter(
              (m) => (typeof m === 'string' ? m : m?.user_id) !== currentUserId,
            );
            const nextIds = (group?.member_ids || []).filter((id: string) => id !== currentUserId);
            await entities.GroupChat.update(group.id, { members: nextMembers, member_ids: nextIds });
            onClose();
            onLeft();
          } catch (err: any) {
            Alert.alert('Could not leave', err?.message || 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const kick = async (uid: string) => {
    if (!isOwner || !group?.id || uid === currentUserId) return;
    setBusy(true);
    try {
      const nextMembers = members.filter((m) => (typeof m === 'string' ? m : m?.user_id) !== uid);
      const nextIds = (group?.member_ids || []).filter((id: string) => id !== uid);
      await entities.GroupChat.update(group.id, { members: nextMembers, member_ids: nextIds });
      onDone();
    } catch (err: any) {
      Alert.alert('Could not remove member', err?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
        <View
          style={{
            maxHeight: 520,
            backgroundColor: '#0a0a0a',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: 'rgba(124,58,237,0.4)',
            padding: 16,
            paddingBottom: 28,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 14 }}>
            GROUP SETTINGS
          </Text>

          {/* Rename */}
          {isOwner && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }}>
                NAME
              </Text>
              {renaming ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput
                    autoFocus
                    value={name}
                    onChangeText={setName}
                    style={{
                      flex: 1,
                      backgroundColor: '#18181b',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.07)',
                      color: '#fff',
                      fontSize: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  />
                  <TouchableOpacity
                    onPress={save}
                    disabled={busy || !name.trim()}
                    style={{ paddingHorizontal: 14, backgroundColor: '#7c3aed', borderRadius: 10, justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setRenaming(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#18181b',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.07)',
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                  }}
                >
                  <Pencil size={12} color="#a1a1aa" />
                  <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>{group?.name || 'Untitled group'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Members list w/ kick */}
          {isOwner && members.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }}>
                MEMBERS
              </Text>
              <ScrollView style={{ maxHeight: 180 }}>
                {members.map((m) => {
                  const uid = typeof m === 'string' ? m : m?.user_id;
                  if (!uid || uid === currentUserId) return null;
                  const label = m?.user_name || uid;
                  return (
                    <View
                      key={uid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, flex: 1 }} numberOfLines={1}>
                        {label}
                      </Text>
                      <TouchableOpacity
                        onPress={() => kick(uid)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: 'rgba(239,68,68,0.15)',
                          borderWidth: 1,
                          borderColor: 'rgba(239,68,68,0.35)',
                        }}
                      >
                        <UserMinus size={11} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800' }}>Kick</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Leave */}
          {!isOwner && (
            <TouchableOpacity
              onPress={leave}
              disabled={busy}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: 'rgba(239,68,68,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.4)',
              }}
            >
              <LogOut size={14} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }}>
                LEAVE GROUP
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
