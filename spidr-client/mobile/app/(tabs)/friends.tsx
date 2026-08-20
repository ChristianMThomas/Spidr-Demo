import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../lib/theme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Search,
  Users as UsersIcon,
  UserPlus,
  ShieldAlert,
  MessageCircle,
  Check,
  X as XIcon,
  Ban,
  ChevronRight,
} from 'lucide-react-native';
import { entities, searchUsers } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../../components/ui/Avatar';
import { dmConversationId, isSystemFriend } from '../../lib/utils';
import { useUnread } from '../../lib/unreadContext';

type TabKey = 'all' | 'online' | 'groups' | 'pending' | 'blocked' | 'signals' | 'add';

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  idle: '#eab308',
  dnd: '#ef4444',
  streaming: '#a855f7',
  offline: '#71717a',
};

// ── Tab pill ─────────────────────────────────────────────────────────────────
function TabPill({
  active,
  onPress,
  label,
  icon,
  badge,
  color = '#dc2626',
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: active ? color : 'transparent',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        marginRight: 6,
        gap: 5,
      }}
    >
      {icon}
      <Text
        style={{
          color: active ? '#fff' : '#a1a1aa',
          fontSize: 12,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      {badge != null && badge > 0 && (
        <View
          style={{
            backgroundColor: active ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.25)',
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 1,
            minWidth: 20,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: active ? '#fff' : '#ef4444', fontSize: 10, fontWeight: '800' }}>
            {badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── SPIDR WEB head ───────────────────────────────────────────────────────────
function SpidrWebHead({
  name,
  avatar,
  status,
  unread,
  onPress,
}: {
  name: string;
  avatar?: string;
  status?: string;
  unread?: number;
  onPress: () => void;
}) {
  const statusColor = STATUS_COLORS[status || 'offline'] || STATUS_COLORS.offline;
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: 'center', width: 68, marginRight: 12 }}>
      <View style={{ position: 'relative' }}>
        {/* Gradient ring */}
        <View
          style={{
            padding: 2,
            borderRadius: 999,
            backgroundColor: '#ef4444',
          }}
        >
          <View
            style={{
              padding: 2,
              borderRadius: 999,
              backgroundColor: '#0a0a0a',
            }}
          >
            <Avatar uri={avatar} name={name} size={50} />
          </View>
        </View>
        {/* Status dot */}
        <View
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: statusColor,
            borderWidth: 2,
            borderColor: '#0a0a0a',
          }}
        />
        {/* Unread badge — top-right of the avatar so it stays visible when
            the RECENTS strip pushes this friend to the front. */}
        {!!unread && unread > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -4,
              backgroundColor: '#dc2626',
              borderRadius: 999,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#0a0a0a',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>
              {unread > 9 ? '9+' : unread}
            </Text>
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 6, maxWidth: 68 }}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Friend banner card ───────────────────────────────────────────────────────
function FriendCard({
  name,
  discriminator,
  status,
  bio,
  avatar,
  banner,
  unread,
  onMessage,
  onAvatarPress,
}: {
  name: string;
  discriminator?: string;
  status?: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  unread?: number;
  onMessage: () => void;
  onAvatarPress?: () => void;
}) {
  const statusColor = STATUS_COLORS[status || 'offline'] || STATUS_COLORS.offline;
  return (
    <TouchableOpacity
      onPress={onMessage}
      activeOpacity={0.9}
      style={{
        height: 84,
        marginHorizontal: 14,
        marginBottom: 10,
        borderRadius: 14,
        backgroundColor: '#0d0d0d',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Banner image — falls back to dark when missing */}
      {banner ? (
        <Image
          source={{ uri: banner }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode="cover"
        />
      ) : null}
      {/* Left-side dark gradient overlay so the text stays readable */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '70%',
          backgroundColor: banner ? 'rgba(0,0,0,0.65)' : 'transparent',
        }}
      />

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 }}>
        <TouchableOpacity
          style={{ position: 'relative' }}
          disabled={!onAvatarPress}
          onPress={onAvatarPress}
          hitSlop={6}
        >
          <Avatar uri={avatar} name={name} size={52} />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: statusColor,
              borderWidth: 2,
              borderColor: '#0a0a0a',
            }}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
            {name}
          </Text>
          {discriminator ? (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} numberOfLines={1}>
              {name}#{discriminator}
            </Text>
          ) : null}
          {bio ? (
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} numberOfLines={1}>
              {bio}
            </Text>
          ) : null}
        </View>
        {!!unread && unread > 0 && (
          <View
            style={{
              backgroundColor: '#dc2626',
              borderRadius: 999,
              minWidth: 22,
              paddingHorizontal: 6,
              paddingVertical: 3,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
              {unread > 99 ? '99+' : unread}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function Friends() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('all');
  const { counts: unreadCounts } = useUnread();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [addInput, setAddInput] = useState('');

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: () => entities.Friend.filter({ user_id: user?.id }),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list(),
    staleTime: 60_000,
  });

  const getProfile = (userId: string) =>
    (profiles as any[]).find((p) => p.user_id === userId);

  // Group chats where the current user is owner or member — same client-side
  // membership filter the web FriendsPanel applies to GroupChat.list().
  const { data: groupChats = [] } = useQuery({
    queryKey: ['group-chats', user?.id],
    queryFn: () => entities.GroupChat.list('-created_date', 100),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
  const myGroups = useMemo(
    () =>
      (groupChats as any[]).filter(
        (g) =>
          !g.is_archived &&
          (g.owner_id === user?.id ||
            (g.member_ids || []).includes(user?.id) ||
            (g.members || []).some(
              (m: any) => (typeof m === 'string' ? m : m?.user_id) === user?.id,
            )),
      ),
    [groupChats, user?.id],
  );

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Wire the Add tab for real: resolve the username/email through
  // /users/search, then create BOTH Friend rows (web sendFriendRequest
  // parity). The pending_incoming row triggers the recipient's Spidr System
  // "friend request" DM server-side.
  const sendFriendRequest = async () => {
    const q = addInput.trim();
    if (!q || sendingRequest) return;
    setSendingRequest(true);
    try {
      const results = (await searchUsers(q)) as any[];
      const exact =
        results.find(
          (r) =>
            r.username?.toLowerCase() === q.toLowerCase() ||
            r.email?.toLowerCase() === q.toLowerCase(),
        ) || results[0];
      if (!exact) {
        Alert.alert('No user found', `Nobody on the web matches "${q}".`);
        return;
      }
      const existing = (friends as any[]).find((f) => f.friend_id === exact.id);
      if (existing) {
        Alert.alert(
          'Already linked',
          existing.status === 'accepted'
            ? `You're already friends with ${exact.username || exact.full_name}.`
            : `A connection with ${exact.username || exact.full_name} is already ${existing.status.replace('_', ' ')}.`,
        );
        return;
      }
      const myProfile = getProfile(user?.id || '');
      const myName = myProfile?.display_name || user?.full_name || user?.username || 'User';
      await entities.Friend.create({
        user_id: user?.id,
        friend_id: exact.id,
        friend_name: exact.full_name || exact.username,
        friend_avatar: exact.avatar_url || '',
        status: 'pending_outgoing',
      });
      await entities.Friend.create({
        user_id: exact.id,
        friend_id: user?.id,
        friend_name: myName,
        friend_avatar: myProfile?.avatar_url || '',
        status: 'pending_incoming',
      });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      setAddInput('');
      Alert.alert('Signal sent', `Friend request sent to ${exact.full_name || exact.username}.`);
    } catch (err: any) {
      Alert.alert(
        'Could not send request',
        err?.status === 409 ? 'A connection between you two already exists.' : err?.message || 'Try again.',
      );
    } finally {
      setSendingRequest(false);
    }
  };

  const accepted = (friends as any[]).filter((f) => f.status === 'accepted');
  const pendingIncoming = (friends as any[]).filter((f) => f.status === 'pending_incoming');
  const pendingOutgoing = (friends as any[]).filter((f) => f.status === 'pending_outgoing');
  const blocked = (friends as any[]).filter((f) => f.status === 'blocked');

  // Signals — DMs the user has received from non-friends. Groups by sender so
  // multiple messages from the same stranger show as one row. Loads only when
  // the Signals tab is opened to avoid a wide DM query on every friends visit.
  const { data: incomingDMs = [] } = useQuery({
    queryKey: ['signal-dms', user?.id],
    queryFn: () => entities.DirectMessage.filter({ receiver_id: user?.id }, '-created_date', 200),
    enabled: !!user?.id && tab === 'signals',
    staleTime: 30_000,
  });
  const signals = useMemo(() => {
    const knownIds = new Set(
      (friends as any[])
        .filter((f) => f.status === 'accepted' || f.status === 'pending_incoming' || f.status === 'pending_outgoing')
        .map((f) => f.friend_id),
    );
    knownIds.add(user?.id);
    const bySender: Record<string, any> = {};
    for (const dm of incomingDMs as any[]) {
      const sid = dm.sender_id;
      if (!sid || knownIds.has(sid)) continue;
      if (!bySender[sid] || new Date(dm.created_date) > new Date(bySender[sid].created_date)) {
        bySender[sid] = dm;
      }
    }
    return Object.values(bySender);
  }, [incomingDMs, friends, user?.id]);

  const updateFriend = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => entities.Friend.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
  });

  const filteredAccepted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = accepted;
    if (tab === 'online') {
      list = list.filter((f) => {
        const p = getProfile(f.friend_id);
        return p?.status === 'online' || p?.status === 'streaming';
      });
    }
    if (q) {
      list = list.filter((f) => {
        const p = getProfile(f.friend_id);
        const name = (p?.display_name || f.friend_name || '').toLowerCase();
        return name.includes(q);
      });
    }
    return list;
  }, [accepted, tab, search, profiles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['friends', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    ]);
    setRefreshing(false);
  };

  const openDM = (friendId: string, friendName: string) => {
    const convoId = dmConversationId(user?.id, friendId);
    router.push({
      pathname: '/dm/[id]',
      params: { id: convoId, friendId, friendName },
    } as any);
  };

  // SPIDR WEB strip — pulls accepted friends ranked unread-first, then
  // online-first. Threads with unread DMs bubble to the front so the strip
  // doubles as an at-a-glance "someone messaged you" indicator.
  const webHeads = useMemo(() => {
    return [...accepted]
      .map((f) => {
        const p = getProfile(f.friend_id);
        const unread = unreadCounts[dmConversationId(user?.id, f.friend_id)] || 0;
        return {
          id: f.friend_id,
          name: p?.display_name || f.friend_name || 'Friend',
          avatar: p?.avatar_url || f.friend_avatar,
          status: p?.status || 'offline',
          unread,
          rank: p?.status === 'online' ? 0 : p?.status === 'idle' ? 1 : p?.status === 'dnd' ? 2 : 3,
        };
      })
      .sort((a, b) => {
        if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) {
          return (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
        }
        if (a.unread !== b.unread) return b.unread - a.unread;
        return a.rank - b.rank;
      })
      .slice(0, 12);
  }, [accepted, profiles, unreadCounts, user?.id]);

  const activeCount = webHeads.filter((h) => h.status !== 'offline').length;

  const colors = useThemeColors();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>Friends</Text>
          <TouchableOpacity
            onPress={() => setShowCreateGroup(true)}
            style={{
              backgroundColor: '#7c3aed',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <UsersIcon size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Create Group</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <Search size={16} color="#71717a" />
          <TextInput
            placeholder="Search friends..."
            placeholderTextColor="#52525b"
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 8, marginLeft: 8 }}
          />
        </View>
      </View>

      {/* SPIDR WEB strip */}
      <View
        style={{
          paddingTop: 12,
          paddingBottom: 14,
          borderTopWidth: 1,
          borderTopColor: 'rgba(239,68,68,0.12)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(239,68,68,0.12)',
          backgroundColor: 'rgba(20,10,12,0.45)',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              color: '#a1a1aa',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 2,
            }}
          >
            RECENTS
          </Text>
          <Text style={{ color: '#71717a', fontSize: 11 }}>{activeCount} active</Text>
        </View>
        {webHeads.length === 0 ? (
          <Text style={{ color: '#52525b', fontSize: 12, paddingHorizontal: 16 }}>
            No recent conversations yet.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {webHeads.map((h) => (
              <SpidrWebHead
                key={h.id}
                name={h.name}
                avatar={h.avatar}
                status={h.status}
                unread={h.unread}
                onPress={() => openDM(h.id, h.name)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Tab pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, maxHeight: 40 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}
      >
        <TabPill active={tab === 'all'} onPress={() => setTab('all')} label="All" />
        <TabPill active={tab === 'online'} onPress={() => setTab('online')} label="Online" />
        <TabPill
          active={tab === 'groups'}
          onPress={() => setTab('groups')}
          label="Groups"
          badge={myGroups.length}
          icon={<UsersIcon size={13} color={tab === 'groups' ? '#fff' : '#a1a1aa'} />}
        />
        <TabPill
          active={tab === 'pending'}
          onPress={() => setTab('pending')}
          label="Pending"
          badge={pendingIncoming.length}
        />
        <TabPill active={tab === 'blocked'} onPress={() => setTab('blocked')} label="Blocked" />
        <TabPill
          active={tab === 'signals'}
          onPress={() => setTab('signals')}
          label="Signals"
          color="#ca8a04"
          badge={signals.length}
          icon={<ShieldAlert size={13} color={tab === 'signals' ? '#fff' : '#a1a1aa'} />}
        />
        <TabPill
          active={tab === 'add'}
          onPress={() => setTab('add')}
          label="Add"
          color="#16a34a"
          icon={<UserPlus size={13} color={tab === 'add' ? '#fff' : '#a1a1aa'} />}
        />
      </ScrollView>

      {/* Body */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 96 }}
      >
        {(tab === 'all' || tab === 'online') && (
          <>
            {filteredAccepted.length === 0 ? (
              <Text style={{ color: '#52525b', textAlign: 'center', paddingVertical: 40, fontSize: 13 }}>
                {tab === 'online' ? 'No one online right now.' : 'No friends yet — add some to get started.'}
              </Text>
            ) : (
              filteredAccepted.map((f: any) => {
                const p = getProfile(f.friend_id);
                return (
                  <FriendCard
                    key={f.id}
                    name={p?.display_name || f.friend_name || 'Friend'}
                    discriminator={p?.discriminator || f.friend_discriminator}
                    status={p?.status}
                    bio={p?.bio}
                    avatar={p?.avatar_url || f.friend_avatar}
                    banner={p?.banner_url}
                    unread={unreadCounts[dmConversationId(user?.id, f.friend_id)]}
                    onMessage={() =>
                      openDM(f.friend_id, p?.display_name || f.friend_name || 'Friend')
                    }
                    onAvatarPress={() => router.push(`/user/${f.friend_id}`)}
                  />
                );
              })
            )}
          </>
        )}

        {tab === 'groups' && (
          <View style={{ paddingHorizontal: 14 }}>
            {myGroups.length === 0 ? (
              <Text style={{ color: '#52525b', textAlign: 'center', paddingVertical: 40, fontSize: 13 }}>
                No group chats yet — spin one up with Create Group.
              </Text>
            ) : (
              myGroups.map((g: any) => {
                const memberCount = (g.members || g.member_ids || []).length;
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => router.push(`/group/${g.id}`)}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#0d0d0d',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: 'rgba(124,58,237,0.2)',
                      gap: 12,
                    }}
                  >
                    {(g.avatar_url || g.icon_url) ? (
                      <Image source={{ uri: g.avatar_url || g.icon_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    ) : (
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: 'rgba(124,58,237,0.25)',
                          borderWidth: 1,
                          borderColor: 'rgba(124,58,237,0.5)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#a78bfa', fontSize: 17, fontWeight: '900' }}>
                          {(g.name || 'G').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                        {g.name || 'Untitled group'}
                      </Text>
                      <Text style={{ color: '#71717a', fontSize: 11 }}>
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                        {g.owner_id === user?.id ? ' · you own this web' : ''}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#52525b" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {tab === 'pending' && (
          <View style={{ paddingHorizontal: 14 }}>
            {pendingIncoming.length === 0 && pendingOutgoing.length === 0 ? (
              <Text style={{ color: '#52525b', textAlign: 'center', paddingVertical: 40, fontSize: 13 }}>
                No pending requests.
              </Text>
            ) : (
              <>
                {pendingIncoming.length > 0 && (
                  <Text
                    style={{
                      color: '#a1a1aa',
                      fontSize: 11,
                      letterSpacing: 2,
                      fontWeight: '800',
                      marginBottom: 8,
                    }}
                  >
                    INCOMING ({pendingIncoming.length})
                  </Text>
                )}
                {pendingIncoming.map((f: any) => {
                  const p = getProfile(f.friend_id);
                  const name = p?.display_name || f.friend_name || 'Friend';
                  return (
                    <View
                      key={f.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#0d0d0d',
                        borderRadius: 12,
                        padding: 10,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                        gap: 10,
                      }}
                    >
                      <Avatar uri={p?.avatar_url || f.friend_avatar} name={name} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={{ color: '#71717a', fontSize: 11 }}>Wants to connect</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => updateFriend.mutate({ id: f.id, data: { status: 'accepted' } })}
                        style={{
                          backgroundColor: '#16a34a',
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateFriend.mutate({ id: f.id, data: { status: 'rejected' } })}
                        style={{
                          backgroundColor: '#3f3f46',
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <XIcon size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {pendingOutgoing.length > 0 && (
                  <Text
                    style={{
                      color: '#a1a1aa',
                      fontSize: 11,
                      letterSpacing: 2,
                      fontWeight: '800',
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    OUTGOING ({pendingOutgoing.length})
                  </Text>
                )}
                {pendingOutgoing.map((f: any) => {
                  const p = getProfile(f.friend_id);
                  const name = p?.display_name || f.friend_name || 'Friend';
                  return (
                    <View
                      key={f.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#0d0d0d',
                        borderRadius: 12,
                        padding: 10,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                        gap: 10,
                      }}
                    >
                      <Avatar uri={p?.avatar_url || f.friend_avatar} name={name} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={{ color: '#71717a', fontSize: 11 }}>Awaiting response</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {tab === 'blocked' && (
          <View style={{ paddingHorizontal: 14 }}>
            {blocked.length === 0 ? (
              <Text style={{ color: '#52525b', textAlign: 'center', paddingVertical: 40, fontSize: 13 }}>
                No blocked users.
              </Text>
            ) : (
              blocked.map((f: any) => {
                const p = getProfile(f.friend_id);
                const name = p?.display_name || f.friend_name || 'User';
                return (
                  <View
                    key={f.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#0d0d0d',
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.05)',
                      gap: 10,
                    }}
                  >
                    <Avatar uri={p?.avatar_url || f.friend_avatar} name={name} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={{ color: '#71717a', fontSize: 11 }}>Blocked</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        updateFriend.mutate({ id: f.id, data: { status: 'accepted' } })
                      }
                      style={{
                        backgroundColor: '#3f3f46',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === 'signals' && (
          <View style={{ paddingHorizontal: 14 }}>
            {signals.length === 0 ? (
              <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
                <ShieldAlert size={36} color="#ca8a04" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 12 }}>
                  No signals waiting
                </Text>
                <Text style={{ color: '#71717a', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                  Incoming DMs from users you haven't linked with will land here.
                </Text>
              </View>
            ) : (
              signals.map((dm: any) => {
                const p = getProfile(dm.sender_id);
                const name = p?.display_name || dm.sender_name || 'Unknown';
                return (
                  <TouchableOpacity
                    key={dm.id}
                    onPress={() => openDM(dm.sender_id, name)}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#0d0d0d',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: 'rgba(202,138,4,0.25)',
                      gap: 10,
                    }}
                  >
                    <Avatar uri={p?.avatar_url || dm.sender_avatar} name={name} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={{ color: '#a1a1aa', fontSize: 11 }} numberOfLines={1}>
                        {dm.content || '[attachment]'}
                      </Text>
                    </View>
                    <ShieldAlert size={14} color="#ca8a04" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {showCreateGroup && (
          <CreateGroupSheet
            visible={showCreateGroup}
            onClose={() => setShowCreateGroup(false)}
            accepted={accepted.filter((f: any) => !isSystemFriend(f, getProfile(f.friend_id)))}
            getProfile={getProfile}
            currentUser={user}
            myProfile={getProfile(user?.id || '')}
            onCreated={(group) => {
              queryClient.invalidateQueries({ queryKey: ['group-chats'] });
              setShowCreateGroup(false);
              router.push(`/group/${group.id}`);
            }}
          />
        )}

        {tab === 'add' && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 8 }}>
              Type a friend's username or email to send them a request.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#1a1a1a',
                borderRadius: 12,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <UserPlus size={16} color="#71717a" />
              <TextInput
                placeholder="username or email"
                placeholderTextColor="#52525b"
                value={addInput}
                onChangeText={setAddInput}
                autoCapitalize="none"
                style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10, marginLeft: 8 }}
              />
              <TouchableOpacity
                onPress={sendFriendRequest}
                disabled={sendingRequest || !addInput.trim()}
                style={{
                  backgroundColor: addInput.trim() ? '#16a34a' : '#3f3f46',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  opacity: sendingRequest ? 0.6 : 1,
                }}
              >
                {sendingRequest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Create Group sheet — mobile twin of CreateGroupChatModal.jsx ─────────────
// Name + multi-select accepted friends. Creates the GroupChat with the same
// members[] shape the web writes, PLUS owner_id/member_ids so the socket
// membership check (join:group) matches on every field it knows about.
function CreateGroupSheet({
  visible,
  onClose,
  accepted,
  getProfile,
  currentUser,
  myProfile,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  accepted: any[];
  getProfile: (userId: string) => any;
  currentUser: any;
  myProfile: any;
  onCreated: (group: any) => void;
}) {
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);

  const toggle = (friendId: string) =>
    setSelected((prev) => ({ ...prev, [friendId]: !prev[friendId] }));

  const create = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give your group a name first.');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const myName =
        myProfile?.display_name || currentUser?.full_name || currentUser?.username || 'User';
      const picked = accepted.filter((f: any) => selected[f.friend_id]);
      const members = [
        {
          user_id: currentUser?.id,
          user_name: myName,
          user_avatar: myProfile?.avatar_url || '',
          role: 'admin',
        },
        ...picked.map((f: any) => {
          const p = getProfile(f.friend_id);
          return {
            user_id: f.friend_id,
            user_name: p?.display_name || f.friend_name || 'Member',
            user_avatar: p?.avatar_url || f.friend_avatar || '',
            role: 'member',
          };
        }),
      ];
      const group = await entities.GroupChat.create({
        name,
        owner_id: currentUser?.id,
        member_ids: members.map((m) => m.user_id),
        members,
      });
      setGroupName('');
      setSelected({});
      onCreated(group);
    } catch (err: any) {
      Alert.alert('Could not create group', err?.message || 'Try again.');
    } finally {
      setCreating(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View
        style={{
          maxHeight: 560,
          backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(124,58,237,0.4)',
          padding: 16,
          paddingBottom: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <UsersIcon size={16} color="#a78bfa" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 }}>
            CREATE GROUP CHAT
          </Text>
        </View>

        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Enter group name..."
          placeholderTextColor="#52525b"
          style={{
            backgroundColor: '#18181b',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            color: '#fff',
            fontSize: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 12,
          }}
        />

        <Text style={{ color: '#a1a1aa', fontSize: 11, marginBottom: 8 }}>
          Select friends ({selectedCount} selected) — optional for solo testing
        </Text>

        <ScrollView style={{ maxHeight: 280 }}>
          {accepted.length === 0 ? (
            <Text style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingVertical: 20 }}>
              No friends to add yet.
            </Text>
          ) : (
            accepted.map((f: any) => {
              const p = getProfile(f.friend_id);
              const name = p?.display_name || f.friend_name || 'Friend';
              const isSelected = !!selected[f.friend_id];
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => toggle(f.friend_id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 8,
                    borderRadius: 12,
                    marginBottom: 6,
                    backgroundColor: isSelected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.02)',
                    borderWidth: 1,
                    borderColor: isSelected ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Avatar uri={p?.avatar_url || f.friend_avatar} name={name} size={38} />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {name}
                  </Text>
                  {isSelected && (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#7c3aed',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '800' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={create}
            disabled={creating || !groupName.trim()}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: groupName.trim() ? '#7c3aed' : '#3f3f46',
              alignItems: 'center',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>Create Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
