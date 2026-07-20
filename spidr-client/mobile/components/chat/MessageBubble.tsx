import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '../ui/Avatar';

interface Message {
  id?: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  sender_id?: string;
  sender_name?: string;
  sender_avatar?: string;
  content?: string;
  created_at?: string;
  created_date?: string;
}

export function MessageBubble({
  msg,
  mine,
  showHeader = true,
  tier,
  // Live avatars + names — passed by the parent screen so EVERY bubble
  // shows the user's CURRENT pfp/name, not the snapshot stored on the
  // message at send time. Change pfp once → every bubble updates.
  peerName,
  peerAvatar,
  myName,
  myAvatar,
}: {
  msg: Message;
  mine?: boolean;
  showHeader?: boolean;
  tier?: 'APEX' | string | null;
  peerName?: string;
  peerAvatar?: string;
  myName?: string;
  myAvatar?: string;
}) {
  // Always prefer the live values; fall back to snapshot only if the
  // parent didn't supply current ones (rare).
  const name = mine
    ? myName || msg.user_name || msg.sender_name || 'You'
    : peerName || msg.user_name || msg.sender_name || 'User';
  const avatar = mine ? myAvatar : peerAvatar;

  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 3,
        justifyContent: mine ? 'flex-end' : 'flex-start',
        gap: 8,
      }}
    >
      {!mine && (
        <View style={{ width: 32 }}>
          {showHeader ? <Avatar uri={avatar} name={name} size={32} /> : null}
        </View>
      )}

      <View
        style={{
          maxWidth: '74%',
          backgroundColor: 'rgba(20,0,0,0.65)',
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.45)',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 8,
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {showHeader && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
            <Text
              style={{
                color: mine ? '#ef4444' : '#f97316',
                fontSize: 12,
                fontWeight: '900',
              }}
              numberOfLines={1}
            >
              {name}
            </Text>
            {tier === 'APEX' && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 6,
                  backgroundColor: '#ec4899',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 }}>
                  APEX
                </Text>
              </View>
            )}
          </View>
        )}
        <Text style={{ color: '#fff', fontSize: 14, lineHeight: 19 }}>{msg.content}</Text>
      </View>

      {mine && (
        <View style={{ width: 32 }}>
          {showHeader ? <Avatar uri={avatar} name={name} size={32} /> : null}
        </View>
      )}
    </View>
  );
}
