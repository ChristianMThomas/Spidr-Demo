import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../lib/theme';
import { RefreshCw, Users as UsersIcon, Infinity as InfinityIcon, ChevronDown, ChevronRight } from 'lucide-react-native';
import { entities, tension } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { useUnread } from '../../lib/unreadContext';
import SpidrSysChip from '../../components/spidr/SpidrSysChip';
import SpidrWebMatrix from '../../components/spidr/SpidrWebMatrix';

// ─── Typewriter hook ──────────────────────────────────────────────────────────
// Three-phase state machine per message: type in (~55ms/char) → hold (holdMs)
// → backspace out (~35ms/char) → advance. Backspacing keeps transitions
// feeling like a live cursor rather than a hard swap. Caret blinks
// independently (500ms). Resets cleanly if `messages` changes (e.g. the beta
// countdown ticks or the user's name resolves).
function useTypewriter(messages: string[], holdMs = 40000) {
  const [idx, setIdx] = React.useState(0);
  const [typed, setTyped] = React.useState('');
  const [phase, setPhase] = React.useState<'type' | 'hold' | 'delete'>('type');
  const [caret, setCaret] = React.useState(true);
  const msg = messages[idx] || '';

  // Reset when the message set changes so we don't strand stale text.
  React.useEffect(() => {
    setIdx(0);
    setTyped('');
    setPhase('type');
  }, [messages]);

  React.useEffect(() => {
    if (phase === 'type') {
      if (typed.length < msg.length) {
        const t = setTimeout(() => setTyped(msg.slice(0, typed.length + 1)), 55);
        return () => clearTimeout(t);
      }
      setPhase('hold');
      return;
    }
    if (phase === 'hold') {
      const t = setTimeout(() => setPhase('delete'), holdMs);
      return () => clearTimeout(t);
    }
    // delete
    if (typed.length > 0) {
      const t = setTimeout(() => setTyped(typed.slice(0, -1)), 35);
      return () => clearTimeout(t);
    }
    setIdx((i) => (i + 1) % messages.length);
    setPhase('type');
  }, [phase, typed, msg, messages.length, holdMs]);

  React.useEffect(() => {
    const int = setInterval(() => setCaret((c) => !c), 500);
    return () => clearInterval(int);
  }, []);

  return { typed, caret };
}

