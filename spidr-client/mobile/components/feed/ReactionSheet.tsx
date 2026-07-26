import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView } from 'react-native';

// Quick-reaction set. Drawn from the same vocabulary as the web EmojiPicker's
// standardEmojis so a reaction slung from either client renders identically.
const QUICK_REACTIONS = ['❤️', '😂', '🔥', '😮', '😢', '👏', '👍', '🕸️', '💀', '🤩', '🙏', '⚡'];

interface ReactionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Existing reactions on the clip: [{ emoji, users: [userId] }] */
  reactions: { emoji: string; users: string[] }[];
  currentUserId?: string;
  onToggle: (emoji: string) => void;
}

// Bottom sheet for emoji reactions on a clip. Mirrors CommentsSheet styling.
// Tapping an emoji toggles the current user's membership in that reaction.
export function ReactionSheet({
  visible,
  onClose,
  reactions,
  currentUserId,
  onToggle,
}: ReactionSheetProps) {
  const mine = (emoji: string) =>
    reactions.find((r) => r.emoji === emoji)?.users?.includes(currentUserId || '') || false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#0a0a0a',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(239,68,68,0.3)',
          padding: 16,
          paddingBottom: 28,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 13,
            fontWeight: '900',
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          REACT
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_REACTIONS.map((emoji) => {
            const active = mine(emoji);
            const count = reactions.find((r) => r.emoji === emoji)?.users?.length || 0;
            return (
              <TouchableOpacity
                key={emoji}
                onPress={() => onToggle(emoji)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: active ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
                {count > 0 && (
                  <Text style={{ color: active ? '#ef4444' : '#a1a1aa', fontSize: 12, fontWeight: '800' }}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reactions already on the clip that aren't in the quick set —
            still toggleable so a web-side custom reaction can be joined. */}
        {reactions.some((r) => !QUICK_REACTIONS.includes(r.emoji)) && (
          <>
            <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>
              ALSO ON THIS CLIP
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {reactions
                  .filter((r) => !QUICK_REACTIONS.includes(r.emoji))
                  .map((r) => {
                    const active = r.users?.includes(currentUserId || '');
                    return (
                      <TouchableOpacity
                        key={r.emoji}
                        onPress={() => onToggle(r.emoji)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: 999,
                          backgroundColor: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                          borderWidth: 1,
                          borderColor: active ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{r.emoji}</Text>
                        <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '800' }}>
                          {r.users?.length || 0}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}
