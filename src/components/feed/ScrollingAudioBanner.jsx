import React from 'react';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';

export default function ScrollingAudioBanner({ audioTrack, onClick }) {
  if (!audioTrack) return null;

  const text = `${audioTrack.title} — ${audioTrack.artist || 'Unknown'}`;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-2 py-1 w-max max-w-[200px] overflow-hidden cursor-pointer hover:bg-black/60 transition-colors"
    >
      <Music size={12} className="text-[#FF3333] flex-shrink-0" />
      <div className="flex-1 overflow-hidden relative w-32 h-4">
        <motion.div
          animate={{ x: [0, -150] }}
          transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
          className="absolute whitespace-nowrap text-[10px] font-mono text-white flex gap-8"
        >
          <span>{text}</span>
          <span>{text}</span>
        </motion.div>
      </div>
    </button>
  );
}