import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pin, Users as UsersIcon } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { dmConversationId } from '../../lib/utils';

/**
 * SpidrWebMatrix (mobile) — the twin of the web component of the same name
 * (spidr-client/src/components/spidr/SpidrWebMatrix.jsx), so the home tab
 * carries the same two surfaces the web homepage shows on a small screen:
 *
 *   • Jump Back In — recent DM conversations + your group chats
 *   • Pinned       — UserProfile.pinned_conversations, the same list the
 *                    web right-click "Pin to Spidr Web" writes
 *
 * Data is derived the same way the web page derives it: DMs deduped to one
 * row per conversation, names/avatars resolved from LIVE profiles first and
 * the message's send-time snapshot only as a fallback.
 */

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  idle: '#eab308',
  dnd: '#ef4444',
  streaming: '#a855f7',
  offline: '#52525b',
};

function InitialsDisc({ name, size }: { name?: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#18181b',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: size * 0.4, fontWeight: '900' }}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function GroupDisc({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(127,29,29,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <UsersIcon size={size * 0.4} color="#f87171" />
    </View>
  );
}

export default function SpidrWebMatrix({ currentUserId }: { currentUserId?: string }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<'recent' | 'pinned'>('recent');

  // Recent DMs — sent + received, newest first, one row per conversation.
  const { data: dms = [] } = useQuery({
    queryKey: ['home-recent-dms', currentUserId],
    queryFn: async () => {
      const [sent, received] = await Promise.all([
        entities.DirectMessage.filter({ sender_id: currentUserId }, '-created_date', 100),
        entities.DirectMessage.filter({ receiver_id: currentUserId }, '-created_date', 100),
      ]);
      return [...(sent as any[]), ...(received as any[])].sort(
        (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime(),
      );
    },
    enabled: !!currentUserId,
    staleTime: 30_000,
  });

  // Cache-shared with the Friends tab.
  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUserId],
    queryFn: () => entities.Friend.filter({ user_id: currentUserId }),
    enabled: !!currentUserId,
    staleTime: 30_000,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list(),
    staleTime: 60_000,
  });
  const { data: groupChats = [] } = useQuery({
    queryKey: ['group-chats', currentUserId],
    queryFn: () => entities.GroupChat.list('-created_date', 100),
    enabled: !!currentUserId,
    staleTime: 30_000,
  });

  const profileOf = React.useCallback(
    (userId?: string) => (profiles as any[]).find((p) => p.user_id === userId),
    [profiles],
  );
  const friendOf = React.useCallback(
    (userId?: string) => (friends as any[]).find((f) => f.friend_id === userId),
    [friends],
  );

  const myGroups = React.useMemo(
    () =>
      (groupChats as any[]).filter(
        (g) =>
          !g.is_archived &&
          (g.owner_id === currentUserId ||
            (g.member_ids || []).includes(currentUserId) ||
            (g.members || []).some(
              (m: any) => (typeof m === 'string' ? m : m?.user_id) === currentUserId,
            )),
      ),
    [groupChats, currentUserId],
  );

  // Pins live on the profile, written by the web "Pin to Spidr Web" action.
  // Fetched on their own (the same key the DM + settings screens use) rather
  // than read out of the profiles list, so a trimmed list payload can't
  // quietly empty the tab.
  const { data: myProfileRows = [] } = useQuery({
    queryKey: ['profile-of', currentUserId],
    queryFn: () => entities.UserProfile.filter({ user_id: currentUserId }),
    enabled: !!currentUserId,
    staleTime: 60_000,
  });
  const myProfile: any = (myProfileRows as any[])[0];
  const pins: any[] = Array.isArray(myProfile?.pinned_conversations)
    ? myProfile.pinned_conversations
    : [];

  const openDM = (friendId?: string, name?: string) => {
    if (!friendId || !currentUserId) return;
    router.push({
      pathname: '/dm/[id]',
      params: { id: dmConversationId(currentUserId, friendId), friendId, friendName: name || '' },
    } as any);
  };

  const recentRows = React.useMemo(() => {
    const seen = new Map<string, any>();
    for (const msg of dms as any[]) {
      if (!msg.conversation_id || seen.has(msg.conversation_id)) continue;
      const iSent = msg.sender_id === currentUserId;
      const otherId = iSent ? (msg.receiver_id || msg.recipient_id) : msg.sender_id;
      if (!otherId) continue;
      const friend = friendOf(otherId);
      const live = profileOf(otherId);
      seen.set(msg.conversation_id, {
        key: `dm-${msg.conversation_id}`,
        kind: 'DM',
        name:
          live?.display_name ||
          (iSent ? msg.recipient_name : msg.sender_name) ||
          friend?.friend_name ||
          friend?.friend_username ||
          'Unknown',
        sub: msg.content || (msg.attachments?.length ? 'Attachment' : 'Open conversation'),
        avatar: live?.avatar_url || (iSent ? msg.recipient_avatar : msg.sender_avatar) || friend?.friend_avatar || '',
        onPress: () => openDM(otherId, live?.display_name || friend?.friend_name),
      });
    }
    return [
      ...Array.from(seen.values()),
      ...myGroups.map((g) => ({
        key: `grp-${g.id}`,
        kind: 'GROUP',
        name: g.name || 'Group Chat',
        sub: `${(g.members || g.member_ids || []).length} members`,
        avatar: g.avatar_url || g.icon_url || '',
        isGroup: true,
        onPress: () => router.push(`/group/${g.id}`),
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dms, myGroups, friendOf, profileOf, currentUserId]);

  return (
    <View
      style={{
        backgroundColor: 'rgba(10,10,10,0.6)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
          paddingHorizontal: 16,
          paddingTop: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <TouchableOpacity onPress={() => setTab('recent')} activeOpacity={0.8} style={{ paddingBottom: 10 }}>
          <Text
            style={{
              color: tab === 'recent' ? '#ef4444' : 'rgba(255,255,255,0.4)',
              fontSize: 11,
              fontWeight: '900',
              letterSpacing: 1.6,
            }}
          >
            JUMP BACK IN
          </Text>
          {tab === 'recent' && <View style={underline('#ef4444')} />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTab('pinned')}
          activeOpacity={0.8}
          style={{ paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <UsersIcon size={11} color={tab === 'pinned' ? '#a855f7' : 'rgba(255,255,255,0.4)'} />
          <Text
            style={{
              color: tab === 'pinned' ? '#a855f7' : 'rgba(255,255,255,0.4)',
              fontSize: 11,
              fontWeight: '900',
              letterSpacing: 1.6,
            }}
          >
            PINNED
          </Text>
          {pins.length > 0 && (
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}>
              {pins.length}
            </Text>
          )}
          {tab === 'pinned' && <View style={underline('#a855f7')} />}
        </TouchableOpacity>
      </View>

      {/* Rows */}
      <View style={{ padding: 8, gap: 4 }}>
        {tab === 'recent' ? (
          recentRows.length === 0 ? (
            <Text style={emptyText}>No recent conversations yet</Text>
          ) : (
            recentRows.map((row: any) => (
              <TouchableOpacity
                key={row.key}
                onPress={row.onPress}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: 14,
                }}
              >
                {row.avatar ? (
                  <Image source={{ uri: row.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : row.isGroup ? (
                  <GroupDisc size={40} />
                ) : (
                  <InitialsDisc name={row.name} size={40} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }} numberOfLines={1}>
                    {row.sub}
                  </Text>
                </View>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.2)',
                    fontSize: 9,
                    fontWeight: '900',
                    letterSpacing: 1.5,
                  }}
                >
                  {row.kind}
                </Text>
              </TouchableOpacity>
            ))
          )
        ) : pins.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 26, paddingHorizontal: 20, gap: 8 }}>
            <Pin size={18} color="#3f3f46" />
            <Text style={[emptyText, { paddingVertical: 0 }]}>
              Nothing pinned yet — pin a friend or group from the web app and it shows up here.
            </Text>
          </View>
        ) : (
          pins.map((pin: any) => {
            const group = pin.kind === 'group' ? myGroups.find((g) => g.id === pin.id) : null;
            const live = pin.kind === 'group' ? null : profileOf(pin.id);
            const avatar =
              pin.kind === 'group'
                ? group?.avatar_url || group?.icon_url || pin.avatar || ''
                : live?.avatar_url || pin.avatar || '';
            const name = (pin.kind === 'group' ? group?.name : live?.display_name) || pin.name;
            const status = pin.kind === 'group' ? null : live?.status || 'offline';
            return (
              <TouchableOpacity
                key={`${pin.kind}-${pin.id}`}
                activeOpacity={0.8}
                onPress={() =>
                  pin.kind === 'group' ? router.push(`/group/${pin.id}`) : openDM(pin.id, name)
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <View>
                  {/* Pin ring — the web twin uses a red→purple gradient; RN has
                      no gradient without another dependency, so the ring is a
                      purple disc with a red rim reading the same at a glance. */}
                  <View
                    style={{
                      padding: 2,
                      borderRadius: 999,
                      backgroundColor: '#7c3aed',
                      borderWidth: 1,
                      borderColor: '#dc2626',
                    }}
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                    ) : pin.kind === 'group' ? (
                      <GroupDisc size={36} />
                    ) : (
                      <InitialsDisc name={name} size={36} />
                    )}
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      left: -4,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: '#050505',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Pin size={9} color="#ef4444" fill="#ef4444" />
                  </View>
                  {status && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: '#050505',
                        backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.offline,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text
                    style={{
                      color: '#a855f7',
                      fontSize: 10,
                      fontWeight: '900',
                      letterSpacing: 1.4,
                      marginTop: 1,
                    }}
                  >
                    {pin.kind === 'group' ? 'PINNED GROUP' : 'PINNED'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}

const underline = (color: string) =>
  ({
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: color,
  });

const emptyText = {
  color: '#52525b',
  fontSize: 12,
  textAlign: 'center' as const,
  paddingVertical: 26,
  lineHeight: 17,
};
