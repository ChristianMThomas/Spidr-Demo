import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Tv, X, Lock, Loader2, Users } from 'lucide-react';
import { entities, getSocket } from '@/api/apiClient';

// Lazy on purpose. TheaterStage is imported eagerly by VoiceChannel (which
// is itself always mounted by the shell), and ClipFeed drags the whole video
// card, comments pane and engagement stack with it — that does not belong in
// the voice deck's chunk for a mode most calls never open.
const ClipFeed = React.lazy(() => import('@/components/feed/ClipFeed'));

/**
 * TheaterStage — synchronized THE WEB broadcast inside a voice channel.
 *
 *   HOST   The user who flipped the "Sync Feed" toggle in VoiceChannel.
 *          Their feed is live and fully interactive; every clip change is
 *          published to the room as `theater:sync { clipId, clipIndex }`.
 *
 *   GUEST  Everyone else in the call. They mount the same feed in mirror
 *          mode — no wheel, no swipe, no keyboard, no engagement buttons —
 *          pinned to whatever clip the host is on. Ghost Reactions are
 *          their outlet.
 *
 *   GHOST  Host and guests both fire `theater:reaction { emoji }`, which the
 *          server relays to the rest of the room and this component animates
 *          as a burst over the stage.
 *
 * Why clip IDs and not scroll position
 * ────────────────────────────────────
 * The previous version broadcast `scrollTop` from a wrapper div. That could
 * never have worked: ClipFeed is index-virtualised with `overflow-hidden`,
 * so it has no scroll height and fires no scroll events — the sync channel
 * was permanently silent. And even a working position sync would have been
 * wrong, because every viewer's feed is ordered independently (the algorithm
 * feed is personalised), so position N means a different video to different
 * people. The host now broadcasts the clip's ID. Guests look it up in their
 * own copy of the feed, and fetch that single clip directly if it isn't
 * there, so everybody is provably watching the same thing.
 *
 * Server contract (spidr-server/src/socket/handlers.js):
 *   theater:start          → host claims the stage
 *   theater:stop           → host releases it
 *   theater:sync           → host-only clip broadcast, relayed to the room
 *   theater:reaction       → any member, relayed to the rest of the room
 *   theater:request-state  → catch-up for a late joiner / reconnect
 *   theater:state          → server → client, current stage state or null
 * Every one of them is scoped server-side to the socket's own voice room.
 */

const GHOST_EMOJI = [
  { emoji: '🔥', label: 'Fire'  },
  { emoji: '💀', label: 'Skull' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '⚡', label: 'Zap'   },
];

