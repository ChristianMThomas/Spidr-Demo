import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Linking,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Terminal,
  Globe,
  Clock,
  Link2,
  Blocks,
  Pencil,
  Music,
  Check,
  X as XIcon,
  MessageCircle,
  UserPlus,
  UserPlus2,
  UserX,
  ShieldAlert,
  Users as UsersIcon,
  Star,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppShell } from '../../lib/appShellContext';
import api, { entities } from '../../lib/apiClient';
import { emitter } from '../../lib/eventEmitter';
import { dmConversationId } from '../../lib/utils';
import { buildUsernameStyleRN } from '../../lib/usernameStyle';
import { useTension } from '../../hooks/useTension';
import { Avatar } from '../ui/Avatar';
import { Spinner } from '../ui/Spinner';
import { NowPlayingCard } from '../spidr/NowPlayingCard';
import { ModuleWidget } from './ModuleWidget';
import { AudioPlayer } from '../chat/AudioPlayer';

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  idle: '#eab308',
  dnd: '#ef4444',
  streaming: '#a855f7',
  offline: '#71717a',
};

const phaseTwo = (label: string) =>
  Alert.alert('Phase 2 — Coming soon', `${label} on mobile lands in Phase 2.`);

// Same reason list the web ReportModal ships.
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

type TabKey = 'bio' | 'modules' | 'mutuals' | 'links';

