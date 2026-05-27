import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ApexEntrance — full-screen flash animation played when a high-level / APEX
 * user makes an entrance (e.g. joins a voice channel). Mounted once at the
 * shell; listens for the `spidr-apex-entrance` window event:
 *
 *   window.dispatchEvent(new CustomEvent('spidr-apex-entrance', {
 *     detail: { name, style: 'thunder'|'ripple'|'glitch', color }
 *   }));
 *
 * Pure presentation, auto-dismisses (~1.8s). Three styles:
 *   thunder — white/red lightning flash + screen shake
 *   ripple  — expanding concentric web rings from center
 *   glitch  — RGB-split glitch bands sweeping the screen
 */
export default function ApexEntrance() {
  const [evt, setEvt] = useState(null); // { name, style, color }
  const timerRef = useRef(null);

  useEffect(() => {
    const onEntrance = (e) => {
      setEvt(e.detail || { style: 'ripple' });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setEvt(null), 1900);
    };
    window.addEventListener('spidr-apex-entrance', onEntrance);
    return () => {
      window.removeEventListener('spidr-apex-entrance', onEntrance);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!evt) return null;
  const color = evt.color || '#FF3333';
  const style = evt.style || 'ripple';
  const name = evt.name || 'APEX';

  return createPortal((
    <AnimatePresence>
      <motion.div
        key="apex-entrance"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[340] pointer-events-none flex items-center justify-center overflow-hidden"
      >
        {style === 'thunder' && <ThunderFX color={color} />}
        {style === 'ripple' && <RippleFX color={color} />}
        {style === 'glitch' && <GlitchFX color={color} />}

        {/* Name banner */}
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
          className="relative text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.4em] font-mono mb-1" style={{ color }}>
            Apex Entrance
          </p>
          <p className="text-5xl md:text-6xl font-black text-white"
            style={{ textShadow: `0 0 30px ${color}cc` }}>
            {name}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ), document.body);
}

function ThunderFX({ color }) {
  return (
    <>
      {/* Flash bursts */}
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 40%, ${color}55, transparent 60%)` }}
        animate={{ opacity: [0, 1, 0.2, 0.9, 0] }}
        transition={{ duration: 0.7, times: [0, 0.1, 0.3, 0.45, 1] }}
      />
      <motion.div
        className="absolute inset-0 bg-white"
        animate={{ opacity: [0, 0.8, 0, 0.5, 0] }}
        transition={{ duration: 0.4, times: [0, 0.05, 0.2, 0.3, 1] }}
      />
      {/* Lightning bolts */}
      {[20, 50, 78].map((x, i) => (
        <motion.div
          key={i}
          className="absolute top-0 w-0.5"
          style={{ left: `${x}%`, height: '60%', background: `linear-gradient(${color}, transparent)` }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 1, 0], scaleY: [0, 1, 1] }}
          transition={{ duration: 0.35, delay: 0.05 + i * 0.06 }}
        />
      ))}
    </>
  );
}

function RippleFX({ color }) {
  return (
    <>
      {[0, 0.18, 0.36].map((delay, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border-2"
          style={{ borderColor: color, left: '50%', top: '50%', width: 80, height: 80, marginLeft: -40, marginTop: -40 }}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{ scale: 16, opacity: 0 }}
          transition={{ duration: 1.4, delay, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 50%, ${color}22, transparent 55%)` }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.2 }}
      />
    </>
  );
}

function GlitchFX({ color }) {
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-black"
        animate={{ opacity: [0, 0.5, 0, 0.3, 0] }}
        transition={{ duration: 0.6 }}
      />
      {[12, 33, 55, 71, 88].map((top, i) => (
        <motion.div
          key={i}
          className="absolute left-0 right-0"
          style={{
            top: `${top}%`,
            height: `${6 + (i % 3) * 4}%`,
            background: i % 2 === 0 ? `${color}66` : '#00e5ff44',
            mixBlendMode: 'screen',
          }}
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: ['-100%', '100%'], opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, delay: i * 0.05, ease: 'linear' }}
        />
      ))}
    </>
  );
}