// ─── Welcome banner ────────────────────────────────────────────────────────────
// Mascot + rotating typewriter greeting. The greeting cycles every 45s between
// "Welcome back, {name}" and a live "{N} days until beta release" countdown to
// Oct 1 2026. No more "SYSTEM UPLINK ESTABLISHED" — read as too techy.
function WelcomeBanner({ name }: { name: string }) {
  const daysUntilBeta = React.useMemo(() => {
    // Month index 9 = October.
    const beta = new Date(2026, 9, 1, 0, 0, 0).getTime();
    const diff = beta - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }, []);

  const messages = React.useMemo(() => {
    const betaLine =
      daysUntilBeta > 0
        ? `${daysUntilBeta} day${daysUntilBeta === 1 ? '' : 's'} until beta release`
        : 'Beta is live';
    return [`Welcome back, ${name}`, betaLine];
  }, [name, daysUntilBeta]);

  const { typed, caret } = useTypewriter(messages, 40000);

  return (
    <View
      style={{
        position: 'relative',
        backgroundColor: 'rgba(10,10,10,0.72)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Web has a soft diagonal red-tint gradient here. RN has no CSS
          gradient and expo-linear-gradient's native module isn't reliably
          registered in this runtime, so we lean on the red hairline + the
          mascot bloom + the red name to carry the warm cast instead. */}
      {/* Hairline top accent */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(239,68,68,0.35)',
        }}
      />
      {/* Mascot — no container, floats over an ambient red bloom */}
      <View
        style={{
          width: 76,
          height: 76,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            bottom: 8,
            borderRadius: 999,
            backgroundColor: 'rgba(239,68,68,0.22)',
            opacity: 0.9,
          }}
        />
        <Image
          source={require('../../assets/spidr-mascot.png')}
          style={{ width: 76, height: 76 }}
          resizeMode="contain"
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: '#fff',
            fontSize: 19,
            fontWeight: '800',
            lineHeight: 24,
            letterSpacing: 0.2,
          }}
          numberOfLines={2}
        >
          {typed}
          <Text style={{ color: '#ef4444', opacity: caret ? 1 : 0 }}>▎</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({
  value,
  label,
  onPress,
  redValue = false,
  badge,
}: {
  value: React.ReactNode;
  label: string;
  onPress: () => void;
  redValue?: boolean;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        backgroundColor: 'rgba(10,10,10,0.6)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 16,
      }}
    >
      <Text
        style={{
          color: redValue ? '#ef4444' : '#fff',
          fontSize: 30,
          fontWeight: '800',
          lineHeight: 32,
          marginBottom: 8,
        }}
      >
        {value}
      </Text>
      <Text style={{ color: '#71717a', fontSize: 12 }}>{label}</Text>
      {!!badge && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: '#dc2626',
            borderRadius: 999,
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#dc2626',
            shadowOpacity: 0.6,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Web Tension bar ──────────────────────────────────────────────────────────
function TensionBar() {
  const { data } = useQuery({
    queryKey: ['tension-me'],
    queryFn: () => tension.me(),
    staleTime: 30000,
  });
  const progress = (data as any)?.progress;
  const level = progress?.level ?? 1;
  const pct = Math.round((progress?.fraction || 0) * 100);

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,51,51,0.2)',
        padding: 14,
        backgroundColor: '#0c0c0c',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: '#dc2626',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 6,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{level}</Text>
        <Text
          style={{
            position: 'absolute',
            bottom: -8,
            color: '#ef4444',
            fontSize: 7,
            fontFamily: 'monospace',
            letterSpacing: 2,
            backgroundColor: 'rgba(0,0,0,0.85)',
            paddingHorizontal: 3,
            borderRadius: 2,
          }}
        >
          LVL
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Web Tension</Text>
          <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace' }}>
            {progress ? `${progress.xpIntoLevel} / ${progress.xpForNextLevel} XP` : '— XP'}
          </Text>
        </View>
        <View
          style={{
            height: 10,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, pct))}%`,
              backgroundColor: '#ef4444',
              borderRadius: 999,
            }}
          />
        </View>
        {progress && (
          <Text style={{ color: '#52525b', fontSize: 10, marginTop: 6 }}>
            {progress.xpToNextLevel} XP until level {level + 1}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Quick action card ────────────────────────────────────────────────────────
function QuickAction({
  title,
  subtitle,
  filled = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        borderRadius: 18,
        padding: 18,
        backgroundColor: filled ? '#dc2626' : 'rgba(10,10,10,0.6)',
        borderWidth: 1,
        borderColor: filled ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)',
        shadowColor: filled ? '#dc2626' : '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: filled ? 0.3 : 0.2,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: filled ? 'rgba(255,255,255,0.85)' : '#a1a1aa', fontSize: 12 }}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

// ─── Discover People (mobile mini) ────────────────────────────────────────────
function DiscoverPeople({ currentUserId }: { currentUserId?: string }) {
  const queryClient = useQueryClient();

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles-discover'],
    queryFn: () => entities.UserProfile.list('-created_date', 50),
    staleTime: 60_000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-discover', currentUserId],
    queryFn: () => entities.Friend.filter({ user_id: currentUserId, status: 'accepted' }),
    enabled: !!currentUserId,
    staleTime: 60_000,
  });

  const friendIds = new Set((friends as any[]).map((f) => f.friend_id));
  const candidates = (allProfiles as any[]).filter(
    (p) => p.user_id && p.user_id !== currentUserId && !friendIds.has(p.user_id)
  );

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
            Discover People
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ['profiles-discover'] });
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#dc2626',
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
          }}
        >
          <RefreshCw size={13} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {candidates.length === 0 ? (
        <View
          style={{
            backgroundColor: 'rgba(10,10,10,0.6)',
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
            paddingVertical: 38,
            alignItems: 'center',
          }}
        >
          <UsersIcon size={42} color="rgba(255,255,255,0.2)" />
          <Text style={{ color: '#71717a', fontSize: 13, marginTop: 10, textAlign: 'center', paddingHorizontal: 24 }}>
            You're connected with everyone on Spidr right now!
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {candidates.slice(0, 3).map((p) => (
            <View
              key={p.id || p.user_id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(10,10,10,0.6)',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
                padding: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#1f1f1f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  overflow: 'hidden',
                }}
              >
                {p.avatar_url ? (
                  <Image source={{ uri: p.avatar_url }} style={{ width: 40, height: 40 }} />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {(p.display_name || p.username || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                  {p.display_name || p.username || 'Unknown'}
                </Text>
                {p.bio ? (
                  <Text style={{ color: '#71717a', fontSize: 12 }} numberOfLines={1}>
                    {p.bio}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Activity Feed (mobile mini) ──────────────────────────────────────────────
function ActivityFeed({ onViewAll }: { onViewAll: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const { data } = useQuery({
    queryKey: ['feed-mini'],
    queryFn: () => entities.Clip.list('-created_date', 5),
    staleTime: 30_000,
  });
  const posts: any[] = Array.isArray(data) ? data : [];

  // Live avatars — clips bake author_avatar in at post time, so someone who
  // changed their pfp since would show the stale one forever. Resolve the
  // authors' CURRENT profiles (comma id list → server $in query) and prefer
  // those; the baked snapshot stays as the fallback while loading.
  const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
  const { data: authorProfiles = [] } = useQuery({
    queryKey: ['feed-mini-authors', authorIds.join(',')],
    queryFn: () => entities.UserProfile.filter({ user_id: authorIds.join(',') }),
    enabled: authorIds.length > 0,
    staleTime: 30_000,
  });
  const liveProfile = (userId?: string) =>
    (authorProfiles as any[]).find((pr) => pr.user_id === userId);

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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: collapsed ? 14 : 10,
        }}
      >
        {/* Header doubles as the collapse control — VIEW ALL stays its own
            tap target so collapsing never swallows a jump to the feed. */}
        <TouchableOpacity
          onPress={() => setCollapsed((v) => !v)}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
        >
          {collapsed ? (
            <ChevronRight size={16} color="rgba(255,255,255,0.6)" />
          ) : (
            <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
          )}
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ef4444',
              marginLeft: 8,
              marginRight: 8,
            }}
          />
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 11,
              fontFamily: 'monospace',
              letterSpacing: 2,
            }}
          >
            ACTIVITY FEED
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewAll}>
          <Text
            style={{
              color: 'rgba(239,68,68,0.85)',
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: 1.8,
            }}
          >
            VIEW ALL →
          </Text>
        </TouchableOpacity>
      </View>

      {!collapsed && (
      <View style={{ paddingHorizontal: 12, paddingBottom: 16, gap: 8 }}>
        {posts.length === 0 ? (
          <Text style={{ color: '#52525b', fontSize: 12, paddingVertical: 14, textAlign: 'center' }}>
            No recent activity yet.
          </Text>
        ) : (
          posts.slice(0, 3).map((p) => {
            const live = liveProfile(p.author_id);
            const avatar = live?.avatar_url || p.author_avatar || p.user_avatar;
            const name = live?.display_name || p.author_name || p.username || p.user_name || 'Someone';
            const text = p.caption || p.text || 'Posted a new clip';
            return (
              <TouchableOpacity
                key={String(p.id || p._id)}
                activeOpacity={0.85}
                onPress={onViewAll}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <TouchableOpacity
                  disabled={!p.author_id}
                  onPress={() => p.author_id && router.push(`/user/${p.author_id}`)}
                  hitSlop={6}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#1f1f1f',
                    marginRight: 10,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={{ width: 36, height: 36 }} />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800' }}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text
                      style={{
                        color: 'rgba(239,68,68,0.85)',
                        fontSize: 9,
                        marginLeft: 6,
                        letterSpacing: 1.4,
                        fontFamily: 'monospace',
                      }}
                    >
                      CLIP
                    </Text>
                  </View>
                  <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
      )}
    </View>
  );
}

// ─── Recent Servers ───────────────────────────────────────────────────────────
// Mirrors the collapsible section under the connections panel on the web
// homepage: monospace header, red status dot, up to four server tiles.
function RecentServers({ servers }: { servers: any[] }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  if (servers.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: 'rgba(10,10,10,0.6)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 16,
      }}
    >
      <TouchableOpacity
        onPress={() => setCollapsed((v) => !v)}
        activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 14 }}
      >
        {collapsed ? (
          <ChevronRight size={16} color="rgba(255,255,255,0.6)" />
        ) : (
          <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
        )}
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: 2,
          }}
        >
          RECENT SERVERS
        </Text>
      </TouchableOpacity>

      {!collapsed && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {servers.slice(0, 4).map((server: any) => (
            <TouchableOpacity
              key={server.id || server._id}
              onPress={() => router.push(`/server/${server.id || server._id}`)}
              activeOpacity={0.85}
              style={{
                width: '47.5%',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                {server.icon_url ? (
                  <Image source={{ uri: server.icon_url }} style={{ width: 48, height: 48 }} />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: '#991b1b',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
                      {(server.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                {server.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { total: unreadTotal } = useUnread();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: allServers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 60_000,
  });

  const myServers = React.useMemo(() => {
    if (!user?.id) return [];
    return (allServers as any[]).filter(
      (s) => s.owner_id === user.id || (s.members || []).some((m: any) => m.user_id === user.id)
    );
  }, [allServers, user?.id]);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: () => entities.Friend.filter({ user_id: user?.id, status: 'accepted' }),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // DB can contain duplicate Friend rows from earlier bidirectional flows
  // (the unique index on (user_id, friend_id) is sparse, so old/null pairs slip
  // through). Dedupe by friend_id so the count reflects unique people.
  const uniqueFriendCount = React.useMemo(() => {
    const ids = new Set<string>();
    for (const f of (friends as any[])) {
      if (f?.friend_id) ids.add(String(f.friend_id));
    }
    return ids.size;
  }, [friends]);

  const greetingName =
    (user?.full_name || '').split(' ')[0] || user?.username || 'spider';

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['servers'] }),
      queryClient.invalidateQueries({ queryKey: ['friends', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['tension-me'] }),
      queryClient.invalidateQueries({ queryKey: ['feed-mini'] }),
      queryClient.invalidateQueries({ queryKey: ['profiles-discover'] }),
      queryClient.invalidateQueries({ queryKey: ['home-recent-dms', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['group-chats', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    ]);
    setRefreshing(false);
  }, [queryClient, user?.id]);

  const colors = useThemeColors();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 116, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
      >
        <WelcomeBanner name={greetingName} />

        {/* Stat strip */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile
            value={myServers.length}
            label="Servers"
            onPress={() => router.push('/(tabs)/servers')}
          />
          <StatTile
            value={uniqueFriendCount}
            label="Friends"
            badge={unreadTotal}
            onPress={() => router.push('/(tabs)/friends')}
          />
          <StatTile
            value={<InfinityIcon size={28} color="#ef4444" strokeWidth={3} />}
            label="GIFs & Emojis"
            redValue
            onPress={() => router.push('/gifs-emojis')}
          />
        </View>

        <TensionBar />

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuickAction
            title="Find Friends"
            subtitle="Connect with others on the web"
            filled
            onPress={() => router.push('/(tabs)/friends')}
          />
          <QuickAction
            title="Try Spidr AI"
            subtitle="Create servers & customize"
            onPress={() => router.push('/spidr-ai')}
          />
        </View>

        <DiscoverPeople currentUserId={user?.id} />

        <ActivityFeed onViewAll={() => router.push('/(tabs)/feed')} />

        {/* Same pair the web homepage shows below the feed on a small screen. */}
        <SpidrWebMatrix currentUserId={user?.id} />

        <RecentServers servers={myServers} />
      </ScrollView>

      <SpidrSysChip />
    </SafeAreaView>
  );
}