// Reusable rich profile view. Banner + accent avatar + identity + tabbed
// content — the mobile twin of the web's HolographicProfile modal (small-
// screen layout). Renders inside whatever screen wraps it — the wrapper owns
// the header / back button / settings entry.
//
// Two modes:
//  - No `userId` prop (or own id): renders the CURRENT user from AppShell,
//    with edit affordances (inline Vibe Check / Neon Sign editors).
//  - `userId` of someone else: fetches their UserProfile live and adds the
//    MUTUALS tab + the full action rail (Message / Link Node / Enter User
//    Web / Sever / Flag), mirroring the web profile card.
export function ProfileView({ userId }: { userId?: string }) {
  const { currentUser, userLoaded, refreshCurrentUser } = useAppShell();
  const { level, progress } = useTension();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('bio');

  const isSelf = !userId || userId === currentUser?.id;
  const router = useRouter();

  const {
    data: otherProfile,
    isLoading: otherLoading,
    refetch: refetchOther,
  } = useQuery({
    queryKey: ['profile-of', userId],
    queryFn: async () => {
      const rows = await entities.UserProfile.filter({ user_id: userId! });
      return (rows as any[])[0] || null;
    },
    enabled: !isSelf && !!userId,
    staleTime: 30_000,
  });

  // The raw UserProfile row for the signed-in user. The AppShell merge
  // overwrites the profile doc's own id with the auth user id, so widget
  // saves (PATCH /user-profiles/:id) need this refetch to get the doc id.
  const { data: myProfileRow } = useQuery({
    queryKey: ['profile-row', currentUser?.id],
    queryFn: async () => {
      const rows = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return (rows as any[])[0] || null;
    },
    enabled: isSelf && !!currentUser?.id,
  });

  // ── Friendship + mutuals (other users only) ────────────────────────────────
  const { data: friendship } = useQuery({
    queryKey: ['friendship', currentUser?.id, userId],
    queryFn: async () => {
      const rows = await entities.Friend.filter({ user_id: currentUser?.id, friend_id: userId });
      return (rows as any[])[0] || null;
    },
    enabled: !isSelf && !!currentUser?.id && !!userId,
  });

  const { data: myFriends = [] } = useQuery({
    queryKey: ['all-friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !isSelf && !!currentUser?.id,
  });

  const { data: targetFriends = [] } = useQuery({
    queryKey: ['target-friends', userId],
    queryFn: () => entities.Friend.filter({ user_id: userId, status: 'accepted' }),
    enabled: !isSelf && !!userId,
  });

  const { data: myServers = [] } = useQuery({
    queryKey: ['user-servers', currentUser?.id],
    queryFn: async () => {
      const all = await entities.Server.list();
      return (all as any[]).filter(
        (s) => s.owner_id === currentUser?.id || s.members?.some((m: any) => m.user_id === currentUser?.id),
      );
    },
    enabled: !isSelf && !!currentUser?.id,
  });

  const mutualFriends = useMemo(() => {
    if (isSelf) return [] as any[];
    const mine = new Set((myFriends as any[]).map((f) => f.friend_id));
    return (targetFriends as any[]).filter((f) => mine.has(f.friend_id));
  }, [isSelf, myFriends, targetFriends]);

  const mutualServers = useMemo(() => {
    if (isSelf || !userId) return [] as any[];
    return (myServers as any[]).filter((s) => s.members?.some((m: any) => m.user_id === userId));
  }, [isSelf, myServers, userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isSelf) await refreshCurrentUser();
    else await refetchOther();
    setRefreshing(false);
  };

  // ── Widget saves (Vibe Check / Neon Sign / timezone) — self only ──────────
  const widgetSave = async (key: 'activity' | 'pronouns' | 'timezone', value: string) => {
    const rowId = (myProfileRow as any)?.id;
    if (!rowId) {
      if (key !== 'timezone') Alert.alert('Profile not loaded yet', 'Try again in a moment.');
      return;
    }
    const updates: any = {};
    if (key === 'pronouns') updates.pronouns = value;
    else if (key === 'activity') updates.activity = { ...((myProfileRow as any)?.activity || {}), name: value };
    else if (key === 'timezone') updates.timezone = value;
    try {
      await entities.UserProfile.update(rowId, updates);
      emitter.emit('spidr-profile-updated', { profile: updates });
      queryClient.invalidateQueries({ queryKey: ['profile-row'] });
      queryClient.invalidateQueries({ queryKey: ['profile-of'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err: any) {
      if (key !== 'timezone') Alert.alert('Save failed', err?.message || 'Could not save — try again.');
    }
  };

  // Auto-detect + persist the timezone once on own profile (web BioTab parity)
  // so other viewers see the owner's real local time.
  const tzPersisted = useRef(false);
  useEffect(() => {
    if (!isSelf || tzPersisted.current) return;
    if (!myProfileRow || (myProfileRow as any).timezone) return;
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        tzPersisted.current = true;
        widgetSave('timezone', detected);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelf, myProfileRow]);

  if (isSelf && !userLoaded) return <Spinner />;
  if (!isSelf && otherLoading) return <Spinner />;

  // The merged display object. For other users the UserProfile doc carries
  // everything the card needs; `id` becomes their user_id so NowPlayingCard /
  // ModulesPanel query the right person.
  const subject: any = isSelf
    ? currentUser
    : otherProfile
      ? { ...otherProfile, id: otherProfile.user_id }
      : null;

  if (!subject) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505' }}>
        <Text style={{ color: '#fff' }}>{isSelf ? 'Not signed in.' : 'Profile not found.'}</Text>
      </View>
    );
  }

  const isApex = !!subject?.apex_features || subject?.tier === 'APEX' || subject?.apex_tier === 'apex';
  const accentColor = subject?.username_color || '#dc2626';
  const status = subject?.status || 'offline';
  const statusColor = STATUS_COLOR[status] || STATUS_COLOR.offline;
  const tag = String(subject?.id || '').slice(0, 4) || '0000';
  const handle =
    subject?.username ||
    String(subject?.display_name || 'user').toLowerCase().replace(/\s+/g, '_');
  const subjectName = subject?.display_name || subject?.username || 'User';

  const TABS: { key: TabKey; label: string; Icon: any }[] = [
    { key: 'bio', label: 'BIO', Icon: Terminal },
    { key: 'modules', label: 'MODS', Icon: Blocks },
    ...(!isSelf ? [{ key: 'mutuals' as TabKey, label: 'MUTUALS', Icon: UsersIcon }] : []),
    { key: 'links', label: 'LINKS', Icon: Link2 },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#050505' }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}
    >
      {/* Banner */}
      <View style={{ height: 160, backgroundColor: '#1a0a0a', position: 'relative' }}>
        {subject?.banner_url ? (
          <Image source={{ uri: subject.banner_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1a0a0a', opacity: 0.9 }} />
        )}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, backgroundColor: 'rgba(5,5,5,0.85)' }}
        />
        {isSelf && (
          <TouchableOpacity
            onPress={() => router.push('/edit-profile')}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: 'rgba(0,0,0,0.65)',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Pencil size={10} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar */}
      <View style={{ paddingHorizontal: 20, marginTop: -52 }}>
        <View style={{ width: 96, height: 96, position: 'relative' }}>
          {isApex && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                borderRadius: 22,
                backgroundColor: accentColor,
                opacity: 0.4,
              }}
            />
          )}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              borderWidth: 3,
              borderColor: accentColor + 'A0',
              overflow: 'hidden',
              backgroundColor: '#18181b',
            }}
          >
            <Avatar uri={subject?.avatar_url} name={subjectName} size={90} />
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: statusColor,
              borderWidth: 3,
              borderColor: '#050505',
            }}
          />
          {isSelf && (
            <TouchableOpacity
              onPress={() => router.push('/edit-profile')}
              hitSlop={6}
              style={{
                position: 'absolute',
                bottom: -4,
                left: -4,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#dc2626',
                borderWidth: 2,
                borderColor: '#050505',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pencil size={10} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Identity */}
      <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text
            style={[
              { color: isApex ? accentColor : '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
              buildUsernameStyleRN(subject, { fallbackColor: isApex ? accentColor : '#fff' }).style,
            ]}
          >
            {subjectName}
          </Text>
          {isApex && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#dc2626' }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>APEX</Text>
            </View>
          )}
        </View>

        <Text style={{ color: '#a1a1aa', fontSize: 13, fontFamily: 'monospace', marginTop: 2 }}>
          <Text style={{ color: '#71717a' }}>@</Text>
          <Text style={{ color: '#d4d4d8', fontWeight: '700' }}>{handle}</Text>
          <Text style={{ color: '#52525b' }}>#{tag}</Text>
        </Text>

        {!!subject?.custom_status && (
          <Text style={{ color: '#71717a', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
            {subject.custom_status}
          </Text>
        )}

        {!isSelf && mutualFriends.length > 0 && (
          <Text style={{ color: '#FF3333', fontSize: 10, marginTop: 4 }}>
            {mutualFriends.length} mutual friend{mutualFriends.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Level + Now Playing — tension/XP is only known for the signed-in user */}
      {isSelf && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#0f0f0f',
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.18)',
          }}
        >
          <Award color="#dc2626" size={20} />
          <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 10 }}>Level {level || 1}</Text>
          {progress?.xp != null && (
            <Text style={{ color: '#a1a1aa', marginLeft: 'auto', fontSize: 12, fontWeight: '700' }}>
              {progress.xp} XP
            </Text>
          )}
        </View>
      )}

      <NowPlayingCard userId={subject.id} />

      {/* Tab strip */}
      <View
        style={{
          flexDirection: 'row',
          marginTop: 18,
          marginHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                gap: 5,
                borderBottomWidth: 2,
                borderBottomColor: active ? '#FF3333' : 'transparent',
              }}
            >
              <Icon size={12} color={active ? '#fff' : '#71717a'} />
              <Text style={{ color: active ? '#fff' : '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content — modules get less horizontal padding so widgets can
          breathe (banners/stats grids were cramped at 16px each side). */}
      <View style={{ paddingHorizontal: tab === 'modules' ? 10 : 16, paddingTop: 16, minHeight: 220 }}>
        {tab === 'bio' && (
          <BioPanel currentUser={subject} editable={isSelf} onWidgetSave={isSelf ? widgetSave : undefined} />
        )}
        {tab === 'modules' && <ModulesPanel userId={subject.id} isOwnProfile={isSelf} />}
        {tab === 'mutuals' && !isSelf && (
          <MutualsPanel mutualServers={mutualServers} mutualFriends={mutualFriends} />
        )}
        {tab === 'links' && <LinksPanel socialLinks={subject?.social_links} website={subject?.website} />}
      </View>

      {/* Action rail — other users only (web HolographicProfile parity) */}
      {!isSelf && (
        <ProfileActions
          subjectId={subject.id}
          subjectName={subjectName}
          subjectAvatar={subject?.avatar_url}
          friendship={friendship}
          currentUser={currentUser}
          myServers={myServers as any[]}
        />
      )}
    </ScrollView>
  );
}

