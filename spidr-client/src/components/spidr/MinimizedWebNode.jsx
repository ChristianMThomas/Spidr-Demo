import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, HeadphoneOff, Maximize2, PhoneOff } from 'lucide-react';
import { entities, auth } from '@/api/apiClient';

/**
 * MinimizedWebNode — the "Suspended Web Node" minimized call UI (Part 4).
 *
 * A circular dark-glass node that hangs from the top of the screen by a thread
 * in the user's APEX color. Draggable with spring physics; on hover it unfurls a
 * radial "symbiote" menu (Mute / Deafen / Maximize) connected by thread lines,
 * and a radial waveform wraps the node when the active speaker is talking.
 *
 * Part 6 — click-to-maximize correctness:
 *   • The outer wrapper's onClick ONLY calls onExpand (restore full deck). It
 *     NEVER disconnects.
 *   • Every sub-button calls e.stopPropagation() so it can't bubble to the
 *     wrapper (and the wrapper can't trigger a button).
 *   • Disconnect is its own radial button; it is NOT the wrapper action.
 *   • The WebRTC session lives in VoiceChannel/useWebRTC at the shell level and
 *     is untouched here — mounting/unmounting this node never tears down media
 *     (mute/deafen/leave are dispatched as events the live session listens for).
 *
 * Props:
 *   call        { serverName, groupName, channelName, participants?: [{name,avatar,apexColor,speaking}] }
 *   apexColor   current user's APEX thread color (fallback handled)
 *   speaking    boolean — active-speaker state (drives the radial EQ)
 *   amplitude   0..1 — optional volume amplitude (drives EQ scale/opacity)
 *   onExpand    () => restore full deck (FOCUS_MODE)
 *   onEnd       () => leave the call
 *   onMuteToggle(muted), onDeafenToggle(deafened)
 */
