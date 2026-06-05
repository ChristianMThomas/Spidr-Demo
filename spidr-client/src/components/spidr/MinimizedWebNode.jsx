import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, PhoneOff, Maximize2, Monitor, Scissors, Volume2 } from 'lucide-react';
import { auth, entities } from '@/api/apiClient';

/**
 * MinimizedWebNode — the horizontal "Suspended Web Node" pill.
 *
 * Visual design (matches Spidr design spec v2):
 *   • A horizontal stadium pill anchored to the top-center of the viewport.
 *   • A blue "tether" beam descends from the very top of the screen and
 *     terminates at the pill — the metaphor: the node hangs from above.
 *   • Avatar on the left, wrapped in a dense radial sonar ring (white/cyan
 *     tick marks that pulse with `speaking`).
 *   • Right side stacks: signal bars + monospaced timer on top row, "N nodes
 *     · {name}" beneath it. Everything inside the pill.
 *   • Clicking the pill (or pressing Ctrl+`) reveals a control panel docked
 *     directly beneath it: CHANNEL VOL slider, three round action buttons
 *     (Mute / Share / Clip), and an Expand · Leave row at the bottom.
 *
 * Backward-compatible contract: keeps the props { call, apexColor, speaking,
 * amplitude, onExpand, onEnd, onMuteToggle } the shell already passes, and
 * keeps the existing event channels (spidr-call-mute-toggle,
 * spidr-call-deafen-toggle, spidr-call-disconnect). Two new optional events
 * have been added for parity with the new buttons:
 *   • spidr-call-screenshare-toggle  { active: boolean }
 *   • spidr-call-clip                {} — a fire-and-forget "clip last 30s"
 * VoiceChannel can listen for either when ready; until then they're harmless.
 */

const CALL_ACCENT = '#3b82f6'; // electric blue — the default "call active" hue

