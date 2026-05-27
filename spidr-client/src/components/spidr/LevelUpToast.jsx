import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

/**
 * LevelUpToast — celebratory overlay shown when the user crosses an XP level.
 *
 * Mounted once at the shell. Listens for `spidr-tension-levelup` (fired by
 * useTension) and drops a Spidr-themed banner with a burst of web-snap shards
 * and the biomass reward earned. Auto-dismisses after a few seconds.
 *
 * Pure presentation — no network. Plays a short WebAudio "snap" if the page has
 * had a user gesture (best-effort; silent otherwise).
 */
export default function LevelUpToast() {
  const [evt, setEvt] = useState(null); // { level, fromLevel, biomassReward }
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const snap = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioRef.current || new Ctx();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.52);
    } catch { /* best-effort */ }
  };

  useEffect(() => {
    const onLevelUp = (e) => {
      setEvt(e.detail || { level: '?' });
      snap();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setEvt(null), 4200);
    };
    window.addEventListener('spidr-tension-levelup', onLevelUp);
    return () => {
      window.removeEventListener('spidr-tension-levelup', onLevelUp);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!evt) return null;

  // Web-snap shards radiating from center.
  const shards = Array.from({ length: 12 });

  return createPortal((
    <AnimatePresence>
      <motion.div
        key="levelup"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[320] flex items-center justify-center pointer-events-none"
      >
        {/* Radiating web shards */}
        {shards.map((_, i) => {
          const angle = (i / shards.length) * Math.PI * 2;
          const dist = 140;
          return (
            <motion.span
              key={i}
              className="absolute w-px h-16 bg-gradient-to-b from-[#FF3333] to-transparent origin-bottom"
              style={{ left: '50%', top: '50%' }}
              initial={{ rotate: (angle * 180) / Math.PI, scaleY: 0, opacity: 0.9, x: 0, y: 0 }}
              animate={{
                scaleY: [0, 1.2, 0],
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                opacity: [0.9, 0.6, 0],
              }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          );
        })}

        <motion.div
          initial={{ scale: 0.6, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          className="relative px-8 py-6 rounded-3xl bg-[#0b0b0d]/95 backdrop-blur-xl border border-[#FF3333]/40 shadow-[0_0_60px_rgba(255,51,51,0.35)] text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#FF3333] font-mono mb-1">
            Web Tension Snapped
          </p>
          <div className="flex items-center justify-center gap-3 my-2">
            <span className="text-zinc-500 text-2xl font-black line-through decoration-zinc-700">
              {evt.fromLevel ?? ''}
            </span>
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: [0.5, 1.3, 1] }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="text-6xl font-black text-white"
              style={{ textShadow: '0 0 24px rgba(255,51,51,0.6)' }}
            >
              {evt.level}
            </motion.span>
          </div>
          <p className="text-white font-bold text-lg tracking-tight">LEVEL UP</p>
          {evt.biomassReward > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30">
              <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-300 text-sm font-bold">+{evt.biomassReward} Biomass</span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ), document.body);
}