export default function TheaterStage({
  channelId,
  isHost,
  hostUserId,
  hostUserName,
  hostAvatar = '',
  currentUser,
  viewerCount = 0,
  onStop,
}) {
  // Same cache key the rest of the app uses for THE WEB, so opening the
  // theater costs nothing when the feed is already warm.
  const { data: clips = [], isLoading } = useQuery({
    queryKey: ['clips'],
    queryFn: () => entities.Clip.list('-created_date', 50),
    staleTime: 30_000,
  });

  // Host position. ClipFeed stays uncontrolled for the host; this mirrors it
  // so we know what to publish.
  const [hostIndex, setHostIndex] = useState(0);
  // Guest view: the clip id the host is on, plus a direct-fetch fallback for
  // when that clip isn't in this viewer's own feed page.
  const [hostClipId, setHostClipId] = useState(null);
  const [fetchedClip, setFetchedClip] = useState(null);
  const [reactions, setReactions] = useState([]);

  // ── Host → room ────────────────────────────────────────────────────────
  // Publishing from an effect keyed on the resolved clip id covers both the
  // opening broadcast (once the feed query resolves) and every later move,
  // without a separate "send the first one" path.
  const hostClip = clips[Math.min(hostIndex, Math.max(0, clips.length - 1))] || null;
  const hostClipKey = hostClip?.id || null;
  useEffect(() => {
    if (!isHost || !hostClipKey) return;
    try {
      getSocket()?.emit?.('theater:sync', { clipId: hostClipKey, clipIndex: hostIndex });
    } catch { /* socket down — the stage still works locally */ }
  }, [isHost, hostClipKey, hostIndex]);

  // ── Room → guest ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isHost) return;
    let socket = null;
    const onSync  = (p) => { if (p?.clipId) setHostClipId(p.clipId); };
    const onState = (s) => { if (s?.clipId) setHostClipId(s.clipId); };
    try {
      socket = getSocket();
      socket?.on?.('theater:sync', onSync);
      socket?.on?.('theater:state', onState);
      // Catch up immediately — the host may have started broadcasting before
      // this viewer's stage mounted.
      socket?.emit?.('theater:request-state');
    } catch { /* no socket, nothing to mirror */ }
    return () => {
      try {
        socket?.off?.('theater:sync', onSync);
        socket?.off?.('theater:state', onState);
      } catch {}
    };
  }, [isHost]);

  // Where the host's clip sits in *this* viewer's feed, if at all.
  const guestIndex = useMemo(() => {
    if (!hostClipId) return -1;
    return clips.findIndex(c => c.id === hostClipId);
  }, [clips, hostClipId]);

  // Host is on something outside this viewer's feed page — pull that one clip
  // so the mirror shows the right video instead of going blank.
  useEffect(() => {
    if (isHost || !hostClipId || guestIndex >= 0) { setFetchedClip(null); return; }
    let cancelled = false;
    entities.Clip.get(hostClipId)
      .then(c => { if (!cancelled && c?.id) setFetchedClip(c); })
      .catch(() => { if (!cancelled) setFetchedClip(null); });
    return () => { cancelled = true; };
  }, [isHost, hostClipId, guestIndex]);

  // ── Ghost reactions ────────────────────────────────────────────────────
  const pushReaction = useCallback((detail) => {
    // Lane is frozen at push time. Deriving it from array position (as the
    // old build did) made live emojis jump sideways whenever an older one
    // expired out of the list.
    const withLane = { ...detail, lane: (Math.random() * 2 - 1) * 64 };
    setReactions(rs => [...rs.slice(-24), withLane]);
    setTimeout(() => setReactions(rs => rs.filter(r => r.id !== withLane.id)), 3000);
  }, []);

  const fireReaction = useCallback((emoji) => {
    const detail = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: currentUser?.id,
      emoji,
    };
    pushReaction(detail); // own burst renders instantly, no round trip
    try { getSocket()?.emit?.('theater:reaction', { emoji, id: detail.id }); } catch {}
  }, [currentUser?.id, pushReaction]);

  useEffect(() => {
    let socket = null;
    const onReaction = (detail) => {
      if (!detail?.emoji) return;
      if (detail.userId && detail.userId === currentUser?.id) return; // already drawn
      pushReaction(detail);
    };
    try {
      socket = getSocket();
      socket?.on?.('theater:reaction', onReaction);
    } catch {}
    return () => { try { socket?.off?.('theater:reaction', onReaction); } catch {} };
  }, [currentUser?.id, pushReaction]);

  // ── What the stage actually renders ────────────────────────────────────
  const feedClips = isHost
    ? clips
    : (guestIndex >= 0 ? clips : (fetchedClip ? [fetchedClip] : []));
  // `undefined` leaves ClipFeed uncontrolled, which is what the host wants.
  const feedIndex = isHost ? undefined : (guestIndex >= 0 ? guestIndex : 0);
  const waitingForHost = !isHost && !feedClips.length;

  return (
    // min-h-0 so the stage can shrink inside a flex column, plus an explicit
    // floor so a parent that forgets to stretch us can't collapse it to zero
    // height — which is exactly how this shipped: a header glued to a button
    // row with nothing in between.
    <div
      className="relative w-full h-full min-h-[360px] flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(180deg, rgba(12,6,6,0.92) 0%, rgba(6,2,2,0.96) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.18)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(239,68,68,0.10), rgba(0,0,0,0))',
          borderBottom: '1px solid rgba(239, 68, 68, 0.22)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Host identity. An avatar reads as "a person is broadcasting"
              far faster than the generic TV glyph did. */}
          <div className="relative flex-shrink-0">
            {hostAvatar ? (
              <img
                src={hostAvatar}
                alt=""
                className="w-8 h-8 rounded-lg object-cover"
                style={{ border: '1px solid rgba(239,68,68,0.45)' }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.45)' }}
              >
                <Tv size={14} className="text-red-400" />
              </div>
            )}
            <motion.span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500"
              style={{ border: '2px solid #0a0505' }}
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-red-400 leading-none">
                Live
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-600 leading-none">
                Sync Feed
              </span>
            </div>
            <p className="text-white text-xs font-bold leading-tight truncate mt-0.5">
              {isHost ? 'You are broadcasting THE WEB' : `${hostUserName || 'Host'} is broadcasting`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {viewerCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.07]">
              <Users size={11} className="text-zinc-500" />
              <span className="text-[10px] font-mono font-bold text-zinc-400 tabular-nums">{viewerCount}</span>
            </div>
          )}
          {isHost ? (
            <button
              type="button"
              onClick={onStop}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-red-200 hover:text-white bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 flex items-center gap-1.5 transition-colors"
            >
              <X size={11} /> Stop
            </button>
          ) : (
            // The old build floated a "HOST CONTROL" tag in the middle of the
            // video. This says the same thing, where chrome belongs.
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              <Lock size={10} className="text-zinc-500" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                Watching
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stage ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative flex justify-center px-3 py-3">
        <div className="w-full max-w-[460px] h-full min-h-0 relative">
          {isLoading ? (
            <StageMessage icon={<Loader2 className="w-6 h-6 text-red-500 animate-spin" />} title="Weaving the feed" />
          ) : waitingForHost ? (
            <StageMessage
              icon={<Loader2 className="w-6 h-6 text-red-500 animate-spin" />}
              title={`Waiting for ${hostUserName || 'the host'}`}
              sub="Their first strand will appear here."
            />
          ) : !feedClips.length ? (
            <StageMessage
              icon={<Tv className="w-7 h-7 text-red-400" />}
              title="THE WEB is empty"
              sub="No strands to broadcast yet."
            />
          ) : (
            <React.Suspense
              fallback={<StageMessage icon={<Loader2 className="w-6 h-6 text-red-500 animate-spin" />} title="Weaving the feed" />}
            >
              <ClipFeed
                clips={feedClips}
                currentUser={currentUser}
                audioMap={{}}
                index={feedIndex}
                onIndexChange={isHost ? (i) => setHostIndex(i) : undefined}
                interactive={isHost}
                // Beats any FeedPanel still mounted behind the call deck, so
                // one arrow key doesn't scrub two feeds at once.
                keyboardPriority={isHost ? 10 : 0}
                showChrome={isHost}
              />
            </React.Suspense>
          )}
        </div>

        {/* Ghost reaction burst layer */}
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          <AnimatePresence>
            {reactions.map((r) => (
              <motion.div
                key={r.id}
                initial={{ y: 0, x: r.lane, opacity: 0, scale: 0.5 }}
                // Keyframed opacity/scale on `animate`. The previous version
                // put `times`/`values` inside `transition.opacity`, which
                // framer-motion ignores — the emojis faded in and then
                // vanished on unmount instead of drifting out.
                animate={{
                  y: -240,
                  x: r.lane,
                  opacity: [0, 1, 1, 0],
                  scale: [0.5, 1.2, 1, 0.9],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2.6,
                  ease: 'easeOut',
                  opacity: { duration: 2.6, times: [0, 0.12, 0.7, 1] },
                  scale:   { duration: 2.6, times: [0, 0.18, 0.45, 1] },
                }}
                className="absolute left-1/2 bottom-6 -translate-x-1/2 text-4xl drop-shadow-[0_0_14px_rgba(239,68,68,0.55)]"
                aria-hidden
              >
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Ghost reaction dock ──────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-1.5 px-4 py-2 flex-shrink-0"
        style={{
          background: 'rgba(0, 0, 0, 0.45)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mr-2 hidden sm:inline">
          Ghost react
        </span>
        {GHOST_EMOJI.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            onClick={() => fireReaction(emoji)}
            title={`${label} reaction`}
            aria-label={`${label} reaction`}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all hover:scale-110 hover:bg-white/[0.08] active:scale-95 bg-white/[0.03] border border-white/[0.07]"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function StageMessage({ icon, title, sub }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-8">
      {icon}
      <div>
        <p className="text-white text-sm font-bold">{title}</p>
        {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}
