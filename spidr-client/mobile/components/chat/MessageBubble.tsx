import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { PhoneMissed } from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';
import { EmojiText } from './EmojiText';
import { AudioPlayer } from './AudioPlayer';
import { buildUsernameStyleRN, UsernameStyleProfile } from '../../lib/usernameStyle';

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

// Mirrors the web timestamp format (MessageItem.jsx) — touch has no hover, so
// mobile shows it plainly next to the name instead of on a hover reveal.
function formatMsgTime(stamp?: string): string | null {
  if (!stamp) return null;
  const d = new Date(stamp);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

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
  peerProfile,
  myName,
  myAvatar,
  myProfile,
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
  peerProfile?: UsernameStyleProfile | null;
  myName?: string;
  myAvatar?: string;
  myProfile?: UsernameStyleProfile | null;
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

  // Username Style (Settings → Appearance) — same field names + color
  // priority as the web client, so a style set on either platform renders
  // consistently here.
  const { style: nameStyle, pulse: namePulse } = buildUsernameStyleRN(
    mine ? myProfile : peerProfile,
    { fallbackColor: mine ? '#ef4444' : '#f97316' },
  );
  // Hooks must run unconditionally — this sits above the missed-call early
  // return below.
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!namePulse) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [namePulse, pulseAnim]);

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

  const msgTime = formatMsgTime(msg.created_date || msg.created_at);

  return (
    <View
      style={{
        flexDirection: 'row',
        position: 'relative',
        paddingHorizontal: 10,
        // Tighter gap between chained messages from the same sender, more
        // breathing room when a new sender/group starts — matches web's
        // mt-1 (chained) vs mt-3 (new group) in MessageItem.jsx.
        paddingTop: showHeader ? 10 : 2,
        paddingBottom: 2,
        justifyContent: mine ? 'flex-end' : 'flex-start',
        gap: 8,
      }}
    >
      {/* Thread-line accent — mirrors web's colored edge strip
          (MessageItem.jsx:139-160). Purely decorative, no data dependency. */}
      <View
        style={{
          position: 'absolute',
          [mine ? 'right' : 'left']: 2,
          top: 0,
          bottom: 0,
          width: 2,
          borderRadius: 1,
          backgroundColor: tier === 'APEX'
            ? '#a855f7'
            : mine ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
        } as any}
      />

      {!mine && (
        <View style={{ width: 32 }}>
          <TouchableOpacity disabled={!handleAvatarPress} onPress={handleAvatarPress} hitSlop={6}>
            <Avatar uri={avatar} name={name} size={32} />
          </TouchableOpacity>
        </View>
      )}

      <View
        style={{
          maxWidth: '74%',
          backgroundColor: 'rgba(20,0,0,0.65)',
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.45)',
          // Chat-bubble "tail" corner (matches web MessageItem.jsx's
          // rounded-r-xl/rounded-tl-xl/rounded-bl-sm split) instead of a
          // flat rounded rect on every side.
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          borderBottomLeftRadius: mine ? 14 : 4,
          borderBottomRightRadius: mine ? 4 : 14,
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
            <Animated.Text
              style={[
                { fontSize: 12, fontWeight: '900' },
                nameStyle,
                namePulse ? { opacity: pulseAnim } : null,
              ]}
              numberOfLines={1}
            >
              {name}
            </Animated.Text>
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
            {msgTime && (
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }} numberOfLines={1}>
                {msgTime}
              </Text>
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
          <TouchableOpacity disabled={!handleAvatarPress} onPress={handleAvatarPress} hitSlop={6}>
            <Avatar uri={avatar} name={name} size={32} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
