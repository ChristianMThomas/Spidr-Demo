import React from 'react';
import { motion } from 'framer-motion';

import SpiderLogo from './SpiderLogo';

export default function BotMessage({ command, response, actions }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="max-w-2xl"
    >
      {/* The command that triggered it */}
      {command && (
        <div className="flex items-center gap-2 mb-1 ml-4 opacity-50">
          <div className="w-1 h-4 bg-gray-600 rounded-full" />
          <span className="text-xs font-mono text-gray-400">
            Invoked: <span className="text-white font-bold">{command}</span>
          </span>
        </div>
      )}

      {/* The AI Response Card */}
      <div className="relative bg-[#0a0a0a] border border-[#FF3333]/30 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(255,51,51,0.05)]">
        {/* Header Strip */}
        <div className="h-1 w-full bg-gradient-to-r from-[#FF3333] to-purple-600" />

        <div className="p-4 flex gap-4">
          {/* AI Avatar */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="absolute inset-0 bg-[#FF3333] blur-[15px] opacity-20 animate-pulse" />
            <div className="w-full h-full bg-black border border-[#FF3333] rounded-lg flex items-center justify-center relative z-10">
              <SpiderLogo size={20} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#FF3333] rounded-sm" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-black text-sm text-white tracking-wide">SPIDR_AI</span>
              <span className="text-[9px] bg-[#FF3333]/10 text-[#FF3333] px-1.5 py-0.5 rounded border border-[#FF3333]/20 font-bold">
                SYSTEM
              </span>
            </div>

            <p className="text-sm text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
              {response}
            </p>

            {/* Action Buttons */}
            {actions && actions.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={action.onClick}
                    className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${
                      i === 0
                        ? 'bg-[#FF3333]/20 hover:bg-[#FF3333]/40 border border-[#FF3333]/30 text-[#FF3333]'
                        : 'border border-white/10 text-gray-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Background Texture */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,51,51,0.1) 0%, transparent 50%)'
        }} />
      </div>
    </motion.div>
  );
}