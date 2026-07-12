import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Smile,
  Sparkles,
  Image as ImageIcon,
  Flame,
  Laugh,
  Heart,
  Gamepad2,
  Star,
  Cat,
  PartyPopper,
  Globe,
} from 'lucide-react-native';
import { entities, integrations } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';

// ── Data ported byte-for-byte from the web pickers ───────────────────────────
// spidr-client/src/components/spidr/EmojiPicker.jsx → standardEmojis
const STANDARD_EMOJIS: Record<string, string[]> = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
  gestures: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  objects: ['🎮', '🎯', '🎲', '🎸', '🎹', '🎺', '🎻', '🥁', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓'],
};

// spidr-client/src/components/spidr/GifPicker.jsx → GIF_CATEGORIES + SYSTEM_GIFS
const GIF_CATEGORIES = [
  { id: 'all', label: 'ALL', Icon: Sparkles },
  { id: 'reactions', label: 'REACT', Icon: Laugh },
  { id: 'hype', label: 'HYPE', Icon: Flame },
  { id: 'aesthetic', label: 'VIBE', Icon: Heart },
  { id: 'gaming', label: 'GAME', Icon: Gamepad2 },
  { id: 'memes', label: 'MEME', Icon: Star },
  { id: 'animals', label: 'PETS', Icon: Cat },
  { id: 'celebration', label: 'PARTY', Icon: PartyPopper },
];

