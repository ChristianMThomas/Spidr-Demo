import React from 'react';
import { renderEmojis, useGlobalEmojis } from './EmojiRenderer';

export default function MentionParser({ text, className = '' }) {
  const emojiMap = useGlobalEmojis();

  if (!text) return null;

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
          
          // User mentions
          return (
            <span 
              key={index}
              className="inline-block bg-[#1a1a1a] text-[#FF3333] px-1.5 py-0.5 rounded mx-0.5 font-medium cursor-pointer hover:bg-[#FF3333]/20 border border-white/10 text-sm transition-colors"
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