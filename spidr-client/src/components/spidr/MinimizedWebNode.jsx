import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { Mic, MicOff, Headphones, PhoneOff, Maximize2, Circle } from 'lucide-react';
import { auth, entities } from '@/api/apiClient';

/**
 * MinimizedWebNode — Micro-Tactical HUD (minimized voice overlay).
 *
 * Base state: a tiny draggable glass pill showing only the active-speaker
 * avatar (with a pulsing voice ring) + the user's self-mute status. No text.
 * Fades to 30% after 3s of silence/no-hover ("ghost mode"); snaps to 100% on
 * hover or when someone speaks. Hovering (or Ctrl+`) expands a tactical dock
 * with the real controls (mute / deafen / volume / record / expand / leave).
 *
 * Preserves the shell contract: props { call, apexColor, speaking, onExpand,
 * onEnd } and dispatches spidr-call-mute-toggle / spidr-call-deafen-toggle.
 */
export default function MinimizedWebNode({
  call = {}, apexColor = '#3f3f46', speaking = false,
  onExpand, onEnd,
}) {
  const [myAvatar, setMyAvatar] = useState(null);
  const [fetchedColor, setFetchedColor] = useState(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [volume, setVolume] = useState(80);
  const [recording, setRecording] = useState(false);

  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ghost, setGhost] = useState(false); // faded (no activity)

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const silenceTimer = useRef(null);

  // Resolve colors + current-user avatar.
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

  const resolved = fetchedColor || apexColor;
  const ring = resolved && resolved !== '#3f3f46' ? resolved : '#FF3333';
  const participants = (call.participants || []).slice(0, 8);
  // Active speaker avatar: whoever is speaking, else first participant, else me.
  const activeSpeaker = participants.find(p => p.speaking) || participants[0];
  const avatar = activeSpeaker?.avatar || myAvatar;

  // Ghost-fade: drop to 30% after 3s without hover / speaking.
  useEffect(() => {
    const active = hovered || expanded || speaking;
    if (active) {
      setGhost(false);
      if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    } else {
      silenceTimer.current = setTimeout(() => setGhost(true), 3000);
    }
    return () => { if (silenceTimer.current) clearTimeout(silenceTimer.current); };
  }, [hovered, expanded, speaking]);

  // Ctrl+` toggles the tactical dock.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === '`' || e.key === '~')) { e.preventDefault(); setExpanded(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleMute = useCallback((e) => {
    e?.stopPropagation();
    setMuted(m => {
      const next = !m;
      window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: next } }));
      return next;
    });
  }, []);

  const toggleDeafen = useCallback((e) => {
    e?.stopPropagation();
    setDeafened(d => {
      const next = !d;
      if (next && !muted) { setMuted(true); window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: true } })); }
      window.dispatchEvent(new CustomEvent('spidr-call-deafen-toggle', { detail: { deafened: next } }));
      return next;
    });
  }, [muted]);

  const handleEnd = (e) => { e?.stopPropagation(); window.dispatchEvent(new Event('spidr-call-disconnect')); onEnd?.(); };
  const handleExpandDeck = (e) => { e?.stopPropagation(); onExpand?.(); };
  const toggleRecord = (e) => { e?.stopPropagation(); setRecording(r => !r); };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={{
        left: -(window.innerWidth - 220), right: 20,
        top: -(window.innerHeight - 160), bottom: 20,
      }}
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: ghost ? 0.3 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, opacity: { duration: 0.4 } }}
      onHoverStart={() => { setHovered(true); setExpanded(true); }}
      onHoverEnd={() => { setHovered(false); setExpanded(false); }}
      className="fixed top-4 right-4 z-[120] flex flex-col items-stretch cursor-grab active:cursor-grabbing pointer-events-auto"
    >
      {/* ── Micro-Pill (base state) ── */}
      <div className="h-10 w-auto rounded-full px-2 py-1 flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
        {/* Active-speaker avatar with pulsing voice ring */}
        <div className="relative w-6 h-6 shrink-0">
          <motion.div
            className="absolute -inset-[3px] rounded-full"
            style={{ border: `2px solid ${ring}` }}
            animate={speaking ? { opacity: [0.4, 1, 0.4], scale: [1, 1.12, 1] } : { opacity: 0.5, scale: 1 }}
            transition={speaking ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          />
          <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" />
              : <Mic size={11} className="text-zinc-400" />}
          </div>
        </div>
        {/* Self-mute status — just outside the avatar */}
        <span className={`shrink-0 ${muted ? 'text-red-500' : 'text-zinc-500'}`}>
          {muted ? <MicOff size={13} /> : <Mic size={13} />}
        </span>
        {/* Participant count dot (still text-free) */}
        {participants.length > 1 && (
          <span className="shrink-0 text-[10px] font-mono text-zinc-500 pr-1">{participants.length}</span>
        )}
      </div>

      {/* ── Tactical Dock (hover / Ctrl+` reveal) ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="mt-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden"
          >
            <div className="p-2 flex flex-col gap-2 min-w-[180px]">
              <div className="flex items-center gap-1.5">
                <DockBtn active={muted} activeClass="bg-red-500/20 text-red-400 border-red-500/40" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                  {muted ? <MicOff size={14} /> : <Mic size={14} />}
                </DockBtn>
                <DockBtn active={deafened} activeClass="bg-red-500/20 text-red-400 border-red-500/40" onClick={toggleDeafen} title={deafened ? 'Undeafen' : 'Deafen'}>
                  <Headphones size={14} />
                </DockBtn>
                <DockBtn onClick={handleExpandDeck} title="Expand call">
                  <Maximize2 size={14} />
                </DockBtn>
                <DockBtn active activeClass="bg-red-600 text-white border-red-500" onClick={handleEnd} title="Leave call">
                  <PhoneOff size={14} />
                </DockBtn>
              </div>
              {/* Volume slider */}
              <input
                type="range" min={0} max={100} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 accent-red-500 cursor-pointer"
              />
              {/* Record node */}
              <button
                onClick={toggleRecord}
                className={`w-full rounded-md border font-mono text-[10px] tracking-widest uppercase py-1.5 transition-all ${
                  recording ? 'bg-red-500 text-white border-red-500' : 'bg-red-600/10 border-red-500/40 text-red-500 hover:bg-red-500 hover:text-white'
                }`}
              >
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

function DockBtn({ children, onClick, title, active, activeClass = '' }) {
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
