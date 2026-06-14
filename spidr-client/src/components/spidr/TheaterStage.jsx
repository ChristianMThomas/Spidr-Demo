import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tv, X, Flame, Skull, Heart, Laugh, Zap } from 'lucide-react';
import { getSocket } from '@/api/apiClient';

/**
 * TheaterStage — synchronized feed broadcast inside the Voice Matrix.
 *
 *   HOST   The user who flipped the "Sync Feed" toggle in VoiceChannel.
 *          Their scroll position is the source of truth; their engagement
 *          buttons stay live (likes / relays / comments still register).
 *          Scroll deltas are emitted over the socket as
 *          `theater:scroll`   { channelId, clipIndex, scrollY }
 *          (and via a window event for single-tab demos).
 *
 *   GUEST  Everyone else in the channel. They see the host's feed mounted
 *          here, but engagement buttons are visually locked behind a
 *          "HOST CONTROL" scrim. Ghost Reactions are their outlet — a row
 *          of emojis at the bottom that fires holographic bursts visible
 *          to everyone in the call without touching the actual post.
 *
 *   GHOST  Both host and guests can fire reactions. They emit
 *          REACTIONS  `theater:reaction`  { channelId, userId, emoji }
 *          The component listens and animates a burst from bottom-center.
 *
 * Multi-user sync caveat:
 *   The socket pipe wires in via getSocket() but the actual server-side
 *   relay (rebroadcasting `theater:scroll` to every other peer in the
 *   same channel room) needs server work. Until that's deployed, sync
 *   works inside one browser tab (via the window event), and the socket
 *   emit is a no-op the server has to bind to.
 */
