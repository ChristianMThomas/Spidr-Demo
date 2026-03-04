import React from 'react';
import { motion } from 'framer-motion';
import { Disc3, Music } from 'lucide-react';

export default function DataDisc({ audioTrack, onOpenFrequency }) {
  if (!audioTrack) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Spinning Disc */}
      <motion.button
        onClick={() => onOpenFrequency(audioTrack)}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        className="relative w-12 h-12 rounded-full border-2 border-white/20 bg-black/50 backdrop-blur-md flex items-center justify-center cursor-pointer group shadow-[0_0_15px_rgba(255,51,51,0.2)] hover:border-[#FF3333] transition-colors"
      >
        <div className="absolute inset-1 rounded-full border border-white/10" />
        <div className="absolute inset-2 rounded-full border border-white/5" />
        <Disc3 size={20} className="text-[#FF3333] group-hover:scale-110 transition-transform" />
        <motion.div
          animate={{ y: [-5, -20], opacity: [1, 0], x: [0, 10] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute top-0 right-0 text-[#FF3333]"
        >
          <Music size={10} />
        </motion.div>
      </motion.button>
    </div>
  );
}