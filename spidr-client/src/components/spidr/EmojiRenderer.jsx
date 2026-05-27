import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';

// Global hook to fetch all server emojis across the app
export function useGlobalEmojis() {
  const { data: allServers = [] } = useQuery({
    queryKey: ['all-servers-emojis'],
    queryFn: () => entities.Server.list('-created_date', 200),
    staleTime: 60000,
  });

  const { data: communityAssets = [] } = useQuery({
    queryKey: ['community-assets-emojis'],
    queryFn: () => entities.CommunityAsset.filter({ type: 'emoji', is_public: true }, '-created_date', 200),
    staleTime: 60000,
  });

  // Build a map of :name: -> url from all servers + community
  const emojiMap = React.useMemo(() => {
    const map = {};
    allServers.forEach(server => {
      if (server.emojis?.length) {
        server.emojis.forEach(e => {
          if (e.name && e.url) {
            map[`:${e.name}:`] = { url: e.url, name: e.name, animated: e.is_animated, server: server.name };
          }
        });
      }
    });
    communityAssets.forEach(asset => {
      if (asset.name && asset.url) {
        const key = `:${asset.name}:`;
        if (!map[key]) {
          map[key] = { url: asset.url, name: asset.name, animated: false, server: 'Community' };
        }
      }
    });
    return map;
  }, [allServers, communityAssets]);

  return emojiMap;
}

// Renders inline custom emojis from :shortcode: patterns
export function renderEmojis(text, emojiMap) {
  if (!text || !emojiMap || Object.keys(emojiMap).length === 0) return text;

  const emojiRegex = /(:[a-zA-Z0-9_]+:)/g;
  const parts = text.split(emojiRegex);

  const hasOnlyEmojis = parts.every(part => {
    const trimmed = part.trim();
    return trimmed === '' || emojiMap[trimmed];
  });

  return parts.map((part, i) => {
    if (emojiMap[part]) {
      const emoji = emojiMap[part];
      const size = hasOnlyEmojis ? 'w-10 h-10' : 'w-5 h-5';
      return (
        <img
          key={i}
          src={emoji.url}
          alt={emoji.name}
          title={`${part} (${emoji.server})`}
          className={`inline-block ${size} object-contain align-middle mx-0.5 hover:scale-110 transition-transform`}
          draggable={false}
        />
      );
    }
    return part;
  });
}

// Standalone component for rendering text with emojis
export default function EmojiRenderer({ text, emojiMap }) {
  if (!text) return null;
  const rendered = renderEmojis(text, emojiMap);
  if (typeof rendered === 'string') return <span>{rendered}</span>;
  return <span>{rendered}</span>;
}