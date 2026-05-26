import React from 'react';
import { motion } from 'framer-motion';
import { useTension } from '@/hooks/useTension';

/**
 * TensionBar — the user's XP / level display, Spidr-themed.
 *
 * Shows the current level badge, a "web tension" progress bar that fills toward
 * the next level, and the XP remaining. Reads live state from useTension and
 * animates the fill whenever progress changes.
 *
 * Props:
 *   compact — smaller inline variant (e.g. for sidebars/headers)
 */
export default function TensionBar({ compact = false }) {
  const { progress, level } = useTension();

  if (!progress) {
    // Skeleton while loading
    return (
      <div className={`rounded-2xl bg-zinc-900/60 border border-white/5 ${compact ? 'p-3' : 'p-4'} animate-pulse`}>
        <div className="h-3 w-24 bg-zinc-800 rounded mb-3" />
        <div className="h-2 w-full bg-zinc-800 rounded-full" />
      </div>
    );
  }

  const pct = Math.round((progress.fraction || 0) * 100);

  return (
    <div className={`relative rounded-2xl bg-gradient-to-br from-zinc-900/80 to-black/80 border border-[#FF3333]/20 overflow-hidden ${compact ? 'p-3' : 'p-4'}`}>
      {/* faint web texture */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 90% 10%, #FF3333 0%, transparent 55%)' }} />

      <div className="relative flex items-center gap-3">
        {/* Level badge */}
        <div className="relative shrink-0">
          <div className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-[#FF3333] to-[#660000] flex items-center justify-center shadow-[0_0_18px_rgba(255,51,51,0.35)]`}>
            <span className={`font-black text-white ${compact ? 'text-base' : 'text-lg'}`}>{level}</span>
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-mono uppercase tracking-widest text-[#FF3333] bg-black/80 px-1 rounded">
            LVL
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className={`font-bold text-white ${compact ? 'text-xs' : 'text-sm'}`}>Web Tension</span>
            <span className="text-[10px] font-mono text-zinc-500">
              {progress.xpIntoLevel} / {progress.xpForNextLevel} XP
            </span>
          </div>

          {/* Progress track */}
          <div className="h-2.5 rounded-full bg-black/60 border border-white/5 overflow-hidden relative">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#FF3333] via-[#ff6b6b] to-[#FF3333] relative"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            >
              {/* shimmer */}
              <span className="absolute inset-0 opacity-40"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'tension-shimmer 2.2s linear infinite' }} />
            </motion.div>
          </div>

          {!compact && (
            <p className="text-[10px] text-zinc-600 mt-1.5">
              {progress.xpToNextLevel} XP until level {level + 1}
            </p>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tension-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      ` }} />
    </div>
  );
}
