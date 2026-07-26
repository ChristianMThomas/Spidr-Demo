import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import { ArrowLeft, Grid3x3, Repeat2, Play, Heart, Activity, X } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { ClipCard } from '../../components/feed/ClipCard';
import { CommentsSheet } from '../../components/feed/CommentsSheet';
import { Avatar } from '../../components/ui/Avatar';

// USER WEB — the [ ENTER USER WEB ] destination and the feed's avatar tap.
// Mobile twin of the web's WebProfile.jsx: a stat hero over a STRANDS /
// REPOSTS thumbnail grid. Tapping a thumbnail opens the familiar vertical
// snap-scroll pager for that tab, starting on the clip you picked.
type WebTab = 'strands' | 'reposts';

const GUTTER = 8;

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}

export default function UserWebScreen() {
  const { id: userId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const [tab, setTab] = useState<WebTab>('strands');
  const [pagerIndex, setPagerIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentClipId, setCommentClipId] = useState<string | null>(null);

  // Clips this user published.
  const { data: strandsData, isLoading: strandsLoading } = useQuery({
    queryKey: ['user-clips', userId],
    queryFn: () => entities.Clip.filter({ author_id: userId! }, '-created_date', 100),
    enabled: !!userId,
  });

  // Signal Relays — clips this user amplified onto their own web. Mongo
  // matches a bare value against array membership, so filtering on relays
  // returns every clip whose relays[] contains this user.
  const { data: repostsData, isLoading: repostsLoading } = useQuery({
    queryKey: ['user-reposts', userId],
    queryFn: () => entities.Clip.filter({ relays: userId! }, '-created_date', 100),
    enabled: !!userId,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile-of', userId],
    queryFn: async () => {
      const list = await entities.UserProfile.filter({ user_id: userId! });
      return (list as any[])[0] || null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const strands: any[] = Array.isArray(strandsData) ? strandsData : [];
  const reposts: any[] = Array.isArray(repostsData) ? repostsData : [];
  const clips = tab === 'strands' ? strands : reposts;
  const isLoading = tab === 'strands' ? strandsLoading : repostsLoading;

  const displayName = profile?.display_name || profile?.username || name || 'NODE';
  const nodeId = String(userId || '').slice(-8).toUpperCase() || 'UNKNOWN';

  // Stats mirror WebProfile: strand count, total views, total likes.
  const { impact, resonance } = useMemo(
    () => ({
      impact: strands.reduce((sum, c) => sum + (c.views || 0), 0),
      resonance: strands.reduce((sum, c) => sum + (c.likes?.length || 0), 0),
    }),
    [strands]
  );

  const tileWidth = (screenWidth - GUTTER * 4) / 2;
  const tileHeight = tileWidth * (16 / 9);

  const keyExtractor = useCallback((c: any) => String(c.id || c._id), []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (!viewableItems?.length) return;
    const first = viewableItems[0];
    if (typeof first.index === 'number') setActiveIndex(first.index);
  }).current;

  const openPager = (index: number) => {
    setActiveIndex(index);
    setPagerIndex(index);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* ── HERO ────────────────────────────────────────────────── */}
          <View style={{ paddingBottom: 18 }}>
            {!!profile?.banner_url && (
              <ExpoImage
                source={profile.banner_url}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 230, opacity: 0.2 }}
                contentFit="cover"
              />
            )}

            <View style={{ flexDirection: 'row', padding: 10 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <ArrowLeft size={13} color="#a1a1aa" />
                <Text
                  style={{
                    color: '#a1a1aa',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    letterSpacing: 2,
                    fontWeight: '700',
                  }}
                >
                  BACK TO FEED
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', paddingTop: 6 }}>
              <View
                style={{
                  borderRadius: 44,
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.1)',
                  padding: 2,
                }}
              >
                <Avatar uri={profile?.avatar_url} name={displayName} size={80} />
              </View>

              <Text
                style={{
                  color: '#fff',
                  fontSize: 21,
                  fontWeight: '900',
                  fontStyle: 'italic',
                  letterSpacing: -0.5,
                  marginTop: 12,
                }}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              <Text
                style={{
                  color: '#ef4444',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  marginTop: 4,
                  marginBottom: 16,
                }}
              >
                NODE_ID: {nodeId}
              </Text>

              <View style={{ flexDirection: 'row', gap: 34 }}>
                <StatItem label="STRANDS" value={String(strands.length)} />
                <StatItem label="IMPACT" value={formatCount(impact)} showPulse />
                <StatItem label="LIKES" value={formatCount(resonance)} />
              </View>
            </View>
          </View>

          {/* ── TABS ────────────────────────────────────────────────── */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 44,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(0,0,0,0.9)',
            }}
          >
            <TabButton
              Icon={Grid3x3}
              label="STRANDS"
              active={tab === 'strands'}
              onPress={() => setTab('strands')}
            />
            <TabButton
              Icon={Repeat2}
              label="REPOSTS"
              active={tab === 'reposts'}
              onPress={() => setTab('reposts')}
            />
          </View>

          {/* ── GRID ────────────────────────────────────────────────── */}
          {isLoading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator color="#ef4444" />
            </View>
          ) : clips.length === 0 ? (
            <View style={{ paddingVertical: 60, paddingHorizontal: 32 }}>
              <Text
                style={{
                  color: '#52525b',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  lineHeight: 20,
                }}
              >
                {tab === 'strands'
                  ? 'No strands woven yet.'
                  : 'No relays yet. Hit the relay button on a strand to amplify it to your web.'}
              </Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: GUTTER,
                paddingHorizontal: GUTTER * 1.5,
                paddingTop: GUTTER * 1.5,
              }}
            >
              {clips.map((clip, i) => (
                <StrandTile
                  key={keyExtractor(clip)}
                  clip={clip}
                  width={tileWidth}
                  height={tileHeight}
                  onPress={() => openPager(i)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── PAGER ──────────────────────────────────────────────────── */}
      <Modal
        visible={pagerIndex !== null}
        animationType="slide"
        onRequestClose={() => setPagerIndex(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <FlashList
            data={clips}
            keyExtractor={keyExtractor}
            initialScrollIndex={pagerIndex ?? 0}
            pagingEnabled
            snapToInterval={screenHeight}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            renderItem={({ item, index }) => (
              <ClipCard
                clip={item}
                active={index === activeIndex}
                height={screenHeight}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onOpenComments={(id) => setCommentClipId(id)}
                inAuthorWeb
              />
            )}
          />

          <SafeAreaView
            edges={['top']}
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
          >
            <TouchableOpacity
              onPress={() => setPagerIndex(null)}
              hitSlop={10}
              style={{
                margin: 12,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(0,0,0,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <CommentsSheet clipId={commentClipId} onClose={() => setCommentClipId(null)} />
        </View>
      </Modal>
    </View>
  );
}

function StatItem({
  label,
  value,
  showPulse,
}: {
  label: string;
  value: string;
  showPulse?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {showPulse && <Activity size={12} color="#ef4444" />}
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>{value}</Text>
      </View>
      <Text
        style={{
          color: '#71717a',
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 2,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function TabButton({
  Icon,
  label,
  active,
  onPress,
}: {
  Icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ alignItems: 'center', gap: 4 }}>
      <Icon size={18} color={active ? '#ef4444' : '#71717a'} />
      <Text
        style={{
          color: active ? '#fff' : '#71717a',
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 2,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          height: 2,
          width: 40,
          borderRadius: 1,
          marginTop: 2,
          backgroundColor: active ? '#ef4444' : 'transparent',
        }}
      />
    </TouchableOpacity>
  );
}

function StrandTile({
  clip,
  width,
  height,
  onPress,
}: {
  clip: any;
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width,
        height,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#111',
      }}
    >
      {clip.thumbnail_url ? (
        <ExpoImage
          source={clip.thumbnail_url}
          style={{ width: '100%', height: '100%', opacity: 0.85 }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Play size={24} color="#3f3f46" />
        </View>
      )}

      {/* Stat strip along the bottom edge */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 8,
          paddingVertical: 6,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Play size={10} color="#fff" fill="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
            {formatCount(clip.views || 0)}
          </Text>
        </View>
        {(clip.likes?.length || 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Heart size={10} color="#f87171" fill="#f87171" />
            <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '800' }}>
              {formatCount(clip.likes.length)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
