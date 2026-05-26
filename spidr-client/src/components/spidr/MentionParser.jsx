import React from 'react';
import { renderEmojis, useGlobalEmojis } from './EmojiRenderer';

/**
 * MentionParser — renders message text with @mentions and custom emojis.
 *
 * When `users` + `onMentionClick` are provided, user mentions become clickable
 * and resolve to the matching member (by username / display name / first name),
 * firing onMentionClick(userId) so the caller can open the profile pop-out
 * (4.2). Without them, mentions render as styled-but-inert pills (back-compat).
 */
export default function MentionParser({ text, className = '', users = [], onMentionClick }) {
  const emojiMap = useGlobalEmojis();

  if (!text) return null;

  // Resolve a "@name" token to a member's user_id, matching against username,
  // display_name, full name, or first name (case-insensitive, spaces stripped).
  const resolveUser = (cleanName) => {
    const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '');
    const target = norm(cleanName);
    return users.find(u =>
      norm(u.username) === target ||
      norm(u.display_name) === target ||
      norm(u.name || u.user_name) === target ||
      norm((u.name || u.user_name || u.display_name || '').split(' ')[0]) === target
    );
  };

  // First split by mentions
  const parts = text.split(/(@\w+)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const cleanName = part.slice(1).toLowerCase();
          
          // Special mentions
          if (['everyone', 'here'].includes(cleanName)) {
            return (
              <span 
                key={index}
                className="inline-block bg-[#FF3333]/20 text-[#FF3333] px-1.5 py-0.5 rounded mx-0.5 font-bold cursor-pointer hover:bg-[#FF3333] hover:text-white transition-colors border border-[#FF3333]/50 text-sm"
              >
                {part}
              </span>
            );
          }
          
          // User mentions — clickable when we can resolve the user.
          const matched = onMentionClick ? resolveUser(cleanName) : null;
          return (
            <span 
              key={index}
              onClick={matched ? (e) => { e.stopPropagation(); onMentionClick(matched.user_id || matched.id); } : undefined}
              className={`inline-block bg-[#1a1a1a] text-[#FF3333] px-1.5 py-0.5 rounded mx-0.5 font-medium border border-white/10 text-sm transition-colors ${matched ? 'cursor-pointer hover:bg-[#FF3333]/20' : ''}`}
            >
              {part}
            </span>
          );
        }
        
        // Render custom emojis in non-mention text
        const rendered = renderEmojis(part, emojiMap);
        if (typeof rendered === 'string') {
          return <span key={index}>{rendered}</span>;
        }
        return <React.Fragment key={index}>{rendered}</React.Fragment>;
      })}
    </span>
  );
}