export default function MinimizedWebNode({
  call = {}, apexColor = '#3f3f46', speaking = false, amplitude = 0,
  onExpand, onEnd,
}) {
  const [myAvatar, setMyAvatar] = useState(null);
  const [fetchedColor, setFetchedColor] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [volume, setVolume] = useState(80);
  const [clipping, setClipping] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef(null);

  // ── Resolve current-user avatar + APEX thread color ─────────────────────
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

  // ── Live call timer ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Ctrl+` toggles the dock; Escape closes it ───────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        setPanelOpen((v) => !v);
      } else if (e.key === 'Escape' && panelOpen) {
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  // ── Close panel on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!panelOpen) return;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setPanelOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [panelOpen]);

  // Use the user's APEX accent color if they've set a custom one; otherwise
  // fall back to the electric-blue "call active" hue from the spec.
  const resolvedAccent = fetchedColor || (apexColor && apexColor !== '#3f3f46' ? apexColor : null);
  const accent = resolvedAccent || CALL_ACCENT;

  const participants = (call.participants || []);
  const nodeAvatar = participants[0]?.avatar || myAvatar;
  const nodeName = participants[0]?.name || call.recipientName || 'Solo';
  const nodeCount = Math.max(participants.length, 1);

  // ── Button handlers — preserve existing event contract ──────────────────
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
      if (next && !muted) {
        setMuted(true);
        window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: true } }));
      }
      window.dispatchEvent(new CustomEvent('spidr-call-deafen-toggle', { detail: { deafened: next } }));
      return next;
    });
  }, [muted]);

  const toggleShare = useCallback((e) => {
    e?.stopPropagation();
    setSharing((s) => {
      const next = !s;
      window.dispatchEvent(new CustomEvent('spidr-call-screenshare-toggle', { detail: { active: next } }));
      return next;
    });
  }, []);

  const handleClip = useCallback((e) => {
    e?.stopPropagation();
    setClipping(true);
    window.dispatchEvent(new CustomEvent('spidr-call-clip', { detail: { at: Date.now() } }));
    // Brief visual confirmation; the actual clip lifecycle is owned by the
    // call/recording subsystem.
    setTimeout(() => setClipping(false), 900);
  }, []);

  const handleEnd = (e) => {
    e?.stopPropagation();
    window.dispatchEvent(new Event('spidr-call-disconnect'));
    onEnd?.();
  };
  const handleExpand = (e) => {
    e?.stopPropagation();
    setPanelOpen(false);
    onExpand?.();
  };
  const handlePillClick = (e) => {
    e?.stopPropagation();
    setPanelOpen((v) => !v);
  };

  // ── Pill geometry ───────────────────────────────────────────────────────
  // Avatar with concentric sonar ring tick marks. The ring is denser than the
  // old "tick-ring" and the ticks bob with amplitude/speaking.
  const RING_R       = 26;     // radius the ticks center on
  const RING_TICKS   = 36;
  const tickInnerOff = 2;
  const tickOuterOff = speaking ? 8 : 5;
  const ringSize     = (RING_R + tickOuterOff + 4) * 2; // svg viewBox edge
  const CX = ringSize / 2;
  const CY = ringSize / 2;
  const ticks = Array.from({ length: RING_TICKS }, (_, i) => {
    const a = (i / RING_TICKS) * Math.PI * 2 - Math.PI / 2;
    // Modulate each tick's outward extent by amplitude + a per-tick phase
    const phase = (Math.sin(i * 0.9 + elapsed * (speaking ? 4 : 0.4)) + 1) / 2;
    const grow = (speaking ? 3 : 1) * (0.3 + 0.7 * phase) * (1 + (amplitude || 0));
    const inner = RING_R - tickInnerOff;
    const outer = RING_R + tickOuterOff * 0.6 + grow;
    return {
      x1: CX + Math.cos(a) * inner, y1: CY + Math.sin(a) * inner,
      x2: CX + Math.cos(a) * outer, y2: CY + Math.sin(a) * outer,
      opacity: 0.35 + 0.55 * phase,
    };
  });

  const accentRgb = hexToRgb(accent);

  return (
    <>
      {/* ── Tether beam ────────────────────────────────────────────────────
          A thin blue line that descends from the very top of the viewport
          to the top of the pill. CSS-only so it's free to render and stays
          perfectly aligned to whatever horizontal position the pill is at. */}
      <div
        className="fixed top-0 left-1/2 z-[119] pointer-events-none"
        style={{
          transform: 'translateX(-50%)',
          width: 2,
          height: 28,
          background: `linear-gradient(to bottom, transparent 0%, rgba(${accentRgb}, 0.0) 0%, rgba(${accentRgb}, 0.9) 60%, rgba(${accentRgb}, 1) 100%)`,
          boxShadow: `0 0 8px rgba(${accentRgb}, 0.7), 0 0 18px rgba(${accentRgb}, 0.4)`,
        }}
        aria-hidden
      />

      <div
        ref={rootRef}
        className="fixed top-7 left-1/2 z-[120] pointer-events-auto"
        style={{ transform: 'translateX(-50%)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0,   scale: 1   }}
          exit   ={{ opacity: 0, y: -16, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="relative"
        >
        {/* ── The pill ────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handlePillClick}
          aria-expanded={panelOpen}
          aria-label="Voice call — click to open controls"
          className="relative flex items-center pl-2 pr-5 py-2 rounded-full backdrop-blur-xl group focus:outline-none"
          style={{
            background: 'linear-gradient(180deg, rgba(8, 12, 24, 0.92) 0%, rgba(4, 6, 14, 0.96) 100%)',
            border: `1px solid rgba(${accentRgb}, 0.45)`,
            boxShadow: `
              0 0 14px rgba(${accentRgb}, 0.35),
              0 0 38px rgba(${accentRgb}, 0.18),
              inset 0 0 12px rgba(${accentRgb}, 0.08),
              0 4px 24px rgba(0, 0, 0, 0.5)
            `,
            minWidth: 220,
          }}
        >
          {/* Avatar + sonar ring */}
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize, marginLeft: -6 }}>
            <svg
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              className="absolute inset-0 w-full h-full"
              style={{ filter: `drop-shadow(0 0 ${speaking ? 8 : 4}px rgba(${accentRgb}, ${speaking ? 0.9 : 0.55}))` }}
              aria-hidden
            >
              {ticks.map((t, i) => (
                <line
                  key={i}
                  x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                  stroke="#dbeafe"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  opacity={t.opacity}
                />
              ))}
            </svg>

            {/* Soft pulsing aura behind the avatar */}
            <motion.div
              className="absolute rounded-full"
              style={{
                inset: 9,
                border: `1.5px solid rgba(${accentRgb}, 0.9)`,
                boxShadow: `0 0 10px rgba(${accentRgb}, 0.55)`,
              }}
              animate={speaking
                ? { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }
                : { scale: 1, opacity: 0.7 }}
              transition={speaking
                ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 }}
            />

            {/* The avatar disc */}
            <div
              className="absolute rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center"
              style={{ inset: 12 }}
            >
              {nodeAvatar
                ? <img src={nodeAvatar} alt="" className="w-full h-full object-cover" />
                : <Mic size={14} style={{ color: accent }} />
              }
            </div>
          </div>

          {/* Right side — signal · timer · meta */}
          <div className="flex flex-col items-start ml-1 leading-none">
            <div className="flex items-center gap-1.5">
              <SignalBars accent={accent} active={!muted} />
              <span
                className="font-mono text-[13px] tabular-nums tracking-wide"
                style={{ color: '#cfe2ff', textShadow: `0 0 6px rgba(${accentRgb}, 0.5)` }}
              >
                {formatTimer(elapsed || call.durationSeconds || 0)}
              </span>
            </div>
            <span className="font-mono text-[10px] mt-1 tracking-wide text-zinc-400">
              <span style={{ color: '#dbeafe' }}>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
              <span className="text-zinc-600 mx-1">·</span>
              <span className="truncate inline-block max-w-[110px] align-bottom" title={nodeName}>{nodeName}</span>
            </span>
          </div>
        </button>

        {/* ── Control panel ───────────────────────────────────────────── */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit   ={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="absolute left-1/2 top-[calc(100%+10px)] -translate-x-1/2"
              style={{ width: 280 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className="rounded-2xl p-3.5"
                style={{
                  background: 'linear-gradient(180deg, rgba(14, 18, 30, 0.96) 0%, rgba(8, 10, 20, 0.98) 100%)',
                  border: `1px solid rgba(${accentRgb}, 0.25)`,
                  boxShadow: `
                    0 0 22px rgba(${accentRgb}, 0.25),
                    0 18px 48px rgba(0, 0, 0, 0.65)
                  `,
                  backdropFilter: 'blur(20px)',
                }}
              >
                {/* Volume row */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-zinc-400">
                    Channel Vol
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.22em] text-zinc-300 tabular-nums">
                    {volume}%
                  </span>
                </div>
                <div className="mb-4">
                  <VolumeSlider
                    value={volume}
                    onChange={(v) => setVolume(v)}
                    accent={accent}
                    accentRgb={accentRgb}
                  />
                </div>

                {/* Action row — Mute / Share / Clip */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <PanelButton
                    label={muted ? 'Unmute' : 'Mute'}
                    icon={muted ? <MicOff size={16} /> : <Mic size={16} />}
                    onClick={toggleMute}
                    active={muted}
                    activeStyle={{
                      background: 'rgba(239, 68, 68, 0.18)',
                      borderColor: 'rgba(239, 68, 68, 0.6)',
                      color: '#fca5a5',
                    }}
                  />
                  <PanelButton
                    label={sharing ? 'Stop sharing' : 'Share screen'}
                    icon={<Monitor size={16} />}
                    onClick={toggleShare}
                    active={sharing}
                    activeStyle={{
                      background: `rgba(${accentRgb}, 0.22)`,
                      borderColor: `rgba(${accentRgb}, 0.7)`,
                      color: '#dbeafe',
                    }}
                  />
                  <PanelButton
                    label={clipping ? 'Clipped!' : 'Clip last 30s'}
                    icon={<Scissors size={16} />}
                    onClick={handleClip}
                    accent
                    active={clipping}
                    activeStyle={{
                      background: 'rgba(168, 85, 247, 0.85)',
                      borderColor: 'rgba(216, 180, 254, 0.9)',
                      color: '#ffffff',
                    }}
                  />
                </div>

                {/* Expand / Leave row */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExpand}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono text-[11px] tracking-wider transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#d4d4d8',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `rgba(${accentRgb}, 0.12)`;
                      e.currentTarget.style.borderColor = `rgba(${accentRgb}, 0.45)`;
                      e.currentTarget.style.color = '#dbeafe';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '#d4d4d8';
                    }}
                  >
                    <Maximize2 size={13} /> Expand
                  </button>
                  <button
                    onClick={handleEnd}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono text-[11px] tracking-wider transition-all"
                    style={{
                      background: 'rgba(239, 68, 68, 0.16)',
                      border: '1px solid rgba(239, 68, 68, 0.45)',
                      color: '#fca5a5',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 1)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                      e.currentTarget.style.color = '#fca5a5';
                    }}
                  >
                    <PhoneOff size={13} /> Leave
                  </button>
                </div>

                {/* Deafen — kept available via Ctrl+` users from the old design,
                    surfaced here as a compact secondary row so the muscle
                    memory still works. */}
                <button
                  onClick={toggleDeafen}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-[10px] tracking-[0.2em] uppercase transition-all"
                  style={{
                    background: deafened ? 'rgba(239, 68, 68, 0.16)' : 'transparent',
                    border: `1px solid ${deafened ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255,255,255,0.08)'}`,
                    color: deafened ? '#fca5a5' : '#71717a',
                  }}
                  onMouseEnter={(e) => {
                    if (!deafened) e.currentTarget.style.color = '#d4d4d8';
                  }}
                  onMouseLeave={(e) => {
                    if (!deafened) e.currentTarget.style.color = '#71717a';
                  }}
                >
                  <Headphones size={11} />
                  {deafened ? 'Undeafen' : 'Deafen'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}

// ── Signal bars icon (4 vertical bars of increasing height) ──────────────
function SignalBars({ accent, active }) {
  const heights = [3, 5, 8, 11];
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 3.2 + 0.5}
          y={11 - h}
          width={2.2}
          height={h}
          rx={0.5}
          fill={active ? accent : '#52525b'}
          opacity={active ? (0.4 + i * 0.18) : 0.5}
        />
      ))}
    </svg>
  );
}

