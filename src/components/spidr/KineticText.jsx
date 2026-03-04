import React from 'react';
import { renderEmojis, useGlobalEmojis } from './EmojiRenderer';

export default function KineticText({ text, effect }) {
  const emojiMap = useGlobalEmojis();

  if (!text) return null;

  const renderedContent = renderEmojis(text, emojiMap);

  if (effect === 'shake') {
    return <span className="text-effect-shake font-bold">{renderedContent}</span>;
  }
  
  if (effect === 'glitch') {
    return <span className="text-effect-glitch">{renderedContent}</span>;
  }
  
  if (effect === 'wave') {
    // Wave needs per-character animation; emojis render as whole inline elements
    if (typeof renderedContent === 'string') {
      return (
        <span className="text-effect-wave">
          {text.split('').map((char, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.1}s` }}>{char}</span>
          ))}
        </span>
      );
    }
    return <span className="text-effect-wave">{renderedContent}</span>;
  }

  return <span>{renderedContent}</span>;
}