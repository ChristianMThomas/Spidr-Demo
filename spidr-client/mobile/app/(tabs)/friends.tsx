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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../../components/ui/Avatar';
import { dmConversationId } from '../../lib/utils';

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
  onPress,
}: {
  name: string;
  avatar?: string;
  status?: string;
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
  onMessage,
}: {
  name: string;
  discriminator?: string;
  status?: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  onMessage: () => void;
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
        <View style={{ position: 'relative' }}>
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
        </View>
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

  const accepted = (friends as any[]).filter((f) => f.status === 'accepted');
  const pendingIncoming = (friends as any[]).filter((f) => f.status === 'pending_incoming');
  const pendingOutgoing = (friends as any[]).filter((f) => f.status === 'pending_outgoing');
  const blocked = (friends as any[]).filter((f) => f.status === 'blocked');

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

  // SPIDR WEB strip — pulls accepted friends ranked online-first.
  const webHeads = useMemo(() => {
    return [...accepted]
      .map((f) => {
        const p = getProfile(f.friend_id);
        return {
          id: f.friend_id,
          name: p?.display_name || f.friend_name || 'Friend',
          avatar: p?.avatar_url || f.friend_avatar,
          status: p?.status || 'offline',
          rank: p?.status === 'online' ? 0 : p?.status === 'idle' ? 1 : p?.status === 'dnd' ? 2 : 3,
        };
      })
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 12);
  }, [accepted, profiles]);

  const activeCount = webHeads.filter((h) => h.status !== 'offline').length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#050505' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>Friends</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Coming soon', 'Group chats from mobile are landing in a follow-up patch.')
            }
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
            SPIDR WEB
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
                    onMessage={() =>
                      openDM(f.friend_id, p?.display_name || f.friend_name || 'Friend')
                    }
                  />
                );
              })
            )}
          </>
        )}

        {tab === 'groups' && (
          <Text style={{ color: '#52525b', textAlign: 'center', paddingVertical: 40, fontSize: 13 }}>
            Group chats from mobile are coming in a follow-up patch.
          </Text>
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
          <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
            <ShieldAlert size={36} color="#ca8a04" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 12 }}>
              Signal requests
            </Text>
            <Text style={{ color: '#71717a', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
              Encrypted DM requests from non-friends will appear here. Coming to mobile in a follow-up patch.
            </Text>
          </View>
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
                onPress={() =>
                  Alert.alert(
                    'Coming soon',
                    'Sending friend requests from mobile is landing in the next patch — use the web for now.'
                  )
                }
                style={{
                  backgroundColor: '#16a34a',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
