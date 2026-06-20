import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { algorithm, entities } from './apiClient';

// Combined feed: full recent clip pool + ML-ranked clipIds. Matches the
// web FeedPanel merge strategy — algo-ranked clips come first (in order),
// remaining clips appended by recency. Empty algo response falls back to
// pure recency ordering.
export function useClipFeed(currentUserId?: string) {
  const allClipsQ = useQuery({
    queryKey: ['clips'],
    queryFn: () => entities.Clip.list('-created_date', 200),
    staleTime: 30_000,
  });

  const algoFeedQ = useQuery({
    queryKey: ['algo-feed', currentUserId],
    // Server returns `{ clipIds: [...] }`. Coerce defensively.
    queryFn: async () => {
      const res: any = await algorithm.getFeed(100);
      return Array.isArray(res?.clipIds) ? res.clipIds : [];
    },
    enabled: !!currentUserId,
    staleTime: 30_000,
  });

  const merged = useMemo(() => {
    const all: any[] = Array.isArray(allClipsQ.data) ? allClipsQ.data : [];
    const rankedIds: string[] = (algoFeedQ.data as string[]) || [];
    if (all.length === 0) return [];
    if (rankedIds.length === 0) return all;
    const byId = new Map<string, any>();
    for (const c of all) byId.set(String(c.id || c._id), c);
    const out: any[] = [];
    const used = new Set<string>();
    for (const id of rankedIds) {
      const c = byId.get(String(id));
      if (c && !used.has(String(c.id || c._id))) {
        out.push(c);
        used.add(String(c.id || c._id));
      }
    }
    for (const c of all) {
      const k = String(c.id || c._id);
      if (!used.has(k)) out.push(c);
    }
    return out;
  }, [allClipsQ.data, algoFeedQ.data]);

  return {
    data: merged,
    isLoading: allClipsQ.isLoading || algoFeedQ.isLoading,
    isError: allClipsQ.isError,
    refetch: async () => {
      await Promise.all([allClipsQ.refetch(), algoFeedQ.refetch()]);
    },
  };
}

// Friends-only filter on the same merged pool. Accepted friends only.
export function useFriendsClipFeed(currentUserId?: string) {
  const base = useClipFeed(currentUserId);

  const friendsQ = useQuery({
    queryKey: ['friends-accepted', currentUserId],
    queryFn: async () => {
      const list = await entities.Friend.filter({ user_id: currentUserId, status: 'accepted' });
      return Array.isArray(list) ? list : [];
    },
    enabled: !!currentUserId,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const friendIds = new Set(
      ((friendsQ.data as any[]) || []).map((f: any) => String(f.friend_id)).filter(Boolean)
    );
    if (friendIds.size === 0) return [];
    return base.data.filter((c: any) => friendIds.has(String(c.author_id)));
  }, [base.data, friendsQ.data]);

  return {
    data: filtered,
    isLoading: base.isLoading || friendsQ.isLoading,
    isError: base.isError,
    refetch: async () => {
      await Promise.all([base.refetch(), friendsQ.refetch()]);
    },
  };
}
