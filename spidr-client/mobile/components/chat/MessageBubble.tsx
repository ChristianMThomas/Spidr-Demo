import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { PhoneMissed } from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';
import { EmojiText } from './EmojiText';
import { AudioPlayer } from './AudioPlayer';

interface Message {
  id?: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  sender_id?: string;
  sender_name?: string;
  sender_avatar?: string;
  content?: string;
  attachments?: any[];
  created_at?: string;
  created_date?: string;
  // Missed-call system rows (written by the server on decline / cancel /
  // no-answer) render as a centered alert instead of a chat bubble.
  is_missed_call?: boolean;
  missed_call_reason?: string;
  caller_id?: string;
  caller_name?: string;
  recipient_name?: string;
  group_id?: string;
  group_name?: string;
}

// Attachments are stored as arrays of URL strings (web writes
// `attachments.map(att => att.url)`), but tolerate `{ url }` objects from
// older payloads. Classification mirrors web MessageItem.jsx.
function attachmentUrls(msg: Message): string[] {
  if (!Array.isArray(msg.attachments)) return [];
  return msg.attachments
    .map((a: any) => (typeof a === 'string' ? a : a?.url))
    .filter(Boolean);
}

const isAudioUrl = (url: string) =>
  /voice-message-/i.test(url) || /\.(mp3|wav|ogg|m4a|aac|webm|weba|opus)(\?|$)/i.test(url);
const isVideoUrl = (url: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(url);

function AttachmentView({ url }: { url: string }) {
  if (isAudioUrl(url)) {
    return <AudioPlayer url={url} />;
  }
  if (isVideoUrl(url)) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.06)',
          marginTop: 6,
        }}
      >
        <Text style={{ fontSize: 13 }}>🎬</Text>
        <Text style={{ color: '#a1a1aa', fontSize: 11 }}>Video attachment</Text>
      </View>
    );
  }
  // Images + GIFs — expo-image animates GIFs on both platforms.
  return (
    <Image
      source={{ uri: url }}
      style={{
        width: 200,
        height: 170,
        borderRadius: 10,
        marginTop: 6,
        backgroundColor: '#18181b',
      }}
      contentFit="cover"
      transition={120}
    />
  );
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
  // Needed by missed-call rows: the label flips depending on whether the
  // viewer placed the call or missed it.
  currentUserId,
  groupName,
  // Tapping the avatar opens that user's profile card (parent supplies
  // navigation since bubbles don't know the router).
  onAvatarPress,
}: {
  msg: Message;
  mine?: boolean;
  showHeader?: boolean;
  tier?: 'APEX' | string | null;
  peerName?: string;
  peerAvatar?: string;
  myName?: string;
  myAvatar?: string;
  currentUserId?: string;
  groupName?: string;
  onAvatarPress?: (userId: string) => void;
}) {
  // Always prefer the live values; fall back to snapshot only if the
  // parent didn't supply current ones (rare).
  const name = mine
    ? myName || msg.user_name || msg.sender_name || 'You'
    : peerName || msg.user_name || msg.sender_name || 'User';
  const avatar = mine ? myAvatar : peerAvatar;
  const authorId = msg.user_id || msg.sender_id;
  const handleAvatarPress =
    onAvatarPress && authorId ? () => onAvatarPress(authorId) : undefined;

  const attachments = attachmentUrls(msg);
  const hasText = !!(msg.content && msg.content.trim());

  // Missed-call system row — centered red alert, mirrors web MessageItem.
  // DM lane:    caller sees "<peer> didn't answer",  callee sees "You missed a call from <caller>"
  // Group lane: caller sees "You tried calling <group>", members see "<caller> called <group>"
  if (msg.is_missed_call) {
    // `mine` is the fallback when the parent didn't pass an id: the row's
    // author IS the caller, so "my row" == "I placed the call".
    const iSentCall = currentUserId ? msg.caller_id === currentUserId : !!mine;
    const caller = msg.caller_name || msg.user_name || msg.sender_name || 'Someone';
    const isGroupRow = !!(msg.group_name || msg.group_id || groupName);
    let label: string;
    if (isGroupRow) {
      const gName = msg.group_name || groupName || 'the group';
      label = iSentCall ? `You tried calling ${gName}` : `${caller} called ${gName}`;
    } else {
      const other = iSentCall ? (msg.recipient_name || peerName || 'Someone') : caller;
      label = iSentCall
        ? (msg.missed_call_reason === 'declined' ? `${other} declined your call` : `${other} didn't answer`)
        : `You missed a call from ${other}`;
    }
    const stamp = msg.created_date || msg.created_at;
    const when = stamp ? new Date(stamp) : null;
    return (
      <View style={{ alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 16,
            backgroundColor: 'rgba(239,68,68,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.25)',
            maxWidth: '92%',
          }}
        >
          <PhoneMissed size={14} color="#ef4444" />
          <Text
            style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 0.3, flexShrink: 1 }}
            numberOfLines={2}
          >
            {label}
          </Text>
          {when && !isNaN(when.getTime()) && (
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
              {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>
    );
  }

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
          {showHeader ? (
            <TouchableOpacity disabled={!handleAvatarPress} onPress={handleAvatarPress} hitSlop={6}>
              <Avatar uri={avatar} name={name} size={32} />
            </TouchableOpacity>
          ) : null}
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
        {hasText && (
          <EmojiText text={msg.content} style={{ color: '#fff', fontSize: 14, lineHeight: 19 }} />
        )}
        {attachments.map((url, i) => (
          <AttachmentView key={`${url}-${i}`} url={url} />
        ))}
      </View>

      {mine && (
        <View style={{ width: 32 }}>
          {showHeader ? (
            <TouchableOpacity disabled={!handleAvatarPress} onPress={handleAvatarPress} hitSlop={6}>
              <Avatar uri={avatar} name={name} size={32} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}
