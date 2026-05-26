import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, HeadphoneOff, Maximize2, PhoneOff } from 'lucide-react';

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
  const dragControls = useRef(null);

  const color = apexColor && apexColor !== '#3f3f46' ? apexColor : '#FF3333';
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

  // Radial menu button positions (top-left, top-right, bottom) around the node.
  const radial = [
    { key: 'mute', icon: muted ? MicOff : Mic, onClick: handleMute, angle: -140, active: muted, danger: false },
    { key: 'deafen', icon: deafened ? HeadphoneOff : Headphones, onClick: handleDeafen, angle: -40, active: deafened, danger: false },
    { key: 'max', icon: Maximize2, onClick: handleMaximize, angle: 90, active: false, danger: false },
    { key: 'end', icon: PhoneOff, onClick: handleDisconnect, angle: 180, active: false, danger: true },
  ];
  const R = 46; // radial distance

  return (
    <div className="fixed top-0 right-10 z-[60] pointer-events-none" style={{ width: 0, height: 0 }}>
      {/* APEX thread from the top of the screen to the node */}
      <motion.div
        className="absolute left-1/2 top-0 origin-top pointer-events-none"
        style={{
          width: 2,
          height: useTransform(threadLen, (l) => 70 + l),
          background: `linear-gradient(to bottom, ${color}, ${color}40)`,
          x: useTransform(x, (v) => v),
          filter: `drop-shadow(0 0 4px ${color}88)`,
        }}
      />

      <motion.div
        drag
        dragMomentum
        dragConstraints={{ left: -window.innerWidth + 120, right: 40, top: 0, bottom: window.innerHeight - 160 }}
        dragTransition={{ bounceStiffness: 320, bounceDamping: 22 }}
        style={{ x, y }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="absolute left-1/2 -translate-x-1/2 mt-[70px] pointer-events-auto"
      >
        {/* Radial active-speaker waveform (Part 4.3) */}
        <AnimatePresence>
          {speaking && !muted && (
            <motion.svg
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 0.5 + amplitude * 0.5, scale: 1 + amplitude * 0.18 }}
              exit={{ opacity: 0, scale: 0.9 }}
              width="120" height="120" viewBox="0 0 120 120"
              className="absolute -inset-[18px] pointer-events-none"
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            >
              <path d={radialWaveform(60, 60, 44, 8)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* Radial symbiote menu (Part 4.2) */}
        <AnimatePresence>
          {hovered && radial.map((b) => {
            const rad = (b.angle * Math.PI) / 180;
            const bx = Math.cos(rad) * R, by = Math.sin(rad) * R;
            const Icon = b.icon;
            return (
              <motion.button
                key={b.key}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
                animate={{ x: bx, y: by, opacity: 1, scale: 1 }}
                exit={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                onClick={b.onClick}
                className={`absolute left-1/2 top-1/2 -ml-4 -mt-4 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border ${
                  b.danger ? 'bg-red-600/80 border-red-400/40 text-white'
                  : b.active ? 'bg-[#FF3333]/30 border-[#FF3333]/60 text-[#FF3333]'
                  : 'bg-[#050505]/90 border-white/15 text-zinc-200 hover:text-white'
                }`}
                style={{ boxShadow: b.danger ? '0 0 10px rgba(220,38,38,0.6)' : undefined }}
              >
                <Icon size={14} />
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* The core node (Part 4.1) — click to maximize ONLY (Part 6) */}
        <div
          onClick={handleExpand}
          role="button"
          title="Return to call"
          className="relative w-[60px] h-[60px] rounded-full bg-[#050505]/90 backdrop-blur-md border cursor-pointer flex items-center justify-center"
          style={{ borderColor: `${color}66`, boxShadow: `0 0 16px ${color}55` }}
        >
          {/* Avatar cluster — speaker floats to top of z-stack */}
          {participants.length > 0 ? (
            <div className="relative flex items-center justify-center">
              {participants.map((p, i) => (
                <img
                  key={i}
                  src={p.avatar}
                  alt=""
                  className="absolute w-7 h-7 rounded-full object-cover border-2"
                  style={{
                    borderColor: p.speaking ? color : '#000',
                    left: `${(i - (participants.length - 1) / 2) * 12}px`,
                    zIndex: p.speaking ? 30 : 10 - i,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${color}22` }}>
              <Mic size={14} style={{ color }} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Build a jagged radial SVG path approximating a circular waveform.
function radialWaveform(cx, cy, baseR, spikes) {
  const pts = [];
  const steps = spikes * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const jag = i % 2 === 0 ? baseR : baseR - 6;
    pts.push([cx + Math.cos(a) * jag, cy + Math.sin(a) * jag]);
  }
  return 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') + ' Z';
}
