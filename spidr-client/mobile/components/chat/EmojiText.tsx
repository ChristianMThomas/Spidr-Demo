import React from 'react';
import { Text, Image, TextStyle } from 'react-native';
import { useGlobalEmojis } from '../../hooks/useGlobalEmojis';

const EMOJI_TOKEN = /(:[a-zA-Z0-9_]+:)/g;

// Renders message text with inline `:shortcode:` custom emojis — the mobile
// twin of the web's EmojiRenderer.renderEmojis. Same "jumbo" rule: when the
// message is nothing but emoji tokens, they render large (36px) instead of
// inline (18px). Core RN <Image> is used (not expo-image) because it's the
// only image primitive that lays out inline inside a <Text> run; Expo Go
// ships Fresco so animated GIF emojis still play on Android.
export function EmojiText({ text, style }: { text?: string; style?: TextStyle }) {
  const emojiMap = useGlobalEmojis();

  if (!text) return null;

  const hasToken = text.includes(':');
  const mapEmpty = Object.keys(emojiMap).length === 0;
  if (!hasToken || mapEmpty) return <Text style={style}>{text}</Text>;

  const parts = text.split(EMOJI_TOKEN);
  if (!parts.some((p) => emojiMap[p])) return <Text style={style}>{text}</Text>;

  const onlyEmojis = parts.every((p) => p.trim() === '' || emojiMap[p.trim()]);
  const size = onlyEmojis ? 36 : 18;

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const emoji = emojiMap[part];
        if (!emoji) return <Text key={i} style={style}>{part}</Text>;
        return (
          <Image
            key={i}
            source={{ uri: emoji.url }}
            style={{ width: size, height: size, transform: [{ translateY: 3 }] }}
            resizeMode="contain"
          />
        );
      })}
    </Text>
  );
}
