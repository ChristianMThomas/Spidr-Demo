import React from 'react';
import { motion } from 'framer-motion';

export default function ReactionBar({ reactions, currentUserId, onToggle }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {Object.entries(reactions).map(([emoji, users]) => {
        if (!users || users.length === 0) return null;
        const hasReacted = users.includes(currentUserId);
        const isCustom = emoji.startsWith(':') && emoji.endsWith(':');
        
        return (
          <motion.button
            key={emoji}
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggle?.(emoji)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-all ${
              hasReacted
                ? 'bg-red-500/10 border border-red-500/40 text-white'
                : 'bg-white/5 border border-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {isCustom ? (
              <span className="text-xs">{emoji}</span>
            ) : (
              <span>{emoji}</span>
            )}
            <span className="text-[10px] font-bold">{users.length}</span>
          </motion.button>
        );
      })}
    </div>
  );
}