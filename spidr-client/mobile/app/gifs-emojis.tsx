import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  Search,
  Layers,
  Globe,
  Plus,
  Sparkles,
  Image as ImageIcon,
  Flame,
  Laugh,
  Heart,
  Gamepad2,
  Star,
  Cat,
  PartyPopper,
  Music,
  Trophy,
  Ghost,
  Pizza,
  Zap,
  Copy,
  Upload,
  X,
  Hash,
} from 'lucide-react-native';
import { entities, integrations } from '../lib/apiClient';
import { useAppShell } from '../lib/appShellContext';
import { pickAndUpload } from '../lib/imageUpload';

// ── Signal Archive (mobile) ──────────────────────────────────────────────────
// Small-screen port of spidr-client/src/pages/GifsEmojis.jsx. Three tabs:
// SYSTEM (built-in GIFs + emoji sections), HIVE (community CommunityAsset
// feed), FABRICATE (upload flow). Tapping a signal copies its URL/emoji to
// the OS clipboard so the user can paste into any DM/channel input.

// ── System-core data — ported byte-for-byte from web SystemArchive.jsx ──────
const GIF_CATEGORIES = [
  { id: 'all', label: 'ALL', Icon: Sparkles },
  { id: 'reactions', label: 'REACT', Icon: Laugh },
  { id: 'hype', label: 'HYPE', Icon: Flame },
  { id: 'aesthetic', label: 'VIBE', Icon: Heart },
  { id: 'music', label: 'MUSIC', Icon: Music },
  { id: 'gaming', label: 'GAME', Icon: Gamepad2 },
  { id: 'memes', label: 'MEME', Icon: Star },
  { id: 'animals', label: 'PETS', Icon: Cat },
  { id: 'food', label: 'FOOD', Icon: Pizza },
  { id: 'sports', label: 'SPORT', Icon: Trophy },
  { id: 'spooky', label: 'SPOOK', Icon: Ghost },
  { id: 'celebration', label: 'PARTY', Icon: PartyPopper },
];

