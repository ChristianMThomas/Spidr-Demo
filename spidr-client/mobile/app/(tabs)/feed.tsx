import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Dimensions, RefreshControl } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '../../lib/authContext';
import { useClipFeed, useFriendsClipFeed } from '../../lib/feedQueries';
import { ClipCard } from '../../components/feed/ClipCard';
import { CommentsSheet } from '../../components/feed/CommentsSheet';
import { FeedTabBar, FeedTab } from '../../components/feed/FeedTabBar';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

// THE WEB tab — vertical TikTok-style snap-scroll clip feed. Pager uses
// FlashList with snapToInterval = full screen height so each clip locks
// flush to the viewport. The currently visible clip is the only one that
// autoplays; the rest are paused (and rewound when swiped away).
export default function Feed() {
  const { user } = useAuth();
  const { height: screenHeight } = Dimensions.get('window');
  const TAB_BAR_HEIGHT = 82; // matches (tabs)/_layout.tsx
  const cardHeight = screenHeight - TAB_BAR_HEIGHT;

  // When the WEB tab loses focus (user switches to another tab), no clip may
  // keep playing/audible in the background.
  const isFocused = useIsFocused();
  const [tab, setTab] = useState<FeedTab>('web');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true); // start muted, mobile default
  const [commentClipId, setCommentClipId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const webFeed = useClipFeed(user?.id);
  const linkedFeed = useFriendsClipFeed(user?.id);
  const feed = tab === 'web' ? webFeed : linkedFeed;
  const clips = feed.data;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await feed.refetch();
    setRefreshing(false);
  }, [feed]);

  // Track which card is most-visible. 80% threshold ensures we don't flip
  // active in the middle of a swipe.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (!viewableItems || viewableItems.length === 0) return;
    const first = viewableItems[0];
    if (typeof first.index === 'number') setActiveIndex(first.index);
  }).current;

  // Stable keyExtractor.
  const keyExtractor = useCallback((c: any) => String(c.id || c._id), []);

  // When switching tabs, reset to top so we always autoplay clip 0.
  const listRef = useRef<any>(null);
  const onTabChange = (t: FeedTab) => {
    if (t === tab) return;
    setTab(t);
    setActiveIndex(0);
    setTimeout(() => listRef.current?.scrollToOffset?.({ offset: 0, animated: false }), 30);
  };

  const emptyForTab = useMemo(() => {
    if (tab === 'web') return { title: 'The Web is empty', hint: 'Be the first to spin a strand.' };
    return {
      title: 'No clips from linked nodes yet',
      hint: 'When your friends post, they’ll appear here.',
    };
  }, [tab]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FeedTabBar active={tab} onChange={onTabChange} />

      {feed.isLoading ? (
        <Spinner />
      ) : !clips.length ? (
        <EmptyState title={emptyForTab.title} hint={emptyForTab.hint} />
      ) : (
        <FlashList
          ref={listRef}
          data={clips}
          keyExtractor={keyExtractor}
          pagingEnabled
          snapToInterval={cardHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#dc2626"
              progressBackgroundColor="#0a0a0a"
            />
          }
          renderItem={({ item, index }) => (
            <ClipCard
              clip={item}
              active={isFocused && index === activeIndex}
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