// ── Volume slider — purple→blue gradient track + purple knob ──────────────
function VolumeSlider({ value, onChange, accent, accentRgb }) {
  const ref = useRef(null);
  const dragging = useRef(false);

  const set = (clientX) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(Math.round(pct * 100));
  };

  const onPointerDown = (e) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    set(e.clientX);
  };
  const onPointerMove = (e) => { if (dragging.current) set(e.clientX); };
  const onPointerUp   = (e) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative h-5 flex items-center cursor-pointer touch-none"
    >
      {/* Track */}
      <div
        className="absolute left-0 right-0 h-1 rounded-full"
        style={{ background: 'rgba(255, 255, 255, 0.08)' }}
      />
      {/* Filled portion */}
      <div
        className="absolute left-0 h-1 rounded-full"
        style={{
          width: `${value}%`,
          background: `linear-gradient(90deg, rgba(${accentRgb}, 0.95) 0%, rgba(168, 85, 247, 0.95) 100%)`,
          boxShadow: `0 0 6px rgba(${accentRgb}, 0.45)`,
        }}
      />
      {/* Knob */}
      <div
        className="absolute rounded-full"
        style={{
          left: `${value}%`,
          transform: 'translate(-50%, 0)',
          width: 14, height: 14,
          background: '#a855f7',
          border: '2px solid #f3e8ff',
          boxShadow: '0 0 10px rgba(168, 85, 247, 0.7)',
        }}
      />
    </div>
  );
}

