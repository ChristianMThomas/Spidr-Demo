import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Play, Pause } from 'lucide-react';

export default function AudioResonance() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="bg-[#0a0a0a] border border-[#FF3333]/30 rounded-xl p-4 relative overflow-hidden shadow-[0_0_20px_rgba(255,51,51,0.1)]">
      <div className="flex items-center gap-2 mb-3 text-[#FF3333]">
        <Music size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">Resonance Feed</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-12 h-12 flex-shrink-0 bg-[#111] border border-[#FF3333]/50 rounded-full flex items-center justify-center text-white hover:bg-[#FF3333]/20 transition-colors relative"
        >
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="absolute inset-1 border border-dashed border-[#FF3333]/50 rounded-full"
          />
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">SPIDER-MAN THEME (TRAP REMIX)</div>
          <div className="text-[10px] text-gray-500 font-mono">Metro Boomin</div>

          <div className="flex items-end gap-0.5 h-4 mt-2">
            {[...Array(16)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: isPlaying ? ['20%', '100%', '20%'] : '10%' }}
                transition={{ repeat: Infinity, duration: Math.random() * 0.5 + 0.3, delay: i * 0.02 }}
                className="flex-1 bg-gradient-to-t from-[#FF3333] to-purple-500 rounded-t-sm"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}