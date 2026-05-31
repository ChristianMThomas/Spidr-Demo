import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, PhoneOff, Maximize2, Circle, Volume2 } from 'lucide-react';
import { auth, entities } from '@/api/apiClient';

/**
 * MinimizedWebNode — the "Suspended Web Node" minimized voice overlay.
 *
 * The radial node design: a circular avatar at the center, wrapped in an
 * absolute SVG tick-ring that pulses/rotates with the active-speaker state,
 * and a dark meta pill below showing the live call timer · participant count.
 * On hover, framer-motion "pops" the control buttons out as an orbital dock —
 * the full set we added: Mute, Deafen, volume slider, RECORD_NODE, Expand,
 * Leave. Ctrl+` also toggles the dock.
 *
 * Shell contract preserved: props { call, apexColor, speaking, onExpand, onEnd }
 * and dispatches spidr-call-mute-toggle / spidr-call-deafen-toggle.
 */
export default function MinimizedWebNode({
  call = {}, apexColor = '#3f3f46', speaking = false,
  onExpand, onEnd,
}) {
  const [myAvatar, setMyAvatar] = useState(null);
  const [fetchedColor, setFetchedColor] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [volume, setVolume] = useState(80);
  const [recording, setRecording] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Resolve current-user avatar + APEX thread color.
  useEffect(() => {
    let alive = true;
    auth.me?.().then(async (me) => {
      if (!me?.id) return;
      if (alive && me.avatar_url) setMyAvatar(me.avatar_url);
      const profiles = await entities.UserProfile.filter({ user_id: me.id }).catch(() => []);
      const c = profiles?.[0]?.apex_features?.thread_skin_color || profiles?.[0]?.accent_color;
      if (alive && c) setFetchedColor(c);
      if (alive && !me.avatar_url && profiles?.[0]?.avatar_url) setMyAvatar(profiles[0].avatar_url);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Live call timer.
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Ctrl+` toggles the orbital dock.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === '`' || e.key === '~')) { e.preventDefault(); setHovered((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resolved = fetchedColor || apexColor;
  const color = resolved && resolved !== '#3f3f46' ? resolved : '#FF3333';
  const participants = (call.participants || []);
  const nodeAvatar = participants[0]?.avatar || myAvatar;

  const toggleMute = useCallback((e) => {
    e?.stopPropagation();
    setMuted((m) => {
      const next = !m;
      window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: next } }));
      return next;
    });
  }, []);

  const toggleDeafen = useCallback((e) => {
    e?.stopPropagation();
    setDeafened((d) => {
      const next = !d;
      if (next && !muted) { setMuted(true); window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: true } })); }
      window.dispatchEvent(new CustomEvent('spidr-call-deafen-toggle', { detail: { deafened: next } }));
      return next;
    });
  }, [muted]);

  const handleEnd = (e) => { e?.stopPropagation(); window.dispatchEvent(new Event('spidr-call-disconnect')); onEnd?.(); };
  const handleExpand = (e) => { e?.stopPropagation(); onExpand?.(); };
  const toggleRecord = (e) => { e?.stopPropagation(); setRecording((r) => !r); };

  // Tick-ring geometry.
  const R = 30, CX = 38, CY = 38, TICKS = 32;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = (i / TICKS) * Math.PI * 2;
    const inner = R - 3, outer = R + (speaking ? 4 : 2);
    return {
      x1: CX + Math.cos(a) * inner, y1: CY + Math.sin(a) * inner,
      x2: CX + Math.cos(a) * outer, y2: CY + Math.sin(a) * outer,
    };
  });

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="fixed top-4 right-4 z-[120] cursor-grab active:cursor-grabbing pointer-events-auto"
      style={{ width: 76, height: 76 }}
    >
      {/* Radial tick-ring */}
      <motion.svg
        viewBox="0 0 76 76"
        className="absolute inset-0 w-full h-full"
        animate={{ rotate: 360 }}
        transition={{ duration: speaking ? 8 : 26, repeat: Infinity, ease: 'linear' }}
        style={{ filter: `drop-shadow(0 0 ${speaking ? 10 : 5}px ${color})` }}
      >
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={color} strokeWidth={1.2}
            opacity={speaking ? 0.5 + 0.5 * Math.abs(Math.sin(i)) : 0.35} />
        ))}
      </motion.svg>

      {/* Pulsing glow ring behind avatar */}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 10, border: `1.5px solid ${color}`, boxShadow: `0 0 12px ${color}88` }}
        animate={speaking ? { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] } : { scale: 1, opacity: 0.55 }}
        transition={speaking ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
      />

      {/* Center avatar */}
      <div className="absolute rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center"
        style={{ inset: 14 }} onClick={handleExpand} title="Expand call">
        {nodeAvatar
          ? <img src={nodeAvatar} alt="" className="w-full h-full object-cover" />
          : <Mic size={18} style={{ color }} />}
      </div>

      {/* Meta pill below — live timer · participant count */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[78px] whitespace-nowrap">
        <div className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/10 font-mono text-[10px] text-white/80 flex items-center gap-1">
          <span className="tabular-nums" style={{ color }}>{formatTimer(elapsed || call.durationSeconds || 0)}</span>
          <span className="text-white/30">·</span>
          <span>{Math.max(participants.length, 1)}</span>
        </div>
      </div>

      {/* Orbital control dock — pops out on hover / Ctrl+` */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -4 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="absolute left-1/2 -translate-x-1/2 top-[104px] z-10"
            onHoverStart={() => setHovered(true)}
          >
            <div className="rounded-2xl bg-black/70 backdrop-blur-sm border border-white/10 shadow-xl p-2 flex flex-col gap-2 min-w-[176px]">
              <div className="flex items-center gap-1.5 justify-center">
                <OrbitBtn active={muted} activeClass="bg-red-500/20 text-red-400 border-red-500/40" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                  {muted ? <MicOff size={14} /> : <Mic size={14} />}
                </OrbitBtn>
                <OrbitBtn active={deafened} activeClass="bg-red-500/20 text-red-400 border-red-500/40" onClick={toggleDeafen} title={deafened ? 'Undeafen' : 'Deafen'}>
                  <Headphones size={14} />
                </OrbitBtn>
                <OrbitBtn onClick={handleExpand} title="Expand call">
                  <Maximize2 size={14} />
                </OrbitBtn>
                <OrbitBtn active activeClass="bg-red-600 text-white border-red-500" onClick={handleEnd} title="Leave call">
                  <PhoneOff size={14} />
                </OrbitBtn>
              </div>
              <div className="flex items-center gap-1.5 px-1">
                <Volume2 size={12} className="text-zinc-400 shrink-0" />
                <input type="range" min={0} max={100} value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 accent-red-500 cursor-pointer" />
              </div>
              <button
                onClick={toggleRecord}
                className={`w-full rounded-md border font-mono text-[10px] tracking-widest uppercase py-1.5 transition-all ${
                  recording ? 'bg-red-500 text-white border-red-500' : 'bg-red-600/10 border-red-500/40 text-red-500 hover:bg-red-500 hover:text-white'
                }`}>
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Circle size={8} className={recording ? 'fill-white' : 'fill-red-500'} />
                  {recording ? '[ RECORDING… ]' : '[ RECORD_NODE ]'}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OrbitBtn({ children, onClick, title, active, activeClass = '' }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
        active ? activeClass : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </motion.button>
  );
}

function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
