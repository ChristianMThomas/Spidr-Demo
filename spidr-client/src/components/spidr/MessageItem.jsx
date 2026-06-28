import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Linkify from './Linkify';
import ServerInviteCard from './ServerInviteCard';
import GhostMessage from './GhostMessage';
import KineticText from './KineticText';
import ReactionBar from './ReactionBar';
import VoiceMessageCapsule from './VoiceMessageCapsule';
import { Crown, CornerUpLeft } from 'lucide-react';
import { buildUsernameStyle } from '@/lib/usernameStyle';
import { getBubbleGradientForProfile, buildBubbleStyle, buildBubbleCornerStyle } from '@/lib/bubbleGradients';
import ContextableImage from '@/components/ui/ContextableImage';
import { useMenu } from '@/components/MenuContext';

export default function MessageItem({ msg, prevMsg, isOwnMessage, onProfileClick, currentUser, apexUsers, onReactionToggle, repliedTo, senderProfile, mentionUsers = [] }) {
  const { triggerMenu } = useMenu();
  const isMentioned = currentUser && msg.content?.includes(`@${currentUser.full_name?.split(' ')[0]}`);
  // Prefer senderProfile.apex_tier — it's the canonical signal. Fall back to
  // the legacy apexUsers Set prop in case any caller still uses that shape.
  const isApex = senderProfile?.apex_tier === 'apex' || apexUsers?.includes?.(msg.sender_id);
  const isChained = prevMsg && prevMsg.sender_id === msg.sender_id;

  // ── Custom bubble theme ──────────────────────────────────────────────────
  // APEX users pick a curated gradient for their outgoing bubbles. That
  // gradient applies to BOTH ends of the conversation: when *you* see your
  // own messages on your screen, and when the recipient sees your messages
  // on theirs (because senderProfile is the sender's profile in both cases).
  // Non-APEX senders or APEX senders who haven't picked → gradient.id is
  // 'default' and bubbleStyle is null, leaving the original Tailwind classes
  // untouched.
  const bubbleGradient = getBubbleGradientForProfile(senderProfile);
  const hasCustomBubble = bubbleGradient.id !== 'default';
  const bubbleStyle = buildBubbleStyle(bubbleGradient, { variant: isOwnMessage ? 'own' : 'incoming' });
  const cornerStyle = buildBubbleCornerStyle(bubbleGradient, { variant: isOwnMessage ? 'own' : 'incoming' });

  // Live avatar wins over the stale snapshot stored on the message at send-time
  // so renaming/changing your pfp updates everywhere — DMs AND group chats.
  const liveAvatar = isOwnMessage
    ? (currentUser?.avatar_url || senderProfile?.avatar_url || msg.sender_avatar)
    : (senderProfile?.avatar_url || msg.sender_avatar);

  return (
    <motion.div
      initial={{ opacity: 0, x: isOwnMessage ? 8 : -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative flex items-start gap-0 ${isChained ? 'mt-1' : 'mt-3'} ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
    >
      {/* The Thread Line (left edge for incoming, right edge for outgoing).
          When the sender has a custom gradient, recolor the thread line to
          match so the whole row reads as one coherent visual. */}
      {!isOwnMessage && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-full transition-colors duration-300
            ${hasCustomBubble ? '' : (isApex ? 'bg-gradient-to-b from-[#FF3333] to-purple-600 shadow-[0_0_8px_rgba(255,51,51,0.4)]' : 'bg-white/[0.04] group-hover:bg-white/10')}
          `}
          style={hasCustomBubble ? {
            background: `linear-gradient(to bottom, ${bubbleGradient.accent}, ${bubbleGradient.border})`,
            boxShadow: `0 0 8px ${bubbleGradient.glow}`,
          } : undefined}
        />
      )}
      {isOwnMessage && (
        <div
          className={`absolute right-0 top-0 bottom-0 w-[2px] rounded-full transition-colors duration-300
            ${hasCustomBubble ? '' : 'bg-[#FF3333]/20 group-hover:bg-[#FF3333]/40'}
          `}
          style={hasCustomBubble ? {
            background: `linear-gradient(to bottom, ${bubbleGradient.accent}, ${bubbleGradient.border})`,
            boxShadow: `0 0 8px ${bubbleGradient.glow}`,
          } : undefined}
        />
      )}

      {/* The Data Card. When the sender has a custom gradient set, we ditch
          the bg/border Tailwind classes for an inline `style` so the gradient
          paints freely. Rounded corners and layout classes stay put. */}
      <div
        className={`relative ${isOwnMessage ? 'mr-3' : 'ml-3'} p-2.5 backdrop-blur-sm transition-all duration-200 max-w-[75%] min-w-[120px] border
          ${isOwnMessage
            ? 'rounded-l-xl rounded-tr-xl rounded-br-sm'
            : 'rounded-r-xl rounded-tl-xl rounded-bl-sm'
          }
          ${hasCustomBubble
            ? 'hover:brightness-110'
            : isOwnMessage
              ? 'bg-[#FF3333]/[0.07] border-[#FF3333]/[0.12] hover:border-[#FF3333]/25'
              : isApex
                ? 'bg-[#1a0505]/70 border-[#FF3333]/20 shadow-[0_0_20px_rgba(255,51,51,0.04)]'
                : 'bg-white/[0.025] border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.04]'
          }
          ${isMentioned ? '!border-[#FF3333]/40 !bg-[#FF3333]/[0.08] shadow-[0_0_15px_rgba(255,51,51,0.1)]' : ''}
        `}
        style={hasCustomBubble ? bubbleStyle : undefined}
      >
        {/* Apex energy corner — colored to match the chosen gradient when
            one is set, falling back to the legacy red tint otherwise. */}
        {isApex && !isOwnMessage && (
          <div
            className="absolute top-0 right-0 w-8 h-8 rounded-tr-xl pointer-events-none"
            style={hasCustomBubble
              ? cornerStyle
              : { background: 'linear-gradient(to bottom left, rgba(255,51,51,0.15), transparent)' }
            }
          />
        )}
        {/* Mirror corner on outgoing bubbles when a custom gradient is set,
            so the user sees their own bubble theme accented too. */}
        {hasCustomBubble && isOwnMessage && (
          <div
            className="absolute top-0 left-0 w-8 h-8 rounded-tl-xl pointer-events-none"
            style={{ background: `linear-gradient(to bottom right, ${bubbleGradient.from}, transparent)` }}
          />
        )}

        <div className="flex gap-2.5">
          {/* Embedded Avatar (incoming) */}
          {!isOwnMessage && (
            <button
              onClick={() => onProfileClick?.(msg.sender_id)}
              onContextMenu={(e) => triggerMenu(e, 'profile', {
                id: msg.sender_id,
                user_id: msg.sender_id,
                name: msg.sender_name,
                avatar: msg.sender_avatar,
              })}
              className="flex-shrink-0 mt-0.5"
            >
              <div className="relative w-8 h-8">
                {isApex && (
                  <div className="absolute -inset-0.5 bg-gradient-to-tr from-[#FF3333] to-purple-600 rounded-lg blur-[2px] opacity-50 animate-pulse" />
                )}
                <Avatar className="relative w-full h-full rounded-lg">
                  {liveAvatar && <AvatarImage src={liveAvatar} className="rounded-lg" />}
                  <AvatarFallback className="bg-gradient-to-br from-[#FF3333] to-[#660000] text-white text-[10px] font-bold rounded-lg">
                    {msg.sender_name?.charAt(0)?.toUpperCase() || '🕷'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </button>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Reply card — themed in spidr red, matches the BotMessage SPIDR_AI card shape */}
            {msg.reply_to && (
              <button
                type="button"
                onClick={() => {
                  if (!repliedTo) return;
                  const el = document.querySelector(`[data-msg-id="${repliedTo.id}"]`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('msg-flash');
                    setTimeout(() => el.classList.remove('msg-flash'), 1200);
                  }
                }}
                className="relative w-full mb-2 text-left bg-[#0a0a0a] border border-[#FF3333]/30 rounded-lg overflow-hidden shadow-[0_0_12px_rgba(255,51,51,0.04)] hover:border-[#FF3333]/50 transition-colors group/reply"
              >
                <div className="h-[3px] w-full bg-gradient-to-r from-[#FF3333] via-[#FF3333] to-[#990000]" />
                <div className="p-2 flex gap-2 items-start">
                  <div className="relative w-6 h-6 flex-shrink-0 mt-0.5">
                    <div className="absolute inset-0 bg-[#FF3333] blur-[10px] opacity-15 group-hover/reply:opacity-25 transition-opacity" />
                    <div className="w-full h-full bg-black border border-[#FF3333]/60 rounded flex items-center justify-center relative z-10">
                      <CornerUpLeft size={11} className="text-[#FF3333]" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-black text-[10px] text-[#FF3333] tracking-wide truncate">
                        {repliedTo ? (repliedTo.author_name || repliedTo.user_name || repliedTo.sender_name || 'User') : 'Original message'}
                      </span>
                      <span className="text-[7px] bg-[#FF3333]/10 text-[#FF3333] px-1 py-px rounded border border-[#FF3333]/20 font-bold uppercase tracking-wider">
                        Reply
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono leading-snug line-clamp-2 break-words">
                      {repliedTo
                        ? (repliedTo.content || (repliedTo.attachments?.length ? `[${repliedTo.attachments.length} attachment${repliedTo.attachments.length === 1 ? '' : 's'}]` : '—'))
                        : 'Original message no longer available'}
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,51,51,0.2) 0%, transparent 50%)'
                }} />
              </button>
            )}
            {/* Name + Apex Badge + hover timestamp (first in chain only) */}
            {!isChained && (
              <div className={`flex items-center gap-1.5 mb-0.5 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => onProfileClick?.(msg.sender_id)}
                  className="text-[12px] font-bold cursor-pointer hover:underline decoration-1 underline-offset-2"
                  style={senderProfile
                    ? buildUsernameStyle(senderProfile, {
                        fallbackColor: isApex && !isOwnMessage ? '#FF3333' : (isOwnMessage ? 'rgba(255,51,51,0.8)' : '#a1a1aa'),
                      })
                    : {
                        color: isApex && !isOwnMessage ? '#FF3333' : (isOwnMessage ? 'rgba(255,51,51,0.8)' : '#a1a1aa'),
                        filter: isApex && !isOwnMessage ? 'drop-shadow(0 0 6px rgba(255,51,51,0.4))' : undefined,
                      }
                  }
                >
                  {msg.sender_name}
                </button>
                {isApex && !isOwnMessage && (
                  <span className="text-[7px] font-black text-white bg-gradient-to-r from-[#FF3333] to-purple-600 px-1 py-px rounded tracking-wider uppercase">
                    APEX
                  </span>
                )}
                <span className="text-[9px] text-zinc-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {(() => {
                    const d = new Date(msg.created_date);
                    const now = new Date();
                    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const sameDay = d.toDateString() === now.toDateString();
                    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
                    const isYesterday = d.toDateString() === yesterday.toDateString();
                    if (sameDay) return `Today ${time}`;
                    if (isYesterday) return `Yesterday ${time}`;
                    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
                  })()}
                </span>
              </div>
            )}

            {/* Message text */}
            <div className={`text-[13px] leading-snug break-words
              ${isOwnMessage ? 'text-zinc-200' : isApex ? 'text-zinc-200' : 'text-zinc-400'}
              ${msg.is_ghost ? 'font-mono text-purple-300/80' : ''}
            `}>
              {msg.is_ghost ? (
                <GhostMessage text={msg.content} />
              ) : msg.text_effect && msg.text_effect !== 'normal' ? (
                <KineticText text={msg.content} effect={msg.text_effect} />
              ) : (
                <Linkify text={msg.content} users={mentionUsers} onMentionClick={(uid) => onProfileClick?.(uid)} />
              )}
            </div>

            {/* Server invite card — interactive accept/decline UI rendered
                in-thread whenever a DM carries is_server_invite=true. */}
            {msg.is_server_invite && msg.server_invite_data && (
              <ServerInviteCard msg={msg} currentUser={currentUser} />
            )}

            {/* Clip share embed */}
            {msg.is_clip_share && msg.clip_data && msg.attachments?.[0] && (
              <div className="mt-2 rounded-lg overflow-hidden border border-white/10 bg-black max-w-[220px] cursor-pointer hover:border-[#FF3333]/30 transition-colors">
                <div className="relative h-32">
                  <video src={msg.attachments[0]} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" muted />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#FF3333] flex items-center justify-center flex-shrink-0">
                      <span className="text-[7px] text-white ml-0.5">▶</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-white uppercase tracking-wider">{msg.clip_data.author}</p>
                      <p className="text-[8px] text-zinc-400 line-clamp-1">{msg.clip_data.caption || 'Shared clip'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Regular attachments */}
            {!msg.is_clip_share && msg.attachments?.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {msg.attachments.map((url, i) => {
                  // Voice messages / audio: render an inline player instead of
                  // trying to show it as an image. The server renames uploads to
                  // <uuid><ext>, so we detect by extension. Note: .webm/.ogg are
                  // used by voice messages here (audio), so they're treated as
                  // audio; true video shares use .mp4/.mov.
                  const isAudio = /voice-message-/i.test(url) || /\.(mp3|wav|ogg|m4a|aac|webm|weba|opus)(\?|$)/i.test(url);
                  if (isAudio) {
                    return (
                      <VoiceMessageCapsule
                        key={i}
                        url={url}
                        isSelf={isOwnMessage}
                        transcription={msg.voice_transcription || null}
                      />
                    );
                  }
                  const isVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(url);
                  if (isVideo) {
                    return (
                      <video key={i} src={url} controls className="max-w-[220px] max-h-[200px] rounded-lg border border-white/10" />
                    );
                  }
                  return (
                    <ContextableImage key={i} src={url} alt="attachment"
                      senderName={msg.sender_name || msg.user_name || msg.author_name}
                      className="max-w-[200px] max-h-[180px] rounded-lg border border-white/10 hover:border-[#FF3333]/30 transition-colors cursor-pointer object-cover" />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Reactions */}
        <ReactionBar 
          reactions={msg.reactions} 
          currentUserId={currentUser?.id} 
          onToggle={(emoji) => onReactionToggle?.(msg.id, emoji)} 
        />

        {/* Webbed badge */}
        {msg.is_webbed && (
          <div className="absolute -top-1.5 -left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-[#FF3333]/15 border border-[#FF3333]/25 rounded text-[7px] font-black text-[#FF3333] uppercase tracking-wider">
            🕸️ WEB
          </div>
        )}
      </div>

      {/* Own avatar on right side (outgoing only) */}
      {isOwnMessage && (
        <button onClick={() => onProfileClick?.(msg.sender_id)} className="flex-shrink-0 mt-0.5 mr-3">
          <div className="relative w-8 h-8">
            <Avatar className="relative w-full h-full rounded-lg">
              {liveAvatar && <AvatarImage src={liveAvatar} className="rounded-lg" />}
              <AvatarFallback className="bg-gradient-to-br from-[#FF3333] to-[#660000] text-white text-[10px] font-bold rounded-lg">
                {msg.sender_name?.charAt(0)?.toUpperCase() || '🕷'}
              </AvatarFallback>
            </Avatar>
          </div>
        </button>
      )}
    </motion.div>
  );
}