const SYSTEM_GIFS = [
  { id: 1, url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif', cat: 'reactions' },
  { id: 3, url: 'https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif', cat: 'reactions' },
  { id: 8, url: 'https://media.giphy.com/media/26n6Gx9moCgs1pUuk/giphy.gif', cat: 'reactions' },
  { id: 15, url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', cat: 'reactions' },
  { id: 17, url: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif', cat: 'reactions' },
  { id: 18, url: 'https://media.giphy.com/media/xT0xeJpnrWC3XWblEk/giphy.gif', cat: 'reactions' },
  { id: 80, url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', cat: 'reactions' },
  { id: 81, url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', cat: 'reactions' },
  { id: 13, url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', cat: 'hype' },
  { id: 14, url: 'https://media.giphy.com/media/l4FGGafcOHBRc1r2g/giphy.gif', cat: 'hype' },
  { id: 21, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'hype' },
  { id: 82, url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', cat: 'hype' },
  { id: 83, url: 'https://media.giphy.com/media/kyLYXonQYYfwYDIeZl/giphy.gif', cat: 'hype' },
  { id: 2, url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyg/giphy.gif', cat: 'aesthetic' },
  { id: 9, url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', cat: 'aesthetic' },
  { id: 25, url: 'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif', cat: 'aesthetic' },
  { id: 84, url: 'https://media.giphy.com/media/l0ExheuNUNGkQ8y0o/giphy.gif', cat: 'aesthetic' },
  { id: 32, url: 'https://media.giphy.com/media/3oKIPu8oWtzLCqxWwg/giphy.gif', cat: 'gaming' },
  { id: 33, url: 'https://media.giphy.com/media/11BAxHG7paxJcI/giphy.gif', cat: 'gaming' },
  { id: 87, url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif', cat: 'gaming' },
  { id: 88, url: 'https://media.giphy.com/media/du3J3cXyzhj75IOgvA/giphy.gif', cat: 'gaming' },
  { id: 5, url: 'https://media.giphy.com/media/26tPqTOGf1x8VzCAg/giphy.gif', cat: 'memes' },
  { id: 10, url: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif', cat: 'memes' },
  { id: 89, url: 'https://media.giphy.com/media/3o7aCRloybJlXpNjSU/giphy.gif', cat: 'memes' },
  { id: 90, url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', cat: 'memes' },
  { id: 6, url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif', cat: 'animals' },
  { id: 12, url: 'https://media.giphy.com/media/3oz8xLlw6GHVfokaNW/giphy.gif', cat: 'animals' },
  { id: 39, url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif', cat: 'animals' },
  { id: 91, url: 'https://media.giphy.com/media/cfuL5gqFDreXxkWQ4o/giphy.gif', cat: 'animals' },
  { id: 54, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'celebration' },
  { id: 56, url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', cat: 'celebration' },
  { id: 98, url: 'https://media.giphy.com/media/s2qXK8wKkNmmQ/giphy.gif', cat: 'celebration' },
  { id: 99, url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', cat: 'celebration' },
];

export type EmojiSelection =
  | { type: 'standard'; emoji: string }
  | { type: 'custom'; name: string; url: string };

type TabKey = 'custom' | 'standard' | 'gifs';

// ── Picker sheet ─────────────────────────────────────────────────────────────
// Bottom-sheet twin of the web's <EmojiPicker> popover (Server / Emoji / GIFs
// tabs). Emoji taps close the sheet (web parity); GIF taps hand the URL to
// the caller which sends it immediately as an image/gif attachment.
export function EmojiGifPicker({
  visible,
  onClose,
  onEmojiSelect,
  onGifSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (e: EmojiSelection) => void;
  onGifSelect?: (url: string) => void;
}) {
  const { user } = useAuth();
  const { height: screenHeight } = useWindowDimensions();
  const [tab, setTab] = useState<TabKey>('standard');
  const [search, setSearch] = useState('');

  const { data: allServers = [] } = useQuery({
    queryKey: ['all-servers'],
    queryFn: () => entities.Server.list('-created_date', 100),
    enabled: visible,
    staleTime: 60_000,
  });

  const { data: communityEmojis = [] } = useQuery({
    queryKey: ['community-emojis-picker'],
    queryFn: () => entities.CommunityAsset.filter({ type: 'emoji', is_public: true }, '-created_date', 100),
    enabled: visible,
    staleTime: 60_000,
  });

  // Only servers the current user belongs to contribute custom emojis (web parity).
  const customEmojisByServer = useMemo(() => {
    const byServer: Record<string, { serverName: string; emojis: any[] }> = {};
    for (const server of allServers as any[]) {
      const isMember = server?.members?.some((m: any) => m?.user_id === user?.id) || server?.owner_id === user?.id;
      if (!isMember || !server?.emojis?.length) continue;
      byServer[server.id] = { serverName: server.name, emojis: server.emojis };
    }
    return byServer;
  }, [allServers, user?.id]);

  const q = search.trim().toLowerCase();

  const filteredCommunity = useMemo(
    () => (q ? (communityEmojis as any[]).filter((e) => e.name?.toLowerCase().includes(q)) : (communityEmojis as any[])),
    [communityEmojis, q],
  );

  const filteredCustom = useMemo(() => {
    if (!q) return customEmojisByServer;
    const out: typeof customEmojisByServer = {};
    for (const [sid, group] of Object.entries(customEmojisByServer)) {
      const match = group.emojis.filter((e: any) => e.name?.toLowerCase().includes(q));
      if (match.length) out[sid] = { ...group, emojis: match };
    }
    return out;
  }, [customEmojisByServer, q]);

  const pickEmoji = (sel: EmojiSelection) => {
    onEmojiSelect(sel);
    onClose();
  };

  const pickGif = (url: string) => {
    onGifSelect?.(url);
    onClose();
  };

  const sheetHeight = Math.min(screenHeight * 0.62, 520);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Root container — without this wrapper the Pressable+sheet siblings
          lay out unpredictably (empty picker or off-screen sheet), which was
          the "click the tab but nothing opens" symptom. */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />

        {/* Sheet */}
        <View
          style={{
            height: sheetHeight,
            backgroundColor: '#0a0a0a',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: 'rgba(255,51,51,0.25)',
            overflow: 'hidden',
          }}
        >
        {/* Grab handle */}
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </View>

        {/* Tab strip */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 6 }}>
          {(
            [
              { key: 'custom', label: 'SERVER', Icon: Sparkles },
              { key: 'standard', label: 'EMOJI', Icon: Smile },
              ...(onGifSelect ? [{ key: 'gifs', label: 'GIFS', Icon: ImageIcon } as const] : []),
            ] as { key: TabKey; label: string; Icon: any }[]
          ).map(({ key, label, Icon }) => {
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
                  gap: 6,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: active ? 'rgba(255,51,51,0.15)' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: active ? 'rgba(255,51,51,0.4)' : 'rgba(255,255,255,0.05)',
                }}
              >
                <Icon size={13} color={active ? '#FF3333' : '#71717a'} />
                <Text style={{ color: active ? '#fff' : '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'gifs' && onGifSelect ? (
          <GifPanel onGifSelect={pickGif} />
        ) : (
          <>
            {/* Emoji search */}
            <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#18181b',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.07)',
                }}
              >
                <Search size={14} color="#71717a" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search emojis..."
                  placeholderTextColor="#52525b"
                  style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 8, marginLeft: 8 }}
                />
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
              {tab === 'standard' &&
                Object.entries(STANDARD_EMOJIS).map(([category, emojis]) => (
                  <View key={category} style={{ marginBottom: 14 }}>
                    <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
                      {category}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {emojis.map((emoji) => (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => pickEmoji({ type: 'standard', emoji })}
                          style={{ width: '11.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ fontSize: 24 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}

              {tab === 'custom' && (
                <>
                  {filteredCommunity.length > 0 && (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={{ color: '#60a5fa', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 8 }}>
                        HIVE
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                        {filteredCommunity.map((emoji: any) => (
                          <TouchableOpacity
                            key={emoji.id}
                            onPress={() => pickEmoji({ type: 'custom', name: emoji.name, url: emoji.url })}
                            style={{ width: '11.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Image source={{ uri: emoji.url }} style={{ width: 30, height: 30 }} contentFit="contain" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {Object.keys(filteredCustom).length === 0 && filteredCommunity.length === 0 ? (
                    <Text style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingVertical: 28 }}>
                      {q ? 'No emojis found' : 'Join servers or upload emojis to the Hive!'}
                    </Text>
                  ) : (
                    Object.entries(filteredCustom).map(([serverId, { serverName, emojis }]) => (
                      <View key={serverId} style={{ marginBottom: 14 }}>
                        <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
                          {serverName}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                          {emojis.map((emoji: any) => (
                            <TouchableOpacity
                              key={emoji.id}
                              onPress={() => pickEmoji({ type: 'custom', name: emoji.name, url: emoji.url })}
                              style={{ width: '11.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Image source={{ uri: emoji.url }} style={{ width: 30, height: 30 }} contentFit="contain" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </>
        )}
        </View>
      </View>
    </Modal>
  );
}

// ── GIF panel — port of the web GifPicker ────────────────────────────────────
function GifPanel({ onGifSelect }: { onGifSelect: (url: string) => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [searchResults, setSearchResults] = useState<{ url: string; label?: string }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: communityGifs = [] } = useQuery({
    queryKey: ['community-gifs-picker'],
    queryFn: () => entities.CommunityAsset.filter({ type: 'gif', is_public: true }, '-created_date', 50),
    staleTime: 60_000,
  });

  // Same LLM-backed GIF search the web uses (integrations.Core.InvokeLLM).
  const searchGifs = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }
      setSearching(true);
      try {
        const result: any = await integrations.Core.InvokeLLM({
          prompt: `Find 8 popular GIF URLs from giphy.com for: "${query}". Return direct giphy media URLs (https://media.giphy.com/media/XXXX/giphy.gif format).`,
          response_json_schema: {
            type: 'object',
            properties: {
              gifs: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, label: { type: 'string' } } } },
            },
          },
        });
        setSearchResults(result?.gifs || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 700);
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    searchGifs(val);
  };

  const filteredGifs = useMemo(
    () => (category === 'all' ? SYSTEM_GIFS : SYSTEM_GIFS.filter((g) => g.cat === category)),
    [category],
  );

  const GifGrid = ({ gifs }: { gifs: { url: string }[] }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {gifs.map((gif, i) => (
        <TouchableOpacity
          key={`${gif.url}-${i}`}
          onPress={() => onGifSelect(gif.url)}
          style={{
            width: '31.7%',
            aspectRatio: 1,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: '#18181b',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <Image source={{ uri: gif.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* GIF search */}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#18181b',
            borderRadius: 10,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <Search size={14} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={handleSearch}
            placeholder="Search GIFs..."
            placeholderTextColor="#52525b"
            style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 8, marginLeft: 8 }}
          />
          {searching && <ActivityIndicator size="small" color="#FF3333" />}
        </View>
      </View>

      {/* Category chips */}
      {!searchResults && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, maxHeight: 40 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' }}
        >
          {GIF_CATEGORIES.map(({ id, label, Icon }) => {
            const active = category === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setCategory(id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: active ? 'rgba(255,51,51,0.2)' : 'rgba(255,255,255,0.05)',
                }}
              >
                <Icon size={11} color={active ? '#FF3333' : '#71717a'} />
                <Text style={{ color: active ? '#FF3333' : '#71717a', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
        {/* Community Hive GIFs — always shown above the system set (web parity) */}
        {!searchResults && (communityGifs as any[]).length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <Globe size={11} color="#60a5fa" />
              <Text style={{ color: '#60a5fa', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>COMMUNITY HIVE</Text>
            </View>
            <GifGrid gifs={communityGifs as any[]} />
          </View>
        )}

        {searchResults ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
                RESULTS FOR "{search.toUpperCase()}"
              </Text>
              <TouchableOpacity onPress={() => { setSearchResults(null); setSearch(''); }}>
                <Text style={{ color: '#52525b', fontSize: 10 }}>Clear</Text>
              </TouchableOpacity>
            </View>
            {searchResults.length === 0 && !searching ? (
              <Text style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingVertical: 20 }}>
                No GIFs found — try another search.
              </Text>
            ) : (
              <GifGrid gifs={searchResults} />
            )}
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <Sparkles size={11} color="#FF3333" />
              <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>
                {category === 'all' ? 'SYSTEM GIFS' : GIF_CATEGORIES.find((c) => c.id === category)?.label}
              </Text>
            </View>
            <GifGrid gifs={filteredGifs} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
