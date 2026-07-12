import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '../lib/apiClient';

export interface CustomEmoji {
  url: string;
  name: string;
  animated?: boolean;
  server: string;
}

// Mirror of the web's EmojiRenderer.useGlobalEmojis — builds a map of
// `:name:` → emoji meta from every server's custom emojis plus the public
// Hive community assets. Server emojis win name collisions, same as web.
export function useGlobalEmojis(): Record<string, CustomEmoji> {
  const { data: allServers = [] } = useQuery({
    queryKey: ['all-servers-emojis'],
    queryFn: () => entities.Server.list('-created_date', 200),
    staleTime: 60_000,
  });

  const { data: communityAssets = [] } = useQuery({
    queryKey: ['community-assets-emojis'],
    queryFn: () => entities.CommunityAsset.filter({ type: 'emoji', is_public: true }, '-created_date', 200),
    staleTime: 60_000,
  });

  return useMemo(() => {
    const map: Record<string, CustomEmoji> = {};
    for (const server of allServers as any[]) {
      for (const e of server?.emojis || []) {
        if (e?.name && e?.url) {
          map[`:${e.name}:`] = { url: e.url, name: e.name, animated: e.is_animated, server: server.name };
        }
      }
    }
    for (const asset of communityAssets as any[]) {
      if (asset?.name && asset?.url) {
        const key = `:${asset.name}:`;
        if (!map[key]) map[key] = { url: asset.url, name: asset.name, animated: false, server: 'Community' };
      }
    }
    return map;
  }, [allServers, communityAssets]);
}
