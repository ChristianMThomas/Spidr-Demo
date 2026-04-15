import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { renderEmojis, useGlobalEmojis } from './EmojiRenderer';

export default function GhostMessage({ text }) {
  const emojiMap = useGlobalEmojis();
  const [revealed, setRevealed] = useState(false);
  const [destroyed, setDestroyed] = useState(false);

  // Scramble text function
  const scrambleText = (str) => {
    return str.split('').map(c => {
      if (c === ' ') return ' ';
      if (/[a-zA-Z]/.test(c)) {
        return Math.random() > 0.5 ? '0' : '1';
      }
      return c;
    }).join('');
  };

  // Auto-destroy 10 seconds after revealing
  useEffect(() => {
    if (revealed && !destroyed) {
      const timer = setTimeout(() => setDestroyed(true), 10000);
      return () => clearTimeout(timer);
    }
  }, [revealed, destroyed]);

  if (destroyed) {
    return (
      <motion.span 
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        className="text-[10px] text-purple-600/50 italic font-mono"
      >
        /// SIGNAL LOST ///
      </motion.span>
    );
  }

  return (
    <div 
      onMouseEnter={() => setRevealed(true)}
      className="cursor-pointer transition-all relative"
    >
      {/* If not revealed, show scrambled text */}
      {!revealed && (
         <span className="text-purple-400 font-mono tracking-widest blur-[1px] select-none animate-pulse">
           {scrambleText(text)}
         </span>
      )}
      
      {/* If revealed, show real text */}
      {revealed && (
        <motion.span
          initial={{ opacity: 0, filter: 'blur(5px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.3 }}
          className="text-white"
        >
          {renderEmojis(text, emojiMap)}
        </motion.span>
      )}
      
      {/* Progress Bar for Destruction */}
      {revealed && (
        <motion.div 
          className="absolute bottom-0 left-0 h-[2px] bg-purple-600 rounded-full" 
          initial={{ width: "100%" }}
          animate={{ width: 0 }}
          transition={{ duration: 10, ease: "linear" }}
        />
      )}
    </div>
  );
}