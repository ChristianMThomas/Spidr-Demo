import React from 'react';
import { motion } from 'framer-motion';
import { SPIDR_AI_AVATAR } from './SpidrAIProfile';

export default function SystemMessage({ content }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="max-w-2xl"
    >
      <div className="relative bg-[#0a0a0a] border border-zinc-700/50 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.02)]">
        {/* Header Strip */}
        <div className="h-0.5 w-full bg-gradient-to-r from-zinc-600 via-[#FF3333]/50 to-zinc-600" />

        <div className="p-3 flex gap-3">
          {/* System Avatar */}
          <div className="relative w-9 h-9 flex-shrink-0">
            <div className="absolute inset-0 bg-[#FF3333] blur-[10px] opacity-10" />
            <img
              src={SPIDR_AI_AVATAR}
              alt="Spidr System"
              className="w-full h-full rounded-lg object-cover border border-zinc-700 relative z-10"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#FF3333] rounded-sm z-20" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-black text-xs text-white tracking-wide">SPIDR</span>
              <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700 font-bold uppercase tracking-wider">
                System
              </span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed break-words">
              {content}
            </p>
          </div>
        </div>

        {/* Background Texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,51,51,0.15) 0%, transparent 50%)'
        }} />
      </div>
    </motion.div>
  );
}