// ── Round panel button with tooltip ───────────────────────────────────────
// `accent` buttons (Clip) are wider and always show their label inline.
// Non-accent buttons show only the icon with a tooltip on hover.
function PanelButton({ icon, label, onClick, active, accent, activeStyle = {} }) {
  const [hover, setHover] = useState(false);
  const base = accent ? {
    background: 'rgba(168, 85, 247, 0.18)',
    borderColor: 'rgba(168, 85, 247, 0.45)',
    color: '#d8b4fe',
  } : {
    background: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#d4d4d8',
  };
  const hoverStyle = accent ? {
    background: 'rgba(168, 85, 247, 0.3)',
    borderColor: 'rgba(168, 85, 247, 0.7)',
    color: '#ffffff',
  } : {
    background: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
  };
  const state = active ? activeStyle : (hover ? hoverStyle : base);

  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={onClick}
        aria-label={label}
        className="w-full h-10 rounded-lg border flex items-center justify-center gap-1 transition-all"
        style={state}
      >
        {icon}
        {accent && (
          <span className="text-[10px] font-mono tracking-[0.18em] uppercase">
            {active ? 'Done' : 'Clip'}
          </span>
        )}
      </button>
      {/* Non-accent buttons get a tooltip on hover (Clip is self-labeled). */}
      <AnimatePresence>
        {!accent && hover && (
          <motion.div
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.12 }}
            className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] pointer-events-none whitespace-nowrap z-10"
          >
            <div
              className="px-2 py-0.5 rounded text-[10px] font-mono"
              style={{
                background: 'rgba(0, 0, 0, 0.92)',
                color: '#e4e4e7',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────
function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function hexToRgb(hex) {
  // Accepts #RGB or #RRGGBB; returns "r, g, b" as a string for rgba() templates.
  if (!hex) return '59, 130, 246';
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return '59, 130, 246';
  const r = (num >> 16) & 0xff;
  const g = (num >> 8)  & 0xff;
  const b =  num        & 0xff;
  return `${r}, ${g}, ${b}`;
}