export default function TheaterStage({
  channelId,
  isHost,
  hostUserId,
  hostUserName,
  currentUser,
  onStop,
  children, // host renders its actual feed component here; guests get a mirror
}) {
  const stageRef = useRef(null);
  const [reactions, setReactions] = useState([]); // { id, emoji, fromName }

  // ── Outbound scroll broadcast (host only) ───────────────────────────
  useEffect(() => {
    if (!isHost) return;
    const stage = stageRef.current;
    if (!stage) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return; // throttle to one emit per animation frame
      raf = requestAnimationFrame(() => {
        raf = 0;
        const detail = {
          channelId,
          scrollY: stage.scrollTop,
          scrollMax: stage.scrollHeight - stage.clientHeight,
        };
        // Local window event — single-tab sync, also a hook for any
        // other in-app guest viewer mounted in the same session.
        window.dispatchEvent(new CustomEvent('theater:scroll-local', { detail }));
        // Socket emit — multi-user sync. Server needs to forward this
        // event to every other socket in the same channel room.
        try { getSocket()?.emit?.('theater:scroll', detail); } catch {}
      });
    };
    stage.addEventListener('scroll', onScroll, { passive: true });
    return () => stage.removeEventListener('scroll', onScroll);
  }, [isHost, channelId]);

  // ── Inbound scroll application (guests only) ────────────────────────
  useEffect(() => {
    if (isHost) return;
    const apply = (e) => {
      const stage = stageRef.current;
      if (!stage || !e?.detail) return;
      if (e.detail.channelId !== channelId) return;
      // Smooth-scroll to the host's position. We don't animate via JS
      // because the browser's native smooth-scroll behaves better with
      // input events; we just set scrollTop and let CSS handle the rest.
      stage.scrollTop = e.detail.scrollY ?? 0;
    };
    window.addEventListener('theater:scroll-local', apply);
    let socket = null;
    try {
      socket = getSocket();
      socket?.on?.('theater:scroll', (detail) => apply({ detail }));
    } catch {}
    return () => {
      window.removeEventListener('theater:scroll-local', apply);
      try { socket?.off?.('theater:scroll'); } catch {}
    };
  }, [isHost, channelId]);

  // ── Ghost Reaction broadcast + receive ──────────────────────────────
  const fireReaction = useCallback((emoji) => {
    const detail = {
      channelId,
      userId: currentUser?.id,
      fromName: currentUser?.full_name || currentUser?.username || 'Someone',
      emoji,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    // Local burst — own reaction renders instantly
    pushReaction(detail);
    // Local window event so other panels in the same tab pick it up
    window.dispatchEvent(new CustomEvent('theater:reaction-local', { detail }));
    // Socket emit for multi-user
    try { getSocket()?.emit?.('theater:reaction', detail); } catch {}
  }, [channelId, currentUser]);

  const pushReaction = useCallback((detail) => {
    setReactions(rs => [...rs, detail]);
    // Auto-clean after the animation finishes (~3s)
    setTimeout(() => {
      setReactions(rs => rs.filter(r => r.id !== detail.id));
    }, 3000);
  }, []);

  useEffect(() => {
    const onLocal = (e) => {
      const detail = e?.detail;
      if (!detail || detail.channelId !== channelId) return;
      // Own reactions already rendered locally; skip rerender to avoid dupes
      if (detail.userId === currentUser?.id) return;
      pushReaction(detail);
    };
    window.addEventListener('theater:reaction-local', onLocal);

    let socket = null;
    try {
      socket = getSocket();
      socket?.on?.('theater:reaction', (detail) => {
        if (!detail || detail.channelId !== channelId) return;
        if (detail.userId === currentUser?.id) return;
        pushReaction(detail);
      });
    } catch {}
    return () => {
      window.removeEventListener('theater:reaction-local', onLocal);
      try { socket?.off?.('theater:reaction'); } catch {}
    };
  }, [channelId, currentUser?.id, pushReaction]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header — host banner + stop button */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.30)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.25)',
            }}
          >
            <Tv size={13} className="text-red-400" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-red-400 leading-none">Theater Mode</p>
            <p className="text-white text-xs font-bold leading-tight">
              {isHost ? 'You are broadcasting' : `Watching ${hostUserName || 'host'}'s feed`}
            </p>
          </div>
        </div>
        {isHost && (
          <button
            type="button"
            onClick={onStop}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <X size={11} /> Stop
          </button>
        )}
      </div>

      {/* Stage — phone-aspect column. The host renders their feed inside
          (children). Guests see a mirror but their scroll is driven by
          the inbound `theater:scroll` event, not user input. Native
          scroll on the host stays free. */}
      <div
        className="flex-1 min-h-0 flex justify-center items-stretch p-4 relative overflow-hidden"
        style={{ background: 'rgba(0, 0, 0, 0.40)' }}
      >
        <div
          ref={stageRef}
          className={`w-full max-w-[420px] h-full rounded-2xl overflow-hidden overflow-y-auto ${
            isHost ? '' : 'pointer-events-none'
          }`}
          style={{
            scrollBehavior: 'smooth',
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          }}
        >
          {children}
        </div>

        {/* Guest control lock — a soft overlay positioned over the engagement
            dock area on the right. Visually communicates that the buttons
            won't work for this user without obscuring the actual feed. */}
        {!isHost && (
          <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-6 z-20 flex flex-col items-center gap-1">
            <div
              className="px-2 py-1 rounded-md font-mono text-[8px] uppercase tracking-widest text-red-300"
              style={{
                background: 'rgba(0, 0, 0, 0.80)',
                border: '1px solid rgba(239, 68, 68, 0.40)',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.25)',
              }}
            >
              Host Control
            </div>
          </div>
        )}

        {/* Ghost Reactions burst layer — emojis float up from bottom-center
            and fade out. Stacks slightly horizontally so simultaneous
            reactions from different viewers don't pile on the same line. */}
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          <AnimatePresence>
            {reactions.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ y: 0, x: (i % 5 - 2) * 32, opacity: 0, scale: 0.6 }}
                animate={{ y: -260, opacity: 1, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2.8,
                  ease: [0.22, 1, 0.36, 1],
                  opacity: { duration: 2.8, times: [0, 0.15, 0.8, 1], values: [0, 1, 1, 0] },
                }}
                className="absolute left-1/2 bottom-20 -translate-x-1/2 text-4xl drop-shadow-[0_0_12px_rgba(239,68,68,0.50)]"
                aria-hidden
              >
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Ghost Reactions dock — host AND guests can fire these. Doesn't
          touch the actual post; just spits a holographic emoji into the
          shared overlay layer for everyone in the call to see. */}
      <div
        className="flex items-center justify-center gap-1.5 px-4 py-2 flex-shrink-0"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mr-2">
          Ghost react
        </span>
        {[
          { emoji: '🔥',  label: 'Fire',   Icon: Flame },
          { emoji: '💀',  label: 'Skull',  Icon: Skull },
          { emoji: '😂',  label: 'Laugh',  Icon: Laugh },
          { emoji: '❤️',  label: 'Heart',  Icon: Heart },
          { emoji: '⚡',  label: 'Zap',    Icon: Zap },
        ].map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            onClick={() => fireReaction(emoji)}
            title={`${label} reaction`}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
