import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Hash,
  ArrowLeft,
  Users,
  Volume2,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Settings as SettingsIcon,
  LogOut,
  Check,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { entities } from '../../../lib/apiClient';
import { useAppShell } from '../../../lib/appShellContext';
import { Avatar } from '../../../components/ui/Avatar';
import { Spinner } from '../../../components/ui/Spinner';
import { dmConversationId, isSystemFriend } from '../../../lib/utils';

type Channel = { id?: string; _id?: string; name: string; type?: 'text' | 'voice' | string };

function CategoryHeader({
  label,
  collapsed,
  onToggle,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 14,
        marginBottom: 6,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#ef4444' }} />
      </View>
      <Text
        style={{
          color: 'rgba(8,145,178,0.85)',
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 2,
          textTransform: 'uppercase',
          flex: 1,
        }}
      >
        {label}
      </Text>
      {collapsed ? (
        <ChevronRight size={14} color="#71717a" />
      ) : (
        <ChevronDown size={14} color="#71717a" />
      )}
    </TouchableOpacity>
  );
}

function ChannelRow({
  name,
  icon,
  onPress,
}: {
  name: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
      }}
    >
      {/* Fixed-width icon slot so every channel name aligns at the same x */}
      <View style={{ width: 28, alignItems: 'flex-start' }}>{icon}</View>
      <Text
        style={{ color: '#e4e4e7', fontSize: 15, fontWeight: '600', flex: 1 }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Invite friends sheet — consent-based DM invite (ProfileView parity) ──────
function InviteSheet({
  visible,
  onClose,
  server,
  currentUser,
}: {
  visible: boolean;
  onClose: () => void;
  server: any;
  currentUser: any;
}) {
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: visible && !!currentUser?.id,
  });

  const invitable = (friends as any[]).filter(
    (f) =>
      !isSystemFriend(f) &&
      !(server?.members || []).some((m: any) => m.user_id === f.friend_id),
  );

  const invite = async (f: any) => {
    setSendingId(f.friend_id);
    try {
      // Same interactive invite-card DM the profile "Add" flow sends —
      // membership only changes when the recipient accepts.
      const conversationId = dmConversationId(currentUser?.id, f.friend_id);
      await entities.DirectMessage.create({
        conversation_id: conversationId,
        sender_id: currentUser?.id,
        sender_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
        sender_avatar: currentUser?.avatar_url || '',
        receiver_id: f.friend_id,
        recipient_id: f.friend_id,
        content: `🕷️ Invited you to ${server.name}`,
        is_server_invite: true,
        server_invite_data: {
          server_id: server.id,
          server_name: server.name,
          server_icon: server.icon_url || '',
          server_description: server.description || '',
          member_count: (server.members || []).length,
          inviter_id: currentUser?.id,
          inviter_name:
            currentUser?.display_name || currentUser?.full_name || currentUser?.username,
          members_snapshot: server.members || [],
        },
      });
      Alert.alert('Invite sent', `${f.friend_name || 'Your friend'} will see it in your DMs.`);
    } catch (err: any) {
      Alert.alert('Could not send invite', err?.message || 'Try again.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View
        style={{
          maxHeight: 440,
          backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(255,51,51,0.25)',
          padding: 16,
          paddingBottom: 28,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 12 }}>
          INVITE FRIENDS TO {String(server?.name || '').toUpperCase()}
        </Text>
        {invitable.length === 0 ? (
          <Text style={{ color: '#71717a', fontSize: 12, paddingVertical: 16, textAlign: 'center' }}>
            Everyone you know is already in this web.
          </Text>
        ) : (
          <ScrollView>
            {invitable.map((f: any) => (
              <TouchableOpacity
                key={f.id}
                disabled={sendingId === f.friend_id}
                onPress={() => invite(f)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  marginBottom: 6,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}
              >
                <Avatar uri={f.friend_avatar} name={f.friend_name || '?'} size={36} />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {f.friend_name || 'Friend'}
                </Text>
                {sendingId === f.friend_id ? (
                  <ActivityIndicator size="small" color="#FF3333" />
                ) : (
                  <UserPlus size={15} color="#71717a" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── Server settings sheet — rename (owner), leave (member) ──────────────────
function ServerSettingsSheet({
  visible,
  onClose,
  server,
  currentUserId,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  server: any;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const isOwner = server?.owner_id === currentUserId;
  const [name, setName] = useState<string>(server?.name || '');
  const [saving, setSaving] = useState(false);

  const rename = async () => {
    const next = name.trim();
    if (!next || next === server.name || saving) return;
    setSaving(true);
    try {
      await entities.Server.update(server.id, { name: next });
      onChanged();
      Alert.alert('Renamed', `This web is now "${next}".`);
    } catch (err: any) {
      Alert.alert('Could not rename', err?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const leave = () =>
    Alert.alert('Leave server?', `You'll need a new invite to rejoin ${server?.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            const nextMembers = (server?.members || []).filter(
              (m: any) => m.user_id !== currentUserId,
            );
            await entities.Server.update(server.id, { members: nextMembers });
            onClose();
            router.back();
          } catch (err: any) {
            Alert.alert('Could not leave', err?.message || 'Try again.');
          }
        },
      },
    ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(255,51,51,0.25)',
          padding: 16,
          paddingBottom: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <SettingsIcon size={15} color="#ef4444" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
            SERVER SETTINGS
          </Text>
        </View>

        {/* Info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Avatar uri={server?.icon_url} name={server?.name} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
              {server?.name}
            </Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>
              {(server?.members || []).length} members{isOwner ? ' · you own this web' : ''}
            </Text>
          </View>
        </View>

        {isOwner && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }}>
              SERVER NAME
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Server name"
                placeholderTextColor="#52525b"
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
                onPress={rename}
                disabled={saving || !name.trim() || name.trim() === server?.name}
                style={{
                  width: 44,
                  borderRadius: 10,
                  backgroundColor: name.trim() && name.trim() !== server?.name ? '#16a34a' : '#3f3f46',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Check size={16} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isOwner && (
          <TouchableOpacity
            onPress={leave}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: '#180a0a',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.25)',
            }}
          >
            <LogOut size={15} color="#dc2626" />
            <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>
              LEAVE SERVER
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

export default function ServerChannelList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser: user } = useAppShell();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: server } = useQuery({
    queryKey: ['server', id],
    queryFn: () => entities.Server.get(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  const { textChannels, voiceChannels } = useMemo(() => {
    const all: Channel[] = (server as any)?.channels || [];
    if (all.length === 0) {
      return {
        textChannels: [
          { id: 'general', name: 'general', type: 'text' as const },
          { id: 'random', name: 'random', type: 'text' as const },
        ],
        voiceChannels: [] as Channel[],
      };
    }
    return {
      textChannels: all.filter((c) => c.type !== 'voice'),
      voiceChannels: all.filter((c) => c.type === 'voice'),
    };
  }, [server]);

  if (!server) return <Spinner />;

  const memberCount = (server as any).members?.length || 0;
  const serverName = (server as any).name || 'Server';
  const bannerUrl = (server as any).banner_url as string | undefined;

  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

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
        {/* Server icon opens the settings sheet */}
        <TouchableOpacity onPress={() => setShowSettings(true)} hitSlop={4}>
          <Avatar uri={(server as any).icon_url} name={serverName} size={40} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
            {serverName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={11} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 11 }} numberOfLines={1}>
              {memberCount} member{memberCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowInvite(true)} style={{ padding: 6 }} hitSlop={4}>
          <UserPlus size={18} color="#a1a1aa" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 6 }} hitSlop={4}>
          <SettingsIcon size={18} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Banner */}
        {bannerUrl ? (
          <View style={{ width: '100%', height: 120, overflow: 'hidden' }}>
            <Image
              source={{ uri: bannerUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* MAIN WEB — text channels */}
        {textChannels.length > 0 && (
          <>
            <CategoryHeader
              label="Main Web"
              collapsed={!!collapsed['main']}
              onToggle={() => toggle('main')}
            />
            {!collapsed['main'] &&
              textChannels.map((c) => (
                <ChannelRow
                  key={String(c.id || c._id)}
                  name={c.name}
                  icon={<Hash size={18} color="#71717a" />}
                  onPress={() => router.push(`/server/${id}/channel/${c.id || c._id}`)}
                />
              ))}
          </>
        )}

        {/* VOICE WEBS — voice channels (Phase 2 — needs custom dev client) */}
        {voiceChannels.length > 0 && (
          <>
            <CategoryHeader
              label="Voice Webs"
              collapsed={!!collapsed['voice']}
              onToggle={() => toggle('voice')}
            />
            {!collapsed['voice'] &&
              voiceChannels.map((c) => (
                <ChannelRow
                  key={String(c.id || c._id)}
                  name={c.name}
                  icon={<Volume2 size={18} color="#71717a" />}
                  onPress={() =>
                    Alert.alert(
                      'Voice on mobile',
                      'Voice channels need the Phase 2 custom dev client (react-native-webrtc). Use the web client for now.'
                    )
                  }
                />
              ))}
          </>
        )}
      </ScrollView>

      <InviteSheet
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        server={server}
        currentUser={user}
      />
      <ServerSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        server={server}
        currentUserId={user?.id}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['server', id] })}
      />
    </SafeAreaView>
  );
}
