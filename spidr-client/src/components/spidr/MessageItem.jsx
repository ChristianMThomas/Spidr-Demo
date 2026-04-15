import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import MentionParser from './MentionParser';
import GhostMessage from './GhostMessage';
import KineticText from './KineticText';
import ReactionBar from './ReactionBar';
import { Crown } from 'lucide-react';

export default function MessageItem({ msg, prevMsg, isOwnMessage, onProfileClick, currentUser, apexUsers, onReactionToggle }) {
  const isMentioned = currentUser && msg.content?.includes(`@${currentUser.full_name?.split(' ')[0]}`);
  const isApex = apexUsers?.includes?.(msg.sender_id);
  const isChained = prevMsg && prevMsg.sender_id === msg.sender_id;

  return (
    <motion.div
      initial={{ opacity: 0, x: isOwnMessage ? 8 : -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative flex items-start gap-0 ${isChained ? 'mt-1' : 'mt-3'} ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
    >
      {/* The Thread Line (left edge for incoming, right edge for outgoing) */}
      {!isOwnMessage && (
        <div className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-full transition-colors duration-300
          ${isApex ? 'bg-gradient-to-b from-[#FF3333] to-purple-600 shadow-[0_0_8px_rgba(255,51,51,0.4)]' : 'bg-white/[0.04] group-hover:bg-white/10'}
        `} />
      )}
      {isOwnMessage && (
        <div className={`absolute right-0 top-0 bottom-0 w-[2px] rounded-full transition-colors duration-300
          bg-[#FF3333]/20 group-hover:bg-[#FF3333]/40
        `} />
      )}

      {/* The Data Card */}
      <div className={`relative ${isOwnMessage ? 'mr-3' : 'ml-3'} p-2.5 backdrop-blur-sm transition-all duration-200 max-w-[75%] min-w-[120px]
        ${isOwnMessage 
          ? 'rounded-l-xl rounded-tr-xl rounded-br-sm bg-[#FF3333]/[0.07] border border-[#FF3333]/[0.12] hover:border-[#FF3333]/25'
          : isApex
            ? 'rounded-r-xl rounded-tl-xl rounded-bl-sm bg-[#1a0505]/70 border border-[#FF3333]/20 shadow-[0_0_20px_rgba(255,51,51,0.04)]'
            : 'rounded-r-xl rounded-tl-xl rounded-bl-sm bg-white/[0.025] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.04]'
        }
        ${isMentioned ? '!border-[#FF3333]/40 !bg-[#FF3333]/[0.08] shadow-[0_0_15px_rgba(255,51,51,0.1)]' : ''}
      `}>
        {/* Apex energy corner */}
        {isApex && !isOwnMessage && (
          <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-[#FF3333]/15 to-transparent rounded-tr-xl pointer-events-none" />
        )}

        <div className="flex gap-2.5">
          {/* Embedded Avatar (incoming) */}
          {!isOwnMessage && (
            <button onClick={() => onProfileClick?.(msg.sender_id)} className="flex-shrink-0 mt-0.5">
              <div className="relative w-8 h-8">
                {isApex && (
                  <div className="absolute -inset-0.5 bg-gradient-to-tr from-[#FF3333] to-purple-600 rounded-lg blur-[2px] opacity-50 animate-pulse" />
                )}
                <Avatar className="relative w-full h-full rounded-lg">
                  <AvatarImage src={msg.sender_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender_id}`} className="rounded-lg" />
                  <AvatarFallback className="bg-zinc-800 text-white text-[10px] rounded-lg">
                    {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </button>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name + Apex Badge + hover timestamp (first in chain only) */}
            {!isChained && (
              <div className={`flex items-center gap-1.5 mb-0.5 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => onProfileClick?.(msg.sender_id)}
                  className={`text-[12px] font-bold cursor-pointer hover:underline decoration-1 underline-offset-2
                    ${isApex && !isOwnMessage
                      ? 'text-[#FF3333] drop-shadow-[0_0_6px_rgba(255,51,51,0.4)]'
                      : isOwnMessage ? 'text-[#FF3333]/80' : 'text-zinc-400'}
                  `}
                >
                  {msg.sender_name}
                </button>
                {isApex && !isOwnMessage && (
                  <span className="text-[7px] font-black text-white bg-gradient-to-r from-[#FF3333] to-purple-600 px-1 py-px rounded tracking-wider uppercase">
                    APEX
                  </span>
                )}
                <span className="text-[9px] text-zinc-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                <MentionParser text={msg.content} />
              )}
            </div>

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
                {msg.attachments.map((url, i) => (
                  <img key={i} src={url} alt="attachment" className="max-w-[200px] max-h-[180px] rounded-lg border border-white/10 hover:border-[#FF3333]/30 transition-colors cursor-pointer object-cover" />
                ))}
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
              <AvatarImage src={msg.sender_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender_id}`} className="rounded-lg" />
              <AvatarFallback className="bg-[#FF3333]/20 text-white text-[10px] rounded-lg">
                {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </div>
        </button>
      )}
    </motion.div>
  );
}