import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, RefreshCw, Users as UsersIcon, Infinity as InfinityIcon } from 'lucide-react-native';
import { entities, tension } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import SpidrSysChip from '../../components/spidr/SpidrSysChip';

// ─── Welcome banner ────────────────────────────────────────────────────────────
function WelcomeBanner({ name }: { name: string }) {
  return (
    <View
      style={{
        position: 'relative',
        backgroundColor: 'rgba(10,10,10,0.65)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
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
      {/* Mascot housing */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: 'rgba(20,10,22,0.95)',
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 16,
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          elevation: 6,
        }}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 40, height: 40 }}
          resizeMode="contain"
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: 'rgba(239,68,68,0.9)',
            fontSize: 10,
            letterSpacing: 3,
            fontFamily: 'monospace',
            marginBottom: 4,
          }}
        >
          WELCOME BACK
        </Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 26 }} numberOfLines={1}>
          Hey, <Text style={{ color: '#ef4444' }}>{name}</Text>
        </Text>
        <Text style={{ color: '#71717a', fontSize: 13, marginTop: 2 }}>Your web is waiting</Text>
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
}: {
  value: React.ReactNode;
  label: string;
  onPress: () => void;
  redValue?: boolean;
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
          <Sparkles size={18} color="#facc15" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
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
  const { data } = useQuery({
    queryKey: ['feed-mini'],
    queryFn: () => entities.Clip.list('-created_date', 5),
    staleTime: 30_000,
  });
  const posts: any[] = Array.isArray(data) ? data : [];

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
          paddingBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ef4444',
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
        </View>
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

      <View style={{ paddingHorizontal: 12, paddingBottom: 16, gap: 8 }}>
        {posts.length === 0 ? (
          <Text style={{ color: '#52525b', fontSize: 12, paddingVertical: 14, textAlign: 'center' }}>
            No recent activity yet.
          </Text>
        ) : (
          posts.slice(0, 3).map((p) => {
            const avatar = p.author_avatar || p.user_avatar;
            const name = p.author_name || p.username || p.user_name || 'Someone';
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
                <View
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
                </View>
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
    </View>
  );
}

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
    ]);
    setRefreshing(false);
  }, [queryClient, user?.id]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#050505' }}>
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
            onPress={() => router.push('/(tabs)/friends')}
          />
          <StatTile
            value={<InfinityIcon size={28} color="#ef4444" strokeWidth={3} />}
            label="GIFs & Emojis"
            redValue
            onPress={() =>
              Alert.alert(
                'GIFs & Emojis',
                'Coming soon to mobile — open a chat to send them inline for now.',
                [
                  { text: 'Open DMs', onPress: () => router.push('/(tabs)/friends') },
                  { text: 'OK', style: 'cancel' },
                ]
              )
            }
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
            onPress={() => {
              /* AI route doesn't exist on mobile yet */
            }}
          />
        </View>

        <DiscoverPeople currentUserId={user?.id} />

        <ActivityFeed onViewAll={() => router.push('/(tabs)/feed')} />
      </ScrollView>

      <SpidrSysChip />
    </SafeAreaView>
  );
}