// ── Action rail ───────────────────────────────────────────────────────────────
function ProfileActions({
  subjectId,
  subjectName,
  subjectAvatar,
  friendship,
  currentUser,
  myServers,
}: {
  subjectId: string;
  subjectName: string;
  subjectAvatar?: string;
  friendship: any;
  currentUser: any;
  myServers: any[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showServerPicker, setShowServerPicker] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['friendship'] });
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    queryClient.invalidateQueries({ queryKey: ['all-friends'] });
  };

  const myName = currentUser?.display_name || currentUser?.full_name || currentUser?.username || 'User';

  // Both Friend rows, same as the web sendFriendRequest mutation.
  const sendRequest = useMutation({
    mutationFn: async () => {
      await entities.Friend.create({
        user_id: currentUser?.id,
        friend_id: subjectId,
        friend_name: subjectName,
        friend_avatar: subjectAvatar || '',
        status: 'pending_outgoing',
      });
      await entities.Friend.create({
        user_id: subjectId,
        friend_id: currentUser?.id,
        friend_name: myName,
        friend_avatar: currentUser?.avatar_url || '',
        status: 'pending_incoming',
      });
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => Alert.alert('Could not send request', err?.message || 'Try again.'),
  });

  const acceptRequest = useMutation({
    mutationFn: async () => {
      await entities.Friend.update(friendship.id, { status: 'accepted' });
      const outgoing = await entities.Friend.filter({ user_id: subjectId, friend_id: currentUser?.id });
      if ((outgoing as any[])[0]) await entities.Friend.update((outgoing as any[])[0].id, { status: 'accepted' });
    },
    onSuccess: () => invalidate(),
  });

  const blockUser = useMutation({
    mutationFn: async () => {
      if (friendship) {
        await entities.Friend.update(friendship.id, { status: 'blocked' });
      } else {
        await entities.Friend.create({
          user_id: currentUser?.id,
          friend_id: subjectId,
          friend_name: subjectName,
          status: 'blocked',
        });
      }
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  const confirmBlock = () =>
    Alert.alert('Sever connection?', `${subjectName} won't be able to message you or see your activity.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => blockUser.mutate() },
    ]);

  const openDM = () => {
    const convoId = dmConversationId(currentUser?.id, subjectId);
    router.push({
      pathname: '/dm/[id]',
      params: { id: convoId, friendId: subjectId, friendName: subjectName },
    } as any);
  };

  const enterUserWeb = () =>
    router.push({ pathname: '/user-web/[id]', params: { id: subjectId, name: subjectName } } as any);

  const status = friendship?.status;

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 18, gap: 8 }}>
      {status === 'blocked' ? (
        <View style={{ paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center' }}>
          <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>BLOCKED</Text>
        </View>
      ) : status === 'pending_incoming' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton
            label="Accept"
            icon={<Check size={14} color="#fff" />}
            bg="#16a34a"
            color="#fff"
            onPress={() => acceptRequest.mutate()}
            busy={acceptRequest.isPending}
          />
          <ActionButton
            label="Deny"
            icon={<XIcon size={14} color="#a1a1aa" />}
            bg="rgba(0,0,0,0.8)"
            color="#a1a1aa"
            bordered
            onPress={confirmBlock}
          />
        </View>
      ) : status === 'pending_outgoing' ? (
        <View
          style={{
            paddingVertical: 11,
            borderRadius: 12,
            backgroundColor: 'rgba(234,179,8,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(234,179,8,0.25)',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#eab308', fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>
            SIGNAL SENT — PENDING
          </Text>
        </View>
      ) : status === 'accepted' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton
            label="Message"
            icon={<MessageCircle size={14} color="#000" />}
            bg="#fff"
            color="#000"
            onPress={openDM}
          />
          <ActionButton
            label="Add"
            icon={<UserPlus2 size={14} color="#d4d4d8" />}
            bg="rgba(0,0,0,0.8)"
            color="#d4d4d8"
            bordered
            onPress={() => setShowServerPicker(true)}
          />
          <NicknameButton friendship={friendship} invalidate={invalidate} />
          <CloseFriendStar friendship={friendship} invalidate={invalidate} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton
            label="Link Node"
            icon={<UserPlus size={14} color="#fff" />}
            bg="#FF3333"
            color="#fff"
            onPress={() => sendRequest.mutate()}
            busy={sendRequest.isPending}
          />
          <ActionButton
            label="Message"
            icon={<MessageCircle size={14} color="#000" />}
            bg="#fff"
            color="#000"
            onPress={openDM}
          />
        </View>
      )}

      {/* [ ENTER USER WEB ] */}
      {status !== 'blocked' && (
        <TouchableOpacity
          onPress={enterUserWeb}
          activeOpacity={0.85}
          style={{
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(220,38,38,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.4)',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#ef4444', fontSize: 11, fontFamily: 'monospace', letterSpacing: 4, fontWeight: '700' }}>
            [ ENTER USER WEB ]
          </Text>
        </TouchableOpacity>
      )}

      {/* Defensive row */}
      {status !== 'blocked' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={confirmBlock}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <UserX size={12} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              Block
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowReport(true)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <ShieldAlert size={12} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              Report
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <AddToServerSheet
        visible={showServerPicker}
        onClose={() => setShowServerPicker(false)}
        servers={myServers}
        subjectId={subjectId}
        subjectName={subjectName}
        currentUser={currentUser}
      />

      <ReportSheet
        visible={showReport}
        onClose={() => setShowReport(false)}
        subjectId={subjectId}
        subjectName={subjectName}
        currentUser={currentUser}
      />
    </View>
  );
}

// Private nickname for this friend — mirrors the web FriendsPanel's rename
// action. Writes Friend.nickname, which the friends list reads in preference
// to their display_name. Only you ever see it.
function NicknameButton({ friendship, invalidate }: { friendship: any; invalidate: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(friendship?.nickname || '');
  const [busy, setBusy] = useState(false);
  const has = !!friendship?.nickname;

  useEffect(() => { setValue(friendship?.nickname || ''); }, [friendship?.nickname]);

  const save = async (next: string) => {
    if (!friendship?.id) return;
    setBusy(true);
    try {
      await entities.Friend.update(friendship.id, { nickname: next.trim() });
      invalidate();
      setOpen(false);
    } catch {
      Alert.alert('Could not save nickname', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={{
          width: 44,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: has ? 'rgba(255,51,51,0.15)' : 'rgba(0,0,0,0.8)',
          borderWidth: 1,
          borderColor: has ? 'rgba(255,51,51,0.5)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <Pencil size={14} color={has ? '#FF3333' : '#a1a1aa'} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400, gap: 16, padding: 22, borderRadius: 20,
              backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Set a nickname</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 18 }}>
                Only you can see this. Leave it blank to go back to their own name.
              </Text>
            </View>

            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Enter nickname…"
              placeholderTextColor="rgba(255,255,255,0.25)"
              maxLength={32}
              autoFocus
              style={{
                height: 46, paddingHorizontal: 14, borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)', color: '#fff', fontSize: 14,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {has && (
                <TouchableOpacity
                  onPress={() => save('')}
                  disabled={busy}
                  style={{
                    flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                  }}
                >
                  <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '600' }}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => save(value)}
                disabled={busy}
                style={{
                  flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#dc2626', opacity: busy ? 0.5 : 1,
                }}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// Star toggle marking this friend as "close" — the recipient's DND +
// urgent_dms combo lets close-friend signals ring through.
function CloseFriendStar({ friendship, invalidate }: { friendship: any; invalidate: () => void }) {
  const [on, setOn] = useState<boolean>(!!friendship?.is_close_friend);
  useEffect(() => { setOn(!!friendship?.is_close_friend); }, [friendship?.is_close_friend]);
  const toggle = async () => {
    if (!friendship?.id) return;
    const next = !on;
    setOn(next); // optimistic
    try {
      await api.patch(`/friends/${friendship.id}/close`, { close: next });
      invalidate();
    } catch {
      setOn(!next);
    }
  };
  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.85}
      style={{
        width: 44,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.8)',
        borderWidth: 1,
        borderColor: on ? 'rgba(234,179,8,0.5)' : 'rgba(255,255,255,0.1)',
      }}
    >
      <Star size={14} color={on ? '#eab308' : '#a1a1aa'} fill={on ? '#eab308' : 'none'} />
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  icon,
  bg,
  color,
  bordered,
  busy,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
  bordered?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.85}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: bordered ? 1 : 0,
        borderColor: 'rgba(255,255,255,0.1)',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon}
      <Text style={{ color, fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Add to Server — consent-based invite via DM (web parity) ─────────────────
function AddToServerSheet({
  visible,
  onClose,
  servers,
  subjectId,
  subjectName,
  currentUser,
}: {
  visible: boolean;
  onClose: () => void;
  servers: any[];
  subjectId: string;
  subjectName: string;
  currentUser: any;
}) {
  const [sendingId, setSendingId] = useState<string | null>(null);

  const invite = async (server: any) => {
    if (server.members?.some((m: any) => m.user_id === subjectId)) return;
    setSendingId(server.id);
    try {
      // Send the invite as a DirectMessage. The recipient's DM client sees
      // `is_server_invite=true` and renders the interactive invite card —
      // membership only changes when THEY accept (consent-based, web parity).
      const conversationId = dmConversationId(currentUser?.id, subjectId);
      await entities.DirectMessage.create({
        conversation_id: conversationId,
        sender_id: currentUser?.id,
        sender_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
        sender_avatar: currentUser?.avatar_url || '',
        receiver_id: subjectId,
        recipient_id: subjectId,
        content: `🕷️ Invited you to ${server.name}`,
        is_server_invite: true,
        server_invite_data: {
          server_id: server.id,
          server_name: server.name,
          server_icon: server.icon_url || '',
          server_description: server.description || '',
          member_count: (server.members || []).length,
          inviter_id: currentUser?.id,
          inviter_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
          members_snapshot: server.members || [],
        },
      });
      onClose();
      Alert.alert('Invite sent', `${subjectName} will see it in your DMs.`);
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
          maxHeight: 420,
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
          ADD TO SERVER
        </Text>
        {servers.length === 0 ? (
          <Text style={{ color: '#71717a', fontSize: 12, paddingVertical: 16, textAlign: 'center' }}>
            You're not in any servers yet. Join or create one first.
          </Text>
        ) : (
          <ScrollView>
            {servers.map((s) => {
              const already = s.members?.some((m: any) => m.user_id === subjectId);
              return (
                <TouchableOpacity
                  key={s.id}
                  disabled={already || sendingId === s.id}
                  onPress={() => invite(s)}
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
                    opacity: already ? 0.45 : 1,
                  }}
                >
                  {s.icon_url ? (
                    <Image source={{ uri: s.icon_url }} style={{ width: 32, height: 32, borderRadius: 8 }} />
                  ) : (
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,51,51,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#FF3333', fontSize: 13, fontWeight: '900' }}>
                        {(s.name || 'S').charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {already && <Text style={{ color: '#71717a', fontSize: 10 }}>Already a member</Text>}
                  </View>
                  {sendingId === s.id && <ActivityIndicator size="small" color="#FF3333" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── Report sheet — same reasons/shape as the web ReportModal ─────────────────
function ReportSheet({
  visible,
  onClose,
  subjectId,
  subjectName,
  currentUser,
}: {
  visible: boolean;
  onClose: () => void;
  subjectId: string;
  subjectName: string;
  currentUser: any;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const reasonObj = REPORT_REASONS.find((r) => r.id === reason);
      await entities.Report.create({
        reporter_id: currentUser?.id,
        reporter_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
        target_type: 'user',
        target_id: subjectId,
        target_name: subjectName,
        reason,
        details,
        severity: reasonObj?.severity || 'medium',
        status: 'pending',
      });
      onClose();
      setReason(null);
      setDetails('');
      Alert.alert('Report submitted', 'Our team will review it.');
    } catch (err: any) {
      Alert.alert('Could not submit report', err?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(239,68,68,0.3)',
          padding: 16,
          paddingBottom: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldAlert size={16} color="#ef4444" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
            REPORT {subjectName.toUpperCase()}
          </Text>
        </View>

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
          onPress={submit}
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
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>SUBMIT REPORT</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── BIO ────────────────────────────────────────────────────────────────────
function BioPanel({
  currentUser,
  editable = true,
  onWidgetSave,
}: {
  currentUser: any;
  editable?: boolean;
  onWidgetSave?: (key: 'activity' | 'pronouns' | 'timezone', value: string) => Promise<void> | void;
}) {
  const [localTime, setLocalTime] = useState('');
  const tz = currentUser?.timezone || undefined;
  const tzLabel = useMemo(() => {
    if (currentUser?.location) return currentUser.location;
    if (tz) return tz.split('/').slice(-1)[0]?.replace(/_/g, ' ') || tz;
    return 'Local';
  }, [tz, currentUser?.location]);

  useEffect(() => {
    const update = () => {
      try {
        setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz }));
      } catch {
        setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [tz]);

  return (
    <View style={{ gap: 10 }}>
      <Row label={`LOCAL TIME (${tzLabel})`} icon={<Globe size={11} color="#60a5fa" />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock size={11} color="#a1a1aa" />
          <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>{localTime}</Text>
        </View>
      </Row>

      <View
        style={{
          padding: 12,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <Terminal size={10} color="#71717a" />
          <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>SIGNAL BIO</Text>
        </View>
        <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 19 }}>
          {currentUser?.bio || 'No bio data transmitted.'}
        </Text>
      </View>

      {currentUser?.profile_anthem?.title && (
        <View
          style={{
            gap: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(168,85,247,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(168,85,247,0.25)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Music size={14} color="#a855f7" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: '#c084fc', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>PROFILE ANTHEM</Text>
              <Text style={{ color: '#fff', fontSize: 12 }} numberOfLines={1}>
                {currentUser.profile_anthem.title}
                {currentUser.profile_anthem.artist ? ` — ${currentUser.profile_anthem.artist}` : ''}
              </Text>
            </View>
          </View>
          {currentUser.profile_anthem.preview_url && (
            <AudioPlayer url={currentUser.profile_anthem.preview_url} accent="#a855f7" compact />
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <MiniWidget
          label="VIBE CHECK"
          value={currentUser?.activity?.name ? `🎵 ${currentUser.activity.name}` : '🎵 –'}
          editable={editable && !!onWidgetSave}
          initialValue={currentUser?.activity?.name || ''}
          placeholder="Playing..."
          onSave={(v) => onWidgetSave?.('activity', v)}
        />
        <MiniWidget
          label="NEON SIGN"
          value={currentUser?.pronouns || (editable ? '✨ Set sign' : '–')}
          valueColor="#ec4899"
          editable={editable && !!onWidgetSave}
          initialValue={currentUser?.pronouns || ''}
          placeholder="he/him"
          onSave={(v) => onWidgetSave?.('pronouns', v)}
        />
      </View>
    </View>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        backgroundColor: 'rgba(17,17,17,0.8)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

// Editable mini widget — the wired-up version of the web BioTab's Vibe Check /
// Neon Sign cards: tap the pencil, type inline, hit ✓ to PATCH the profile.
function MiniWidget({
  label,
  value,
  valueColor,
  editable,
  initialValue = '',
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  valueColor?: string;
  editable?: boolean;
  initialValue?: string;
  placeholder?: string;
  onSave?: (value: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave?.(val.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: editing ? 'rgba(255,51,51,0.35)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#dc2626', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>{label}</Text>
        {editable && !editing && (
          <TouchableOpacity
            hitSlop={8}
            onPress={() => {
              setVal(initialValue);
              setEditing(true);
            }}
          >
            <Pencil size={10} color="#71717a" />
          </TouchableOpacity>
        )}
      </View>
      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <TextInput
            autoFocus
            value={val}
            onChangeText={setVal}
            placeholder={placeholder}
            placeholderTextColor="#52525b"
            onSubmitEditing={save}
            style={{
              flex: 1,
              color: '#fff',
              fontSize: 12,
              paddingVertical: 2,
              paddingHorizontal: 6,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 6,
            }}
          />
          {saving ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <TouchableOpacity onPress={save} hitSlop={8}>
              <Check size={14} color="#22c55e" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Text
          style={{ color: valueColor || '#fff', fontSize: 12, marginTop: 4, fontWeight: valueColor ? '800' : '500' }}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

// ── MODULES — every installed module renders its LIVE widget ────────────────
function ModulesPanel({ userId, isOwnProfile }: { userId: string; isOwnProfile: boolean }) {
  const { data: installed = [], isLoading } = useQuery({
    queryKey: ['profile-modules', userId],
    queryFn: () => entities.InstalledModule.filter({ user_id: userId }),
    enabled: !!userId,
  });
  const { data: allModules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: () => entities.Module.list('-install_count', 200),
  });

  const installedIds = (installed as any[]).map((i) => i.module_id);
  const modules = (allModules as any[]).filter((m) => installedIds.includes(m.id));

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color="#dc2626" />
      </View>
    );
  }

  if (modules.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Blocks size={24} color="#27272a" />
        <Text style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace', marginTop: 6 }}>
          NO MODULES INSTALLED
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {modules.map((mod: any) => (
        <ModuleWidget key={mod.id} mod={mod} userId={userId} isOwnProfile={isOwnProfile} />
      ))}
    </View>
  );
}

// ── MUTUALS — shared servers + mutual connections (web MutualsTab) ──────────
function MutualsPanel({ mutualServers, mutualFriends }: { mutualServers: any[]; mutualFriends: any[] }) {
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 }}>
          SHARED NODES (SERVERS)
        </Text>
        {mutualServers.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {mutualServers.map((server) => (
              <View
                key={server.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 6,
                  paddingLeft: 6,
                  paddingRight: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                {server.icon_url ? (
                  <Image source={{ uri: server.icon_url }} style={{ width: 26, height: 26, borderRadius: 8 }} />
                ) : (
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      backgroundColor: 'rgba(255,51,51,0.2)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,51,51,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#FF3333', fontSize: 10, fontWeight: '900' }}>
                      {server.name?.charAt(0)}
                    </Text>
                  </View>
                )}
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', maxWidth: 110 }} numberOfLines={1}>
                  {server.name}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: '#52525b', fontSize: 11, fontFamily: 'monospace' }}>No shared servers</Text>
        )}
      </View>

      <View>
        <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 }}>
          MUTUAL CONNECTIONS
        </Text>
        {mutualFriends.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {mutualFriends.map((f) => (
              <View
                key={f.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 6,
                  paddingLeft: 6,
                  paddingRight: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <Avatar uri={f.friend_avatar} name={f.friend_name || '?'} size={24} />
                <Text style={{ color: '#fff', fontSize: 12 }} numberOfLines={1}>
                  {f.friend_name || 'Unknown'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: '#52525b', fontSize: 11, fontFamily: 'monospace' }}>No mutual friends</Text>
        )}
      </View>
    </View>
  );
}

// ── LINKS ──────────────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { label: string; color: string }> = {
  twitter: { label: 'Twitter / X', color: '#38bdf8' },
  youtube: { label: 'YouTube', color: '#ef4444' },
  twitch: { label: 'Twitch', color: '#a855f7' },
  github: { label: 'GitHub', color: '#d4d4d8' },
  discord: { label: 'Discord', color: '#818cf8' },
};

function LinksPanel({ socialLinks, website }: { socialLinks?: any; website?: string }) {
  const links = socialLinks || {};
  const entries = Object.entries(links).filter(([, v]) => !!v);
  const hasAnything = entries.length > 0 || !!website;

  if (!hasAnything) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Link2 size={24} color="#27272a" />
        <Text style={{ color: '#52525b', fontSize: 11, marginTop: 6 }}>No external connections linked</Text>
      </View>
    );
  }

  // Strict scheme allowlist — without this a stored social-link value like
  // `javascript:alert(1)` (or `javascript:http://...` to bypass naive prefix
  // checks) would be handed to Linking.openURL. We normalize to https:// when
  // the user typed a bare domain and reject anything that isn't http(s).
  const open = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return;
    let candidate = trimmed;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
      // bare host (no scheme) — assume https
      candidate = `https://${candidate}`;
    }
    try {
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        Alert.alert('Blocked link', 'Only http and https links can be opened.');
        return;
      }
      Linking.openURL(u.toString()).catch(() => Alert.alert('Could not open link'));
    } catch {
      Alert.alert('Invalid link', 'That URL could not be parsed.');
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {website && <LinkRow label="Website" value={website} color="#34d399" onPress={() => open(website)} />}
      {entries.map(([platform, value]) => {
        const meta = PLATFORM_META[platform] || { label: platform, color: '#a1a1aa' };
        return (
          <LinkRow
            key={platform}
            label={meta.label}
            value={String(value)}
            color={meta.color}
            onPress={() => open(String(value))}
          />
        );
      })}
    </View>
  );
}

function LinkRow({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        backgroundColor: color + '14',
        borderWidth: 1,
        borderColor: color + '4D',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: color + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Text style={{ color, fontSize: 13, fontWeight: '900' }}>{label.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{label.toUpperCase()}</Text>
        <Text style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Link2 size={12} color="#71717a" />
    </TouchableOpacity>
  );
}