export default function MinimizedWebNode({
  call = {}, apexColor = '#3f3f46', speaking = false, amplitude = 0,
  onExpand, onEnd, onMuteToggle, onDeafenToggle,
}) {
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [fetchedColor, setFetchedColor] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const dragControls = useRef(null);

  // Internal call timer — counts from when this node first appears, so the meta
  // pill shows a live duration even if the parent doesn't supply one.
  useEffect(() => {
    const started = Date.now() - (call.durationSeconds ? call.durationSeconds * 1000 : 0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull the current user's equipped APEX thread skin color so the minimized
  // node's thread + waveform + glow reflect the customization from the APEX
  // settings (Thread Skins / Chroma). Falls back to the apexColor prop, then red.
  useEffect(() => {
    let alive = true;
    auth.me?.().then(async (me) => {
      if (!me?.id) return;
      const profiles = await entities.UserProfile.filter({ user_id: me.id }).catch(() => []);
      const c = profiles?.[0]?.apex_features?.thread_skin_color
        || profiles?.[0]?.accent_color;
      if (alive && c) setFetchedColor(c);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const resolved = fetchedColor || apexColor;
  const color = resolved && resolved !== '#3f3f46' ? resolved : '#FF3333';
  const participants = (call.participants || []).slice(0, 3);

  // Drag offset → thread stretch. The thread is anchored at screen top; as the
  // node is dragged down/around, the thread visually lengthens.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const threadLen = useTransform([x, y], ([lx, ly]) => Math.sqrt(lx * lx + ly * ly));

  const handleExpand = () => { onExpand?.(); };

  const handleMute = (e) => {
    e.stopPropagation();
    const next = !muted; setMuted(next); onMuteToggle?.(next);
    window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: next } }));
  };
  const handleDeafen = (e) => {
    e.stopPropagation();
    const next = !deafened; setDeafened(next); onDeafenToggle?.(next);
    if (next && !muted) { setMuted(true); window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: true } })); }
    window.dispatchEvent(new CustomEvent('spidr-call-deafen-toggle', { detail: { deafened: next } }));
  };
  const handleDisconnect = (e) => {
    e.stopPropagation(); // CRITICAL: don't bubble to the wrapper (Part 6)
    onEnd?.();
  };
  const handleMaximize = (e) => { e.stopPropagation(); handleExpand(); };

  // Orbital buttons positioned to match the reference video:
  //  • Mute      → upper-right
  //  • Disconnect→ lower-left
  //  • Expand    → lower-right
  // Angles in degrees (0 = right, 90 = down, clockwise).
  const orbital = [
    { key: 'mute',   icon: muted ? MicOff : Mic,            onClick: handleMute,       angle: -45,  variant: muted ? 'danger' : 'neutral' },
    { key: 'end',    icon: PhoneOff,                         onClick: handleDisconnect, angle: 135,  variant: 'danger' },
    { key: 'expand', icon: Maximize2,                        onClick: handleMaximize,   angle: 45,   variant: 'accent' },
  ];
  const R = 58; // orbital distance from node center

  // Blue radial visualizer ticks around the avatar — discrete short lines that
  // radiate outward and brighten with speaking/amplitude, matching the video.
  const TICKS = 32;
  const ringColor = '#3b82f6'; // the reference ring is blue
  const speakingBoost = speaking ? 1 : 0.55;

  return (
    <div className="fixed top-0 right-12 z-[60] pointer-events-none" style={{ width: 0, height: 0 }}>
      {/* Thin thread from the top of the screen to the node */}
      <motion.div
        className="absolute left-1/2 top-0 origin-top pointer-events-none"
        style={{
          width: 1.5,
          height: useTransform(threadLen, (l) => 60 + l),
          background: `linear-gradient(to bottom, ${ringColor}, ${ringColor}22)`,
          x: useTransform(x, (v) => v),
          filter: `drop-shadow(0 0 3px ${ringColor}88)`,
        }}
      />

      <motion.div
        drag
        dragMomentum
        dragConstraints={{ left: -window.innerWidth + 140, right: 40, top: 0, bottom: window.innerHeight - 180 }}
        dragTransition={{ bounceStiffness: 320, bounceDamping: 22 }}
        style={{ x, y }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="absolute left-1/2 -translate-x-1/2 mt-[60px] pointer-events-auto"
      >
        {/* Orbital action buttons — pop outward on hover with a spring */}
        <AnimatePresence>
          {hovered && orbital.map((b) => {
            const rad = (b.angle * Math.PI) / 180;
            const bx = Math.cos(rad) * R, by = Math.sin(rad) * R;
            const Icon = b.icon;
            const cls =
              b.variant === 'danger' ? 'bg-[#1a0c0c]/90 border-red-500/50 text-red-400'
              : b.variant === 'accent' ? 'bg-[#0c1320]/90 border-blue-500/50 text-blue-400'
              : 'bg-[#0a0a0a]/90 border-white/15 text-zinc-200 hover:text-white';
            return (
              <motion.button
                key={b.key}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{ x: bx, y: by, opacity: 1, scale: 1 }}
                exit={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                onClick={b.onClick}
                className={`absolute left-1/2 top-1/2 -ml-4 -mt-4 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border ${cls}`}
              >
                <Icon size={14} />
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* The node: blue radial tick ring + circular avatar (click = expand) */}
        <div
          onClick={handleExpand}
          role="button"
          title="Return to call"
          className="relative w-[88px] h-[88px] flex items-center justify-center cursor-pointer"
        >
          {/* Radial tick ring */}
          <motion.svg
            width="88" height="88" viewBox="0 0 88 88"
            className="absolute inset-0 pointer-events-none"
            animate={{ scale: speaking ? [1, 1.04, 1] : 1 }}
            transition={{ duration: 1.2, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${ringColor}aa)` }}
          >
            {Array.from({ length: TICKS }).map((_, i) => {
              const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
              const inner = 30, outer = 30 + (6 + (i % 2 === 0 ? 4 : 0));
              const x1 = 44 + Math.cos(a) * inner, y1 = 44 + Math.sin(a) * inner;
              const x2 = 44 + Math.cos(a) * outer, y2 = 44 + Math.sin(a) * outer;
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={ringColor} strokeWidth="1.6" strokeLinecap="round"
                  opacity={(0.35 + 0.5 * Math.abs(Math.sin(i))) * speakingBoost} />
              );
            })}
          </motion.svg>

          {/* Circular avatar */}
          <div
            className="relative w-[52px] h-[52px] rounded-full overflow-hidden bg-[#050505] flex items-center justify-center"
            style={{ boxShadow: `0 0 14px ${ringColor}66, inset 0 0 8px rgba(0,0,0,0.8)` }}
          >
            {participants[0]?.avatar ? (
              <img src={participants[0].avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `${color}22` }}>
                <Mic size={18} style={{ color }} />
              </div>
            )}
          </div>
        </div>

        {/* Meta pill below the node — call timer · participant count */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[88px] whitespace-nowrap">
          <div className="px-2.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/10 font-mono text-[10px] text-white/90 flex items-center gap-1.5">
            <span className="tabular-nums" style={{ color: ringColor }}>{formatTimer(elapsed || call.durationSeconds || 0)}</span>
            <span className="text-white/30">·</span>
            <span>{Math.max(participants.length, 1)}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