const SYSTEM_GIFS = [
  { id: 1, url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif', cat: 'reactions' },
  { id: 3, url: 'https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif', cat: 'reactions' },
  { id: 8, url: 'https://media.giphy.com/media/26n6Gx9moCgs1pUuk/giphy.gif', cat: 'reactions' },
  { id: 15, url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', cat: 'reactions' },
  { id: 17, url: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif', cat: 'reactions' },
  { id: 18, url: 'https://media.giphy.com/media/xT0xeJpnrWC3XWblEk/giphy.gif', cat: 'reactions' },
  { id: 19, url: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif', cat: 'reactions' },
  { id: 20, url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', cat: 'reactions' },
  { id: 80, url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', cat: 'reactions' },
  { id: 81, url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', cat: 'reactions' },
  { id: 13, url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', cat: 'hype' },
  { id: 14, url: 'https://media.giphy.com/media/l4FGGafcOHBRc1r2g/giphy.gif', cat: 'hype' },
  { id: 21, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'hype' },
  { id: 22, url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', cat: 'hype' },
  { id: 23, url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', cat: 'hype' },
  { id: 24, url: 'https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif', cat: 'hype' },
  { id: 82, url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', cat: 'hype' },
  { id: 83, url: 'https://media.giphy.com/media/kyLYXonQYYfwYDIeZl/giphy.gif', cat: 'hype' },
  { id: 2, url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyg/giphy.gif', cat: 'aesthetic' },
  { id: 9, url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', cat: 'aesthetic' },
  { id: 25, url: 'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif', cat: 'aesthetic' },
  { id: 26, url: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif', cat: 'aesthetic' },
  { id: 27, url: 'https://media.giphy.com/media/26BROrSHlmyzzHf2g/giphy.gif', cat: 'aesthetic' },
  { id: 28, url: 'https://media.giphy.com/media/3oKIPsx2VAYAgEHC12/giphy.gif', cat: 'aesthetic' },
  { id: 84, url: 'https://media.giphy.com/media/l0ExheuNUNGkQ8y0o/giphy.gif', cat: 'aesthetic' },
  { id: 85, url: 'https://media.giphy.com/media/3o7TKUM3IgJBX2as9O/giphy.gif', cat: 'aesthetic' },
  { id: 4, url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', cat: 'music' },
  { id: 11, url: 'https://media.giphy.com/media/l0HlQoXCkFTldy7zG/giphy.gif', cat: 'music' },
  { id: 29, url: 'https://media.giphy.com/media/4oMoIbIQrvCjm/giphy.gif', cat: 'music' },
  { id: 30, url: 'https://media.giphy.com/media/l378p60yRSCeVoyAM/giphy.gif', cat: 'music' },
  { id: 31, url: 'https://media.giphy.com/media/l0HlPystfePnAI3G8/giphy.gif', cat: 'music' },
  { id: 86, url: 'https://media.giphy.com/media/tqfS3mgQU28ko/giphy.gif', cat: 'music' },
  { id: 32, url: 'https://media.giphy.com/media/3oKIPu8oWtzLCqxWwg/giphy.gif', cat: 'gaming' },
  { id: 33, url: 'https://media.giphy.com/media/11BAxHG7paxJcI/giphy.gif', cat: 'gaming' },
  { id: 34, url: 'https://media.giphy.com/media/26tPoyDhjiJ2g7rEs/giphy.gif', cat: 'gaming' },
  { id: 35, url: 'https://media.giphy.com/media/l41YqKTI3pFKuI9CE/giphy.gif', cat: 'gaming' },
  { id: 87, url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif', cat: 'gaming' },
  { id: 88, url: 'https://media.giphy.com/media/du3J3cXyzhj75IOgvA/giphy.gif', cat: 'gaming' },
  { id: 5, url: 'https://media.giphy.com/media/26tPqTOGf1x8VzCAg/giphy.gif', cat: 'memes' },
  { id: 10, url: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif', cat: 'memes' },
  { id: 16, url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', cat: 'memes' },
  { id: 36, url: 'https://media.giphy.com/media/xT9IgDEI1iZyb2wqo8/giphy.gif', cat: 'memes' },
  { id: 37, url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', cat: 'memes' },
  { id: 38, url: 'https://media.giphy.com/media/l0HlvtIPdijkIVCrC/giphy.gif', cat: 'memes' },
  { id: 89, url: 'https://media.giphy.com/media/3o7aCRloybJlXpNjSU/giphy.gif', cat: 'memes' },
  { id: 90, url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', cat: 'memes' },
  { id: 6, url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif', cat: 'animals' },
  { id: 12, url: 'https://media.giphy.com/media/3oz8xLlw6GHVfokaNW/giphy.gif', cat: 'animals' },
  { id: 39, url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif', cat: 'animals' },
  { id: 40, url: 'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif', cat: 'animals' },
  { id: 41, url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', cat: 'animals' },
  { id: 42, url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', cat: 'animals' },
  { id: 91, url: 'https://media.giphy.com/media/cfuL5gqFDreXxkWQ4o/giphy.gif', cat: 'animals' },
  { id: 92, url: 'https://media.giphy.com/media/nR4L10XlJcSeQ/giphy.gif', cat: 'animals' },
  { id: 7, url: 'https://media.giphy.com/media/3og0INAY5MLmEBubyU/giphy.gif', cat: 'food' },
  { id: 43, url: 'https://media.giphy.com/media/xT0xeMA62E1XIlqYb6/giphy.gif', cat: 'food' },
  { id: 44, url: 'https://media.giphy.com/media/l0Exk8EUzSLsGtH1e/giphy.gif', cat: 'food' },
  { id: 45, url: 'https://media.giphy.com/media/IgOEWPOgK6kVa/giphy.gif', cat: 'food' },
  { id: 93, url: 'https://media.giphy.com/media/xTiTnMjBKwMH2rY4fu/giphy.gif', cat: 'food' },
  { id: 94, url: 'https://media.giphy.com/media/RMkX4jGnnf5Re/giphy.gif', cat: 'food' },
  { id: 46, url: 'https://media.giphy.com/media/3o7TKMeCOV3oXSb5bq/giphy.gif', cat: 'sports' },
  { id: 47, url: 'https://media.giphy.com/media/26n6WywJyh39n9pBu/giphy.gif', cat: 'sports' },
  { id: 48, url: 'https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy.gif', cat: 'sports' },
  { id: 49, url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', cat: 'sports' },
  { id: 95, url: 'https://media.giphy.com/media/l0HlHSB8v5yRtBlHW/giphy.gif', cat: 'sports' },
  { id: 96, url: 'https://media.giphy.com/media/3og0IExSrnfW2kUaaI/giphy.gif', cat: 'sports' },
  { id: 50, url: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif', cat: 'spooky' },
  { id: 51, url: 'https://media.giphy.com/media/xT9IgFLBcm3Wi6l6qA/giphy.gif', cat: 'spooky' },
  { id: 52, url: 'https://media.giphy.com/media/l2JeiAyDGST19bO6c/giphy.gif', cat: 'spooky' },
  { id: 53, url: 'https://media.giphy.com/media/3otPoJhe5AZrhllEBy/giphy.gif', cat: 'spooky' },
  { id: 97, url: 'https://media.giphy.com/media/l378BzHA5FwWFXVSg/giphy.gif', cat: 'spooky' },
  { id: 54, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'celebration' },
  { id: 55, url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', cat: 'celebration' },
  { id: 56, url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', cat: 'celebration' },
  { id: 57, url: 'https://media.giphy.com/media/26tOZ42Mg6r8qiB7a/giphy.gif', cat: 'celebration' },
  { id: 98, url: 'https://media.giphy.com/media/s2qXK8wKkNmmQ/giphy.gif', cat: 'celebration' },
  { id: 99, url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', cat: 'celebration' },
];

const EMOJI_SECTIONS: Record<string, string[]> = {
  'TRENDING SIGNALS': ['😭', '💀', '🔥', '✨', '💅', '🤌', '💯', '🤝', '💪', '🫶', '🤙', '😈', '👀', '🥺', '🤡', '🙄', '😩', '🤪', '😳', '😤'],
  'AESTHETIC CORE': ['🌸', '🦋', '✨', '🌙', '⭐', '💫', '🌈', '🍓', '🧚‍♀️', '🎀', '💖', '🫧', '🪷', '🌺', '💎', '🔮', '🕯️', '🌿', '☁️', '🦢'],
  'DARK ENERGY': ['💀', '🖤', '⛓️', '🕷️', '🩸', '👁️', '🦇', '🌑', '⚰️', '🔪', '👻', '💣', '🫀', '☠️', '🐍', '🪦', '⚡', '🌪️', '🥀', '🔮'],
  'CREATURE LAB': ['🐈', '🐕', '🦋', '🐸', '🦆', '🦊', '🐰', '🦥', '🐌', '🦇', '🐝', '🦖', '🐙', '🦑', '🪼', '🐺', '🦈', '🐊', '🦅', '🦎'],
  'FUEL STATION': ['🍕', '☕', '🍔', '🌮', '🍜', '🍰', '🍪', '🍩', '🧃', '🧋', '🍓', '🥑', '🍣', '🌶️', '🫕', '🍿', '🥡', '🍱', '🥟', '🫘'],
  'POWER GLYPHS': ['⚡', '❤️‍🔥', '🧿', '🪬', '💝', '🔱', '♾️', '🏴‍☠️', '🎯', '🛡️', '⚔️', '🪩', '🎪', '🎭', '🎲', '🀄', '🃏', '♟️', '🧩', '🎮'],
  'HAND SIGNALS': ['👋', '✌️', '🤞', '🫰', '🤟', '🤘', '🫵', '👆', '👇', '👈', '👉', '👍', '👎', '👊', '✊', '🤜', '🤛', '👏', '🙌', '🫶'],
  'FACE MATRIX': ['😀', '😂', '🥲', '😊', '😎', '🤓', '🥳', '😏', '😑', '😶‍🌫️', '🫠', '🤥', '😬', '🫡', '🤫', '🫢', '😵‍💫', '🤑', '🥴', '😇'],
  'LOVE & HEARTS': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '❤️‍🔥', '❤️‍🩹'],
  'NATURE SIGNALS': ['🌍', '🌎', '🌏', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '⭐', '🌟', '💫', '✨', '☀️', '🌤️', '⛅', '🌈'],
  'FLAG CODES': ['🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🚩', '🏁', '🏴', '🏳️', '🎌', '🇺🇸', '🇬🇧', '🇯🇵', '🇰🇷', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇧🇷', '🇨🇦', '🇦🇺', '🇲🇽'],
  'ACTIVITY NODES': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳'],
  'TRANSPORT WEB': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '✈️', '🚀'],
};

type TabId = 'system' | 'hive' | 'fabricator';
type SubTab = 'gifs' | 'emojis';

// ── Tiny slide-in toast — no dep. Sits below the header. ─────────────────────
function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const y = useRef(new Animated.Value(-60)).current;

  const show = useCallback((next: string) => {
    setMsg(next);
    Animated.timing(y, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(y, { toValue: -60, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setMsg(null));
      }, 1200);
    });
  }, [y]);

  const node = msg ? (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center',
        transform: [{ translateY: y }], zIndex: 1000,
      }}
    >
      <View style={{ backgroundColor: '#FF3333', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, shadowColor: '#FF3333', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{msg}</Text>
      </View>
    </Animated.View>
  ) : null;

  return { show, node };
}

export default function GifsEmojisScreen() {
  const router = useRouter();
  const { currentUser } = useAppShell();
  const [tab, setTab] = useState<TabId>('system');
  const [subTab, setSubTab] = useState<SubTab>('gifs');
  const [search, setSearch] = useState('');
  const { show: toast, node: toastNode } = useToast();

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    toast(label);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#050505' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10,
          borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 8,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3333' }} />
            <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>
              EXPRESSION_ENGINE
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.3 }}>
            Signal <Text style={{ color: '#FF3333' }}>Archive</Text>
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f0f0f',
            borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <Search size={14} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search signals..."
            placeholderTextColor="#52525b"
            style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 9, marginLeft: 8 }}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <X size={14} color="#71717a" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main tab strip */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 6 }}>
        {(
          [
            { key: 'system', label: 'SYSTEM', Icon: Layers, color: '#fff' },
            { key: 'hive', label: 'HIVE', Icon: Globe, color: '#3B82F6' },
            { key: 'fabricator', label: 'FABRICATE', Icon: Plus, color: '#FF3333' },
          ] as { key: TabId; label: string; Icon: any; color: string }[]
        ).map(({ key, label, Icon, color }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, paddingVertical: 9, borderRadius: 10,
                backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderWidth: 1, borderColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              }}
            >
              <Icon size={13} color={active ? color : '#52525b'} />
              <Text style={{ color: active ? '#fff' : '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Panel */}
      <View style={{ flex: 1, marginTop: 8 }}>
        {tab === 'system' && (
          <SystemPanel
            subTab={subTab}
            setSubTab={setSubTab}
            search={search}
            onCopyGif={(url) => copy(url, 'GIF LINK COPIED')}
            onCopyEmoji={(emoji) => copy(emoji, `COPIED ${emoji}`)}
          />
        )}
        {tab === 'hive' && (
          <HivePanel
            search={search}
            currentUserId={currentUser?.id}
            onCopyAsset={(url) => copy(url, 'SIGNAL COPIED')}
          />
        )}
        {tab === 'fabricator' && (
          <FabricatorPanel
            currentUser={currentUser}
            onDone={() => {
              toast('SIGNAL TRANSMITTED');
              setTab('hive');
            }}
          />
        )}
      </View>

      {toastNode}
    </SafeAreaView>
  );
}

// ── SYSTEM tab ──────────────────────────────────────────────────────────────
function SystemPanel({
  subTab, setSubTab, search, onCopyGif, onCopyEmoji,
}: {
  subTab: SubTab;
  setSubTab: (t: SubTab) => void;
  search: string;
  onCopyGif: (url: string) => void;
  onCopyEmoji: (emoji: string) => void;
}) {
  const [gifCat, setGifCat] = useState('all');
  const [searchResults, setSearchResults] = useState<{ url: string; label?: string }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced LLM GIF search — same integration the web SystemArchive uses.
  useEffect(() => {
    if (subTab !== 'gifs') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result: any = await integrations.Core.InvokeLLM({
          prompt: `Find 12 popular GIF URLs from giphy.com for: "${search}". Return direct giphy media URLs (https://media.giphy.com/media/XXXX/giphy.gif format).`,
          response_json_schema: {
            type: 'object',
            properties: {
              gifs: {
                type: 'array',
                items: { type: 'object', properties: { url: { type: 'string' }, label: { type: 'string' } } },
              },
            },
          },
        });
        setSearchResults(result?.gifs || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, subTab]);

  const filteredGifs = useMemo(
    () => (gifCat === 'all' ? SYSTEM_GIFS : SYSTEM_GIFS.filter((g) => g.cat === gifCat)),
    [gifCat],
  );

  const q = search.trim().toLowerCase();
  const emojiSectionsFiltered = useMemo(() => {
    if (!q) return EMOJI_SECTIONS;
    const out: Record<string, string[]> = {};
    for (const [k, list] of Object.entries(EMOJI_SECTIONS)) {
      if (k.toLowerCase().includes(q)) out[k] = list;
    }
    return out;
  }, [q]);

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 6, paddingBottom: 8 }}>
        {[
          { id: 'gifs' as const, label: 'GIFS', Icon: ImageIcon },
          { id: 'emojis' as const, label: 'EMOJIS', Icon: Sparkles },
        ].map(({ id, label, Icon }) => {
          const active = subTab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setSubTab(id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: active ? 'rgba(255,51,51,0.15)' : 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: active ? 'rgba(255,51,51,0.4)' : 'rgba(255,255,255,0.06)',
              }}
            >
              <Icon size={12} color={active ? '#FF3333' : '#71717a'} />
              <Text style={{ color: active ? '#FF3333' : '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {subTab === 'gifs' ? (
        <>
          {/* Category chips */}
          {!searchResults && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, maxHeight: 40 }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 4, gap: 6, alignItems: 'center' }}
            >
              {GIF_CATEGORIES.map(({ id, label, Icon }) => {
                const active = gifCat === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setGifCat(id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: active ? 'rgba(255,51,51,0.2)' : 'rgba(255,255,255,0.05)',
                      borderWidth: 1, borderColor: active ? 'rgba(255,51,51,0.4)' : 'rgba(255,255,255,0.05)',
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

          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 8 }}>
            {searching && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
                <ActivityIndicator size="small" color="#FF3333" />
                <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>SEARCHING...</Text>
              </View>
            )}
            {searchResults ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Zap size={11} color="#FF3333" />
                    <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
                      AI RESULTS "{search.toUpperCase()}"
                    </Text>
                  </View>
                </View>
                {searchResults.length === 0 && !searching ? (
                  <Text style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingVertical: 24 }}>
                    No GIFs found — try another search.
                  </Text>
                ) : (
                  <GifGrid gifs={searchResults} onPress={onCopyGif} />
                )}
              </View>
            ) : (
              <GifGrid gifs={filteredGifs} onPress={onCopyGif} />
            )}
          </ScrollView>
        </>
      ) : (
        // EMOJIS
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
          {Object.entries(emojiSectionsFiltered).map(([title, emojis]) => (
            <View key={title} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF3333' }} />
                <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>{title}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {emojis.map((e, i) => (
                  <TouchableOpacity
                    key={`${title}-${i}`}
                    onPress={() => onCopyEmoji(e)}
                    style={{
                      width: '14.5%', aspectRatio: 1, borderRadius: 10,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {Object.keys(emojiSectionsFiltered).length === 0 && (
            <Text style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingVertical: 24 }}>
              No matching section — clear search to see all.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// GIF grid — 3 columns. `31.7%` matches the rest of mobile's picker sheets.
function GifGrid({
  gifs,
  onPress,
}: {
  gifs: { url: string; id?: any }[];
  onPress: (url: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {gifs.map((g, i) => (
        <TouchableOpacity
          key={`${g.url}-${i}`}
          onPress={() => onPress(g.url)}
          style={{
            width: '31.7%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
            backgroundColor: '#18181b',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <Image source={{ uri: g.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── HIVE tab — community CommunityAsset feed ────────────────────────────────
function HivePanel({
  search, currentUserId, onCopyAsset,
}: {
  search: string;
  currentUserId: string | undefined;
  onCopyAsset: (url: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'gif' | 'emoji' | 'sticker'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['community-assets'],
    queryFn: () => entities.CommunityAsset.list('-created_date', 100),
  });

  const likeMutation = useMutation({
    mutationFn: async (asset: any) => {
      const likes: string[] = asset.likes || [];
      const has = likes.includes(currentUserId || '');
      const nextLikes = has
        ? likes.filter((id) => id !== currentUserId)
        : [...likes, currentUserId || ''];
      return entities.CommunityAsset.update(asset.id, { likes: nextLikes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-assets'] }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (assets as any[])
      .filter((a) => {
        if (a.is_public === false && a.author_id !== currentUserId) return false;
        if (typeFilter !== 'all' && a.type !== typeFilter) return false;
        if (q && !a.name?.toLowerCase().includes(q) && !(a.tags || []).some((t: string) => t.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === 'popular') return (b.likes?.length || 0) - (a.likes?.length || 0);
        return 0;
      });
  }, [assets, typeFilter, sortBy, search, currentUserId]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color="#FF3333" />
        <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 8 }}>
          LOADING_HIVE_DATA...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filter + sort */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
          {(['all', 'gif', 'emoji', 'sticker'] as const).map((f) => {
            const active = typeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setTypeFilter(f)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: active ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.05)',
                }}
              >
                <Text style={{ color: active ? '#60a5fa' : '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                  {f.toUpperCase()}{f === 'gif' || f === 'emoji' ? 'S' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ width: 12 }} />
          {(['recent', 'popular'] as const).map((s) => {
            const active = sortBy === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setSortBy(s)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderWidth: 1, borderColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                }}
              >
                <Text style={{ color: active ? '#fff' : '#71717a', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
                  {s === 'recent' ? 'LATEST' : 'TOP'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 26 }}>🕸️</Text>
          </View>
          <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '800', marginBottom: 4 }}>The Hive is empty</Text>
          <Text style={{ color: '#52525b', fontSize: 11, textAlign: 'center' }}>Be the first to transmit a signal.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {filtered.map((asset: any) => {
              const hasLiked = (asset.likes || []).includes(currentUserId || '');
              return (
                <View
                  key={asset.id}
                  style={{
                    width: '48%', borderRadius: 12, overflow: 'hidden',
                    backgroundColor: '#0a0a0a',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <TouchableOpacity onPress={() => onCopyAsset(asset.url)} activeOpacity={0.85}>
                    <View style={{ aspectRatio: 1, backgroundColor: '#18181b' }}>
                      <Image source={{ uri: asset.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: '#a1a1aa', fontSize: 7, fontWeight: '900', letterSpacing: 1 }}>
                          {String(asset.type || '').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={{ padding: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text numberOfLines={1} style={{ color: '#fff', fontSize: 10, fontWeight: '800', flex: 1 }}>
                        :{asset.name}:
                      </Text>
                      <TouchableOpacity
                        onPress={() => currentUserId && likeMutation.mutate(asset)}
                        hitSlop={6}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      >
                        <Heart size={11} color={hasLiked ? '#FF3333' : '#52525b'} fill={hasLiked ? '#FF3333' : 'none'} />
                        <Text style={{ color: hasLiked ? '#FF3333' : '#52525b', fontSize: 9, fontWeight: '800' }}>
                          {(asset.likes || []).length}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text numberOfLines={1} style={{ color: '#71717a', fontSize: 9 }}>
                      {asset.author_name || 'anon'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => onCopyAsset(asset.url)}
                      style={{
                        marginTop: 6, backgroundColor: '#FF3333', paddingVertical: 5, borderRadius: 6,
                        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4,
                      }}
                    >
                      <Copy size={10} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>COPY</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── FABRICATE tab — upload flow ─────────────────────────────────────────────
function FabricatorPanel({
  currentUser, onDone,
}: {
  currentUser: any;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'gif' | 'emoji' | 'sticker'>('gif');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickFile = async () => {
    setErr(null);
    setUploading(true);
    try {
      const url = await pickAndUpload({ crop: false });
      if (!url) return;
      setUploadedUrl(url);
      setPreviewUri(url);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const clean = tagInput.replace(/^#/, '').trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
      setTagInput('');
    }
  };

  const removeTag = (i: number) => setTags((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!uploadedUrl || !name.trim()) {
      setErr('Need a file and a name');
      return;
    }
    setErr(null);
    setPublishing(true);
    try {
      await entities.CommunityAsset.create({
        name: name.trim(),
        type,
        url: uploadedUrl,
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username,
        author_avatar: currentUser?.avatar_url || '',
        likes: [],
        tags,
        is_public: isPublic,
      });
      // Match web: invalidate every consumer of CommunityAsset so the new
      // asset appears everywhere immediately.
      queryClient.invalidateQueries({ queryKey: ['community-assets'] });
      queryClient.invalidateQueries({ queryKey: ['community-gifs-picker'] });
      queryClient.invalidateQueries({ queryKey: ['community-emojis-picker'] });
      queryClient.invalidateQueries({ queryKey: ['community-assets-emojis'] });
      setPreviewUri(null);
      setUploadedUrl(null);
      setName('');
      setTags([]);
      onDone();
    } catch (e: any) {
      setErr(e?.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Drop zone / preview */}
      <TouchableOpacity
        onPress={pickFile}
        disabled={uploading}
        activeOpacity={0.85}
        style={{
          borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
          borderColor: previewUri ? 'rgba(255,51,51,0.3)' : 'rgba(255,255,255,0.1)',
          backgroundColor: previewUri ? 'rgba(255,51,51,0.05)' : 'rgba(255,255,255,0.02)',
          overflow: 'hidden',
        }}
      >
        {previewUri ? (
          <View>
            <Image source={{ uri: previewUri }} style={{ width: '100%', height: 260, backgroundColor: '#000' }} contentFit="contain" />
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); setPreviewUri(null); setUploadedUrl(null); }}
              style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' }}
              hitSlop={8}
            >
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 44, gap: 10 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              {uploading ? <ActivityIndicator size="small" color="#FF3333" /> : <Upload size={20} color="#71717a" />}
            </View>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>
              {uploading ? 'UPLOADING...' : 'Inject Signal'}
            </Text>
            <Text style={{ color: '#52525b', fontSize: 10 }}>
              Tap to pick a GIF, PNG, or WEBP
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Name */}
      <View>
        <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 }}>
          SIGNAL NAME
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10 }}>
          <Text style={{ color: '#52525b', fontSize: 14 }}>:</Text>
          <TextInput
            value={name}
            onChangeText={(v) => setName(v.replace(/[^a-zA-Z0-9_]/g, ''))}
            placeholder="cyber_hype"
            placeholderTextColor="#52525b"
            autoCapitalize="none"
            style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 9, marginHorizontal: 4 }}
          />
          <Text style={{ color: '#52525b', fontSize: 14 }}>:</Text>
        </View>
      </View>

      {/* Type */}
      <View>
        <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 }}>
          SIGNAL TYPE
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['gif', 'emoji', 'sticker'] as const).map((t) => {
            const active = type === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center',
                  backgroundColor: active ? 'rgba(255,51,51,0.2)' : 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: active ? 'rgba(255,51,51,0.4)' : 'rgba(255,255,255,0.05)',
                }}
              >
                <Text style={{ color: active ? '#FF3333' : '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tags */}
      <View>
        <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 }}>
          TAGS
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TextInput
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={addTag}
            placeholder="#reaction"
            placeholderTextColor="#52525b"
            autoCapitalize="none"
            style={{ flex: 1, backgroundColor: '#0a0a0a', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, paddingHorizontal: 10, paddingVertical: 9 }}
          />
          <TouchableOpacity onPress={addTag} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Hash size={14} color="#fff" />
          </TouchableOpacity>
        </View>
        {tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {tags.map((t, i) => (
              <View key={`${t}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: '#a1a1aa', fontSize: 10 }}>#{t}</Text>
                <TouchableOpacity onPress={() => removeTag(i)} hitSlop={6}>
                  <Text style={{ color: '#71717a', fontSize: 12 }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Public toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
        <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>Publicly visible in Hive</Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ true: '#FF3333', false: '#3f3f46' }}
          thumbColor="#fff"
        />
      </View>

      {err && (
        <Text style={{ color: '#f87171', fontSize: 11 }}>{err}</Text>
      )}

      {/* Submit */}
      <TouchableOpacity
        onPress={submit}
        disabled={publishing || !uploadedUrl || !name.trim()}
        style={{
          backgroundColor: '#FF3333', paddingVertical: 13, borderRadius: 12,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
          opacity: publishing || !uploadedUrl || !name.trim() ? 0.4 : 1,
        }}
      >
        {publishing && <ActivityIndicator size="small" color="#fff" />}
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }}>
          {publishing ? 'TRANSMITTING...' : 'TRANSMIT'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
