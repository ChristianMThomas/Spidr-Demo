import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { ClipCard } from '../../components/feed/ClipCard';
import { CommentsSheet } from '../../components/feed/CommentsSheet';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

// USER WEB — the [ ENTER USER WEB ] destination from a profile card. A
// vertical snap-scroll archive of every clip this user has published to THE
// WEB, reusing the same ClipCard pager as the main feed tab. Mobile twin of
// the web's `spidr-open-user-clips` flow.
export default function UserWebScreen() {
  const { id: userId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const { height: screenHeight } = Dimensions.get('window');
  const HEADER_HEIGHT = 52;
  const cardHeight = screenHeight - HEADER_HEIGHT;

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentClipId, setCommentClipId] = useState<string | null>(null);

  const { data: clips = [], isLoading } = useQuery({
    queryKey: ['user-clips', userId],
    queryFn: () => entities.Clip.filter({ author_id: userId! }, '-created_date', 100),
    enabled: !!userId,
  });

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80, minimumViewTime: 100 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (!viewableItems?.length) return;
    const first = viewableItems[0];
    if (typeof first.index === 'number') setActiveIndex(first.index);
  }).current;
  const keyExtractor = useCallback((c: any) => String(c.id || c._id), []);

  const displayName = name || 'USER';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: '#000' }}>
        <View
          style={{
            height: HEADER_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(239,68,68,0.15)',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <ArrowLeft size={20} color="#a1a1aa" />
          </TouchableOpacity>
          <Text style={{ color: '#ef4444', fontSize: 12, fontFamily: 'monospace', letterSpacing: 3, fontWeight: '700' }}>
            [ {String(displayName).toUpperCase()}'S WEB ]
          </Text>
          <Text style={{ color: '#52525b', fontSize: 11, marginLeft: 'auto' }}>
            {(clips as any[]).length} clip{(clips as any[]).length !== 1 ? 's' : ''}
          </Text>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <Spinner />
      ) : !(clips as any[]).length ? (
        <EmptyState title="No strands spun yet" hint="This user hasn't published any clips to THE WEB." />
      ) : (
        <FlashList
          data={clips as any[]}
          keyExtractor={keyExtractor}
          pagingEnabled
          snapToInterval={cardHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item, index }) => (
            <ClipCard
              clip={item}
              active={index === activeIndex}
              height={cardHeight}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onOpenComments={(id) => setCommentClipId(id)}
            />
          )}
        />
      )}

      <CommentsSheet clipId={commentClipId} onClose={() => setCommentClipId(null)} />
    </View>
  );
}
