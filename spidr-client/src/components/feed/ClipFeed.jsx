import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Volume2, VolumeX, Play,
  Bookmark, Sparkles, Send, Users, Lock,
  Maximize2, Minimize2, RotateCw, Repeat2, Plus, Check, X,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import './ClipFeed.css';
import { entities, algorithm, follows as followsApi } from '@/api/apiClient';
import { toast } from 'sonner';
import RichComments from '@/components/spidr/RichComments';
import EmojiPicker from '@/components/spidr/EmojiPicker';
import ShareWeb from '@/components/spidr/ShareWeb';
import { useMenu } from '@/components/MenuContext';
import DataDisc from '@/components/feed/DataDisc';
import { isTrending, tensionScore } from '@/lib/tensionScore';

// ── Local relay store ──────────────────────────────────────────────────────
// The server's `Clip.update({ relays: [...] })` call is best-effort: if the
// backend schema doesn't recognize `relays` (which was the case at the time
// the Signal Relay feature was built), the field gets silently dropped and
// the next refetch reverts the UI to "not relayed". To make the gesture
// feel instant AND survive reloads regardless of backend support, we keep
// a localStorage-backed set of clip IDs the current user has relayed.
//
//   • localRelaySet     — module-level Set, the source of truth for the UI
//   • setLocalRelay(id) — toggles a clip, persists to localStorage, and
//                         fires a window event so every mounted ClipCard
//                         re-derives its hasRelayed/count
//   • localRelaySet has(id) is OR'd with clip.relays?.includes(userId) so
//     server-side relays still count if the backend ever starts honoring
//     the field — we end up eventually-consistent rather than client-only.
const LOCAL_RELAY_KEY = 'spidr_my_relays';

// ── View de-dupe ───────────────────────────────────────────────────────────
// A clip should count ONE view per session no matter how many times the user
// scrolls back to it (TikTok behaves the same — repeat views in one sitting
// don't keep inflating the number). Module-level so it persists across card
// mount/unmount as you scroll the virtualized triplet.
const viewedClips = new Set();

const localRelaySet = (() => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_RELAY_KEY) : null;
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
})();
function persistLocalRelays() {
  try { localStorage.setItem(LOCAL_RELAY_KEY, JSON.stringify([...localRelaySet])); } catch {}
}
function setLocalRelay(clipId, on) {
  if (on) localRelaySet.add(clipId); else localRelaySet.delete(clipId);
  persistLocalRelays();
  try {
    window.dispatchEvent(new CustomEvent('spidr-relay-changed', { detail: { clipId, on } }));
  } catch {}
}
import { useViewportMedia } from '@/hooks/useViewportMedia';
import AudioGraftNode from '@/components/feed/AudioGraftNode';
import ScrollingAudioBanner from '@/components/feed/ScrollingAudioBanner';
import FrequencyArchive from '@/components/feed/FrequencyArchive';

/**
 * ClipFeed — TikTok-style vertical infinite video feed.
 *
 * Architecture:
 *
 *  ┌─ scrollContainer (CSS scroll-snap-y mandatory) ─┐
 *  │                                                  │
 *  │  ╔═════════════════════════════════════╗         │
 *  │  ║       slot 0 — clip[idx - 1]        ║         │
 *  │  ║       (preload only, paused)        ║         │
 *  │  ╚═════════════════════════════════════╝         │
 *  │  ╔═════════════════════════════════════╗ ← snap  │
 *  │  ║       slot 1 — clip[idx]            ║         │
 *  │  ║       (playing, visible)            ║         │
 *  │  ╚═════════════════════════════════════╝         │
 *  │  ╔═════════════════════════════════════╗         │
 *  │  ║       slot 2 — clip[idx + 1]        ║         │
 *  │  ║       (preload only, paused)        ║         │
 *  │  ╚═════════════════════════════════════╝         │
 *  └──────────────────────────────────────────────────┘
 *
 * Only 3 cards are mounted at any time. As the user scrolls, the slots
 * rotate (prev becomes current, current becomes next, etc.) and we keep
 * a stable `idx` pointing at the "current" clip. The scrollTop is always
 * 100vh — we recenter after each settle so the user has somewhere to
 * scroll up from and somewhere to scroll down to.
 *
 * This is the same pattern TikTok and Instagram Reels use. It bounds memory
 * usage at 3 video elements regardless of feed length, eliminates the
 * load-on-swipe stutter, and keeps scrolling buttery.
 *
 * Watch-time tracking, engagement scoring, like/share/comment/save all live
 * inside ClipCard. The parent only manages position.
 */

// Every mounted, interactive ClipFeed registers here. The keydown handler
// only acts for the highest-priority entry, so two feeds mounted at once
// (Theater Mode over a backgrounded FeedPanel) don't both consume arrow keys.
const KEYBOARD_FEEDS = new Set();

export default function ClipFeed({
  clips,
  currentUser,
  onEditClip,
  feedPersonalized,
  audioMap,
  initialClipId,
  onOpenProfile,   // (user) => open their WEB profile in-feed
  // ── Externally-driven mode (Theater Mode) ──────────────────────────────
  // All four are optional and every default reproduces the standalone
  // FeedPanel behaviour exactly, so existing call sites are untouched.
  //   index             controlled clip position. When it's a finite number
  //                     the feed stops owning its own index and simply
  //                     renders whatever the parent points at.
  //   onIndexChange     (nextIndex, clip) fired whenever navigation happens,
  //                     controlled or not. This is what the theater host
  //                     broadcasts from.
  //   interactive       false disables wheel / swipe / keyboard / dot-jump
  //                     and drops the feed into read-only mirror mode.
  //   keyboardPriority  only the highest-priority mounted feed answers arrow
  //                     keys, so an open theater doesn't scrub the FeedPanel
  //                     sitting behind it at the same time.
  index,
  onIndexChange,
  interactive = true,
  keyboardPriority = 0,
  showChrome = true,    // top "THE WEB // n / m" label + side dot rail
}) {
  const [localIdx, setLocalIdx] = useState(() => {
    if (!initialClipId) return 0;
    const i = clips.findIndex(c => c.id === initialClipId);
    return i >= 0 ? i : 0;
  });
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const containerRef = useRef(null);
  const isSnappingRef = useRef(false);
  const lastSnapTimeRef = useRef(0);

  // Controlled vs uncontrolled. `idx` is always the clamped truth for render.
  const controlled = Number.isFinite(index);
  const idx = clips.length === 0
    ? 0
    : Math.max(0, Math.min(clips.length - 1, controlled ? index : localIdx));

  // Ref mirror so advance()/commitIdx() can read the current position without
  // re-creating themselves on every index change.
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  // The single place the index moves. Side effects (onIndexChange) fire here
  // rather than inside a setState updater, which React would double-invoke.
  const commitIdx = useCallback((next) => {
    if (!clips.length) return;
    const clamped = Math.max(0, Math.min(clips.length - 1, next));
    if (clamped === idxRef.current) return;
    if (!controlled) setLocalIdx(clamped);
    onIndexChangeRef.current?.(clamped, clips[clamped]);
  }, [clips, controlled]);

  // Clamp idx if clips list shrinks (uncontrolled only — when a parent owns
  // the index, clamping is its job and writing here would fight it).
  useEffect(() => {
    if (controlled) return;
    if (localIdx >= clips.length) setLocalIdx(Math.max(0, clips.length - 1));
  }, [clips.length, localIdx, controlled]);

  // Determine which 3 clips are mounted at the moment.
  // For idx=0 we show [null, clips[0], clips[1]].
  // For idx=N-1 we show [clips[N-2], clips[N-1], null].
  const triplet = useMemo(() => {
    const prev = idx > 0 ? clips[idx - 1] : null;
    const curr = clips[idx] || null;
    const next = idx < clips.length - 1 ? clips[idx + 1] : null;
    return [prev, curr, next];
  }, [clips, idx]);

  // ── Scroll handler ─────────────────────────────────────────────────────────
  // Wheel events drive index changes directly (works on desktop). Touch swipes
  // and pointer drags trigger native scroll which we observe via scrollTop.
  const advance = useCallback((delta) => {
    if (!interactive) return;
    if (isSnappingRef.current) return;
    const now = Date.now();
    if (now - lastSnapTimeRef.current < 220) return; // throttle
    lastSnapTimeRef.current = now;
    commitIdx(idxRef.current + delta);
  }, [commitIdx, interactive]);

  const onWheel = useCallback((e) => {
    if (!interactive) return;
    // Threshold of 25 prevents trackpad inertia from triggering many advances
    if (Math.abs(e.deltaY) < 25) return;
    e.preventDefault();
    advance(e.deltaY > 0 ? 1 : -1);
  }, [advance, interactive]);

  // Keyboard navigation — accessibility.
  // Only the highest-priority mounted feed responds. Without this, opening
  // Theater Mode over a mounted FeedPanel meant one arrow-key press advanced
  // both feeds at once.
  useEffect(() => {
    if (!interactive) return;
    const entry = { priority: keyboardPriority, advance };
    KEYBOARD_FEEDS.add(entry);
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.target.isContentEditable) return;
      // Highest priority wins; ties go to the most recently mounted feed.
      let top = null;
      for (const f of KEYBOARD_FEEDS) {
        if (!top || f.priority >= top.priority) top = f;
      }
      if (top !== entry) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault();
        advance(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
        e.preventDefault();
        advance(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      KEYBOARD_FEEDS.delete(entry);
      window.removeEventListener('keydown', handler);
    };
  }, [advance, interactive, keyboardPriority]);

  // ── Touch / pointer swipe (mobile) ─────────────────────────────────────────
  const touchStartY = useRef(null);
  const onTouchStart = (e) => {
    if (!interactive) return;
    touchStartY.current = e.touches[0]?.clientY;
  };
  const onTouchEnd = (e) => {
    if (!interactive) return;
    if (touchStartY.current == null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const delta = touchStartY.current - endY;
    if (Math.abs(delta) > 50) {
      advance(delta > 0 ? 1 : -1);
    }
    touchStartY.current = null;
  };

  if (clips.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Nothing in the feed yet. Be the first to post!
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center relative overflow-hidden bg-black"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top label */}
      {showChrome && (
        <div className="absolute top-3 inset-x-0 text-center z-10 pointer-events-none">
          <span className="text-[10px] font-black tracking-widest text-red-600/40 uppercase">
            {feedPersonalized ? '⚡ YOUR WEB' : 'THE WEB'} // {idx + 1} / {clips.length}
          </span>
        </div>
      )}

      {/* Three-slot virtualized stack — the active slot is centered, the
          prev slot is translated up and the next slot is translated down.
          Animations on slot transitions handle the "snap" feel. */}
      <div className="relative w-full h-full flex items-center justify-center">
        {triplet.map((clip, slotIndex) => {
          // slotIndex: 0=prev, 1=current, 2=next
          if (!clip) return null;
          const isCurrent = slotIndex === 1;
          // Offsets: prev shows offscreen above (-100vh), current shows centered (0), next shows offscreen below (+100vh)
          // motion handles the transition between these.
          const yOffset = (slotIndex - 1) * 100;
          return (
            <motion.div
              key={clip.id}
              initial={false}
              animate={{ y: `${yOffset}%`, opacity: isCurrent ? 1 : 0.0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.6 }}
              onAnimationStart={() => { isSnappingRef.current = true; }}
              onAnimationComplete={() => { isSnappingRef.current = false; }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ willChange: 'transform' }}
            >
              {/* In mirror mode the active card stays inert too — guests
                  watch the host's clip, they don't like/relay/comment on it
                  from inside the theater. */}
              <div className={`clip-slot-content ${isCurrent && interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <ClipCard
                  clip={clip}
                  isActive={isCurrent}
                  currentUser={currentUser}
                  onEditClip={onEditClip}
                  onOpenProfile={onOpenProfile}
                  muted={muted}
                  setMuted={setMuted}
                  vol={vol}
                  setVol={setVol}
                  audioMap={audioMap}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Side dots — keeps the user oriented in the feed */}
      {showChrome && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-20">
          {clips.slice(Math.max(0, idx - 3), idx + 4).map((_, i) => {
            const ai = Math.max(0, idx - 3) + i;
            return (
              <button
                key={ai}
                disabled={!interactive}
                onClick={() => commitIdx(ai)}
                className={`w-1 rounded-full transition-all ${
                  ai === idx ? 'h-6 bg-red-500' : 'h-1.5 bg-zinc-600 hover:bg-red-400'
                } ${interactive ? '' : 'cursor-default'}`}
                aria-label={`Jump to clip ${ai + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ClipCard ────────────────────────────────────────────────────────────────
/**
 * A single video card with all engagement UI. Mounted by ClipFeed's 3-slot
 * virtualization. Only the active card auto-plays; the prev/next cards are
 * mounted (preloading metadata) but paused.
 */
function ClipCard({
  clip, isActive, currentUser, onEditClip, onOpenProfile,
  muted, setMuted, vol, setVol, audioMap,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [comments, setComments] = useState(false);
  const [shareMenu, setShareMenu] = useState(false);
  const [shareWeb, setShareWeb] = useState(false);
  const [showVol, setShowVol] = useState(false);
  const volLeaveTimer = useRef(null);
  const [freqAudio, setFreqAudio] = useState(null);
  const [striking, setStriking] = useState(false);
  const [encrypting, setEncrypting] = useState(false);

  // Theater / expand state (desktop). When true the card scales to ~80vh
  // tall so wide-aspect clips get room to breathe. Action rail follows the
  // card's right edge naturally because it's already absolute-positioned.
  // Escape collapses.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Orientation tracking — drives the mobile pseudo-fullscreen experience.
  // When a user holding a phone vertically encounters a wide clip, we show a
  // "rotate to watch" hint; when they actually rotate to landscape, we
  // promote the card to position:fixed inset:0 so the video fills the
  // screen edge-to-edge. We bound this to small viewports so a desktop
  // monitor in its natural landscape orientation doesn't constantly
  // pseudo-fullscreen wide clips.
  const [orientation, setOrientation] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
      ? 'landscape' : 'portrait'
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e) => setOrientation(e.matches ? 'landscape' : 'portrait');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const queryClient = useQueryClient();
  const menu = useMenu();
  const navigate = useNavigate();
  const hasLiked = clip.likes?.includes(currentUser?.id);

  // ── Relay state (client-first, server best-effort) ─────────────────────
  // The button flips on the local store immediately; the server call is
  // fire-and-forget. Reads OR (local store) | (server's `clip.relays`),
  // so a relay sticks even if the backend doesn't persist the field.
  const [localRelayed, setLocalRelayed] = useState(() => localRelaySet.has(clip.id));
  useEffect(() => {
    const onChange = (e) => {
      if (e?.detail?.clipId === clip.id) setLocalRelayed(!!e.detail.on);
    };
    window.addEventListener('spidr-relay-changed', onChange);
    return () => window.removeEventListener('spidr-relay-changed', onChange);
  }, [clip.id]);
  // Re-sync local state when the clip prop changes (navigating to a clip
  // that we already have in the local store).
  useEffect(() => {
    setLocalRelayed(localRelaySet.has(clip.id));
  }, [clip.id]);

  const serverHasRelayed = clip.relays?.includes(currentUser?.id);
  const hasRelayed = localRelayed || !!serverHasRelayed;
  // Count: server's saved count + 1 if we relayed locally but the server
  // doesn't yet know about us (avoids double-counting once it catches up).
  const relayCount = (clip.relays?.length || 0) + (localRelayed && !serverHasRelayed ? 1 : 0);
  // The Pulse (Patch 2.11): trending clips breathe + glow.
  const trending = isTrending(clip);

  // Handle web_post right-click actions for this clip.
  React.useEffect(() => {
    const handler = (e) => {
      const { action, data, type } = e.detail || {};
      if (type !== 'web_post' || data?.id !== clip.id) return;
      if (action === 'copy-link') {
        navigator.clipboard?.writeText(`${window.location.origin}/feed?clip=${clip.id}`).catch(() => {});
        toast.success('Link copied!');
      } else if (action === 'sling') {
        setShareWeb(true);
      } else if (action === 'save' || action === 'encrypt') {
        saveMut.mutate(null);
        if (action === 'encrypt') {
          setEncrypting(true);
          setTimeout(() => setEncrypting(false), 1400);
        }
      } else if (action === 'web-strike') {
        // APEX Web-Strike: slam a reaction + shake the card.
        setStriking(true);
        try { navigator.vibrate?.(80); } catch {}
        setTimeout(() => setStriking(false), 600);
        toast.success('⚡ Web-Strike landed!');
      } else if (action === 'overclock') {
        // APEX Overclock: boost the post's algorithm weight for 1 hour.
        entities.Clip.update(clip.id, { overclock_until: new Date(Date.now() + 3600_000).toISOString() })
          .then(() => { queryClient.invalidateQueries({ queryKey: ['clips'] }); toast.success('Post overclocked for 1 hour 🔥'); })
          .catch(() => toast.error('Overclock failed'));
      } else if (action === 'save-to-collection') {
        setCollectionPickerOpen(true);
      } else if (action === 'relay') {
        if (!relayMut.isPending) relayMut.mutate();
      } else if (action === 'profile' && data.author_id) {
        window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: data.author_id } }));
      } else if (action === 'report') {
        toast.success('Post reported to moderators');
      } else if (action === 'delete-post' && data.is_own) {
        if (confirm('Delete this post permanently?')) {
          entities.Clip.delete(clip.id)
            .then(() => { queryClient.invalidateQueries({ queryKey: ['clips'] }); toast.success('Post deleted'); })
            .catch(() => toast.error('Could not delete post'));
        }
      }
    };
    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = clip?.aspect_ratio || '9:16';
  const aspectCss = ratio === '16:9' ? '16/9' : ratio === '1:1' ? '1/1' : '9/16';
  // When a clip carries crop_data (from the Spidr Studio cropper) and there's
  // no server-side transcode, honor the crop on playback: scale + translate the
  // video so the cropped region fills the frame. Needs the natural video size.
  const [natSize, setNatSize] = useState(null);
  const cropStyle = React.useMemo(() => {
    const cd = clip?.crop_data;
    if (!cd || !natSize?.width || !cd.width || !cd.height) return undefined;
    // Scale so the crop region maps to the full frame, then shift to the crop
    // origin. transform-origin top-left keeps the math simple.
    const scaleX = natSize.width / cd.width;
    const scaleY = natSize.height / cd.height;
    const scale = Math.max(scaleX, scaleY);
    const tx = -(cd.x / natSize.width) * 100;
    const ty = -(cd.y / natSize.height) * 100;
    return {
      transformOrigin: 'top left',
      transform: `translate(${tx}%, ${ty}%) scale(${scale})`,
    };
  }, [clip?.crop_data, natSize]);

  // ── Play/pause based on isActive ──────────────────────────────────────────
  // Inactive cards are preloaded but never play. Active card plays unless
  // the user has explicitly paused it.
  const [userPaused, setUserPaused] = useState(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !userPaused) {
      v.play().then(() => setPlaying(true)).catch(() => { /* autoplay blocked */ });
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [isActive, userPaused]);

  // ── Register a view ───────────────────────────────────────────────────────
  // When a card becomes active (it's the one on screen), count a view exactly
  // once per session via the atomic server endpoint. Optimistically bump the
  // local count so the telemetry HUD ticks up immediately; the cache refetch
  // later reconciles to the server truth. (Before this, clip.views was rendered
  // but never written, so it sat frozen at 0 — the "views don't update" bug.)
  useEffect(() => {
    if (!isActive || !clip?.id) return;
    if (viewedClips.has(clip.id)) return;
    viewedClips.add(clip.id);
    // Reflect immediately in the cached list so the HUD updates without a wait.
    try {
      queryClient.setQueriesData({ queryKey: ['clips'] }, (old) =>
        Array.isArray(old)
          ? old.map(c => c.id === clip.id ? { ...c, views: (c.views || 0) + 1 } : c)
          : old
      );
    } catch {}
    entities.Clip.registerView(clip.id).catch(() => {
      // On failure, let it be re-tried next session.
      viewedClips.delete(clip.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, clip?.id]);

  // Reset to start when a card becomes active again; collapse comments when leaving
  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = 0;
      setProgress(0);
      setUserPaused(false);
    } else if (!isActive) {
      setComments(false);
    }
  }, [isActive]);

  // Apply volume changes
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = muted ? 0 : vol;
  }, [muted, vol]);

  // ── Watch-time tracking ──────────────────────────────────────────────────
  // Accumulate while active, emit when becoming inactive (or unmount).
  const watchStartRef = useRef(null);
  const totalWatchedRef = useRef(0);
  const loopsRef = useRef(0);

  useEffect(() => {
    if (isActive) {
      watchStartRef.current = Date.now();
    } else if (watchStartRef.current) {
      totalWatchedRef.current += (Date.now() - watchStartRef.current) / 1000;
      watchStartRef.current = null;
      if (clip?.id && totalWatchedRef.current > 0.5) {
        const dur = Math.round(videoRef.current?.duration || 0);
        algorithm.trackEngagement({
          clipId: clip.id,
          watchTimeSeconds: Math.round(totalWatchedRef.current),
          totalDuration: dur,
          liked: hasLiked,
          looped: loopsRef.current > 0,
          shared: false,
          commented: comments,
        }).catch(() => {});
      }
      totalWatchedRef.current = 0;
      loopsRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Final flush on unmount (e.g., navigating away from the feed)
  useEffect(() => {
    return () => {
      if (watchStartRef.current) {
        totalWatchedRef.current += (Date.now() - watchStartRef.current) / 1000;
        if (clip?.id && totalWatchedRef.current > 0.5) {
          const dur = Math.round(videoRef.current?.duration || 0);
          algorithm.trackEngagement({
            clipId: clip.id,
            watchTimeSeconds: Math.round(totalWatchedRef.current),
            totalDuration: dur,
            liked: hasLiked,
            looped: loopsRef.current > 0,
            shared: false,
            commented: false,
          }).catch(() => {});
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Video element events ─────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => { if (v.duration) setProgress((v.currentTime / v.duration) * 100); };
    const onWait = () => setBuffering(true);
    const onPlay = () => setBuffering(false);
    const onLoaded = () => setBuffering(false);
    const onEnded = () => {
      loopsRef.current += 1;
      v.currentTime = 0;
      v.play().catch(() => {});
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('waiting', onWait);
    v.addEventListener('playing', onPlay);
    v.addEventListener('loadeddata', onLoaded);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('waiting', onWait);
      v.removeEventListener('playing', onPlay);
      v.removeEventListener('loadeddata', onLoaded);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  // ── Engagement mutations ────────────────────────────────────────────────
  const likeMut = useMutation({
    mutationFn: async () => {
      const likes = clip.likes || [];
      return entities.Clip.update(clip.id, {
        likes: likes.includes(currentUser?.id)
          ? likes.filter(id => id !== currentUser?.id)
          : [...likes, currentUser?.id],
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
  });

  // ── Signal Relay (repost) ─────────────────────────────────────────────
  // Flips the user's relay state on this clip optimistically — the icon fills
  // the moment you tap (local Set + localStorage for instant, reload-proof UI).
  // The server side now PERSISTS via the atomic POST /clips/:id/relay endpoint
  // ($addToSet / $pull on the schema-backed `relays` field). Previously the
  // backend silently dropped the unknown `relays` field, so reposts never
  // survived a refetch — that's fixed now, but we keep the local fallback so
  // the gesture still feels instant and degrades gracefully offline.
  const relayMut = useMutation({
    mutationFn: async () => {
      const newOn = !hasRelayed;
      // 1) Optimistic local flip — fires the broadcast event so all mounted
      //    ClipCards for this clip re-derive their state.
      setLocalRelay(clip.id, newOn);
      // 2) Persist server-side (atomic toggle). Best-effort: a failure keeps
      //    the local state so the button stays flipped.
      try {
        await entities.Clip.relay(clip.id);
      } catch (err) {
        console.warn('[Spidr] relay server sync failed; local state preserved.', err);
      }
      return newOn ? 'relayed' : 'un-relayed';
    },
    onSuccess: (action) => {
      toast.success(action === 'relayed' ? 'Signal relayed to your web.' : 'Relay revoked.');
      // Soft refetch so other clip-list views (incl. profile REPOSTS) update.
      queryClient.invalidateQueries({ queryKey: ['clips'] });
    },
  });

  // ── Save to collection ────────────────────────────────────────────────
  // The bookmark now opens a picker: choose WHICH collection (Saved is the
  // default first entry), toggle membership per collection, or create a new
  // one inline — instead of the old blind save-to-'Saved' only.
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const { data: myCollections = [] } = useQuery({
    queryKey: ['collections', currentUser?.id],
    queryFn: () => entities.Collection.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id && collectionPickerOpen,
  });

  const saveMut = useMutation({
    mutationFn: async (collectionId = null) => {
      const cols = await entities.Collection.filter({ user_id: currentUser?.id });
      let col = collectionId
        ? (cols || []).find(c => c.id === collectionId)
        : (cols || []).find(c => c.name === 'Saved');
      if (!col) {
        await entities.Collection.create({ user_id: currentUser?.id, name: 'Saved', clip_ids: [clip.id] });
        return { action: 'added', name: 'Saved' };
      }
      const ids = col.clip_ids || [];
      const has = ids.includes(clip.id);
      await entities.Collection.update(col.id, {
        clip_ids: has ? ids.filter(id => id !== clip.id) : [...ids, clip.id],
      });
      return { action: has ? 'removed' : 'added', name: col.name };
    },
    onSuccess: ({ action, name }) => {
      toast.success(action === 'removed' ? `Removed from ${name}` : `Saved to ${name}!`);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: () => toast.error('Could not save — try again'),
  });

  const [newCollectionName, setNewCollectionName] = useState('');
  const createCollectionMut = useMutation({
    mutationFn: (name) => entities.Collection.create({ user_id: currentUser?.id, name, clip_ids: [clip.id] }),
    onSuccess: (_, name) => {
      toast.success(`Created "${name}" and saved!`);
      setNewCollectionName('');
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: () => toast.error('Could not create collection'),
  });

  const reactMut = useMutation({
    mutationFn: async (ed) => {
      const reactions = Array.isArray(clip.reactions) ? clip.reactions : [];
      const emoji = ed.type === 'custom' ? `:${ed.name}:` : ed.emoji;
      const existing = reactions.find(r => r.emoji === emoji);
      let nr;
      if (existing) {
        const had = existing.users.includes(currentUser?.id);
        nr = reactions
          .map(r => r.emoji === emoji
            ? { ...r, users: had ? r.users.filter(id => id !== currentUser?.id) : [...r.users, currentUser?.id] }
            : r)
          .filter(r => r.users.length > 0);
      } else {
        nr = [...reactions, { emoji, users: [currentUser?.id] }];
      }
      return entities.Clip.update(clip.id, { reactions: nr });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
  });

  const handleShare = (type) => {
    if (type === 'link') {
      const url = `${window.location.origin}/feed?clip=${clip.id}`;
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
    algorithm.trackEngagement({
      clipId: clip.id,
      watchTimeSeconds: 0,
      totalDuration: 0,
      liked: hasLiked,
      looped: false,
      shared: true,
      commented: false,
    }).catch(() => {});
    entities.Clip.update(clip.id, { shares_count: (clip.shares_count || 0) + 1 })
      .then(() => queryClient.invalidateQueries({ queryKey: ['clips'] }))
      .catch(() => {});
    setShareMenu(false);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); setUserPaused(false); }
    else { v.pause(); setPlaying(false); setUserPaused(true); }
  };

  const userReactions = Array.isArray(clip.reactions)
    ? clip.reactions.filter(r => r.users?.includes(currentUser?.id))
    : [];

  // Patch 2.13: grafted-audio viewport auto-play. The hook owns the observer
  // container ref (attached to the card frame) + the <audio> element ref.
  const graftAudioRef = useRef(null);
  const graft = clip.grafted_audio || null;
  const { containerRef: graftContainerRef, isActive: graftActive, isMuted: graftMuted, requestUnmute: graftUnmute } =
    useViewportMedia(graftAudioRef, { id: `clip-${clip.id}`, threshold: 0.7, targetVolume: 0.8 });
  const graftPlaying = graftActive && !graftMuted && !!graft?.previewUrl;
  const handleGraftTap = (e) => {
    e.stopPropagation();
    if (!graft?.previewUrl) { if (graft?.sourceUrl) window.open(graft.sourceUrl, '_blank', 'noopener'); return; }
    if (graftMuted) graftUnmute();
  };

  // ── Per-clip aspect playback sizing ───────────────────────────────────
  // Three sizing modes:
  //   • Mobile pseudo-fullscreen (mobileFullscreen=true) — phone in
  //     landscape with a wide clip → card escapes the feed and goes
  //     position:fixed inset:0 to fill the viewport, video uses contain so
  //     nothing important is cropped. Renders via cardClass below.
  //   • Theater / expanded (expanded=true, desktop) — card scales to
  //     ~80vh tall so wide clips fill the screen comfortably. Width is
  //     derived from height * aspect, capped at 92vw to stay on screen.
  //   • Default — explicit clamped width with CSS aspect-ratio deriving
  //     the height. max-height 82vh is the safety net when 9:16 portrait
  //     would otherwise overflow a short window.
  const aspectNum = (() => {
    if (!aspectCss) return 9 / 16;
    const [n, d] = aspectCss.split('/').map(Number);
    return d ? n / d : 9 / 16;
  })();
  // "Wide" = wider than tall. We only auto-suggest rotate / mobile
  // fullscreen for content that benefits from a wider viewport.
  const isWideClip = aspectNum > 1.05;
  // Mobile-landscape pseudo-fullscreen kicks in only on small viewports.
  // 1024px max-width keeps tablets in the gentler standard layout unless
  // they're explicitly small landscape phones.
  const isSmallViewport = typeof window !== 'undefined' && window.innerWidth < 1024;
  const mobileFullscreen = orientation === 'landscape' && isSmallViewport && isWideClip;
  // Show the rotate hint when the user is on a small portrait viewport
  // looking at a wide clip — i.e. when rotating would obviously improve
  // the experience.
  const showRotateHint = orientation === 'portrait' && isSmallViewport && isWideClip;

  const cardWidth = comments && !isSmallViewport
    ? 'max(280px, min(540px, calc(92vw - 392px)))'
    : (expanded
        ? `min(92vw, calc(80vh * ${aspectNum}))`
        : 'min(720px, 92vw)');
  const cardMaxHeight = '100%';
  const renderComments = pane => isSmallViewport ? createPortal(pane, document.body) : pane;

  return (
    <div
      className="clip-layout relative flex gap-3 items-center"
    >
      {/* Video card. In mobile-landscape-fullscreen we break out of the feed
          layout and pin the card to the viewport edges — gives wide clips
          maximum room on phones. Otherwise sizing follows expanded / default
          / comments-open modes computed above. */}
      <motion.div
        ref={graftContainerRef}
        className={
          mobileFullscreen
            ? 'clip-card fixed inset-0 z-[100] bg-black overflow-hidden'
            : 'clip-card relative bg-zinc-900 rounded-2xl overflow-hidden border shadow-2xl'
        }
        style={mobileFullscreen ? {
          borderColor: 'transparent',
        } : {
          aspectRatio: aspectCss,
          width: cardWidth,
          maxHeight: cardMaxHeight,
          borderColor: trending ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)',
        }}
        animate={striking
          ? { x: [0, -8, 8, -6, 6, 0], boxShadow: '0 0 60px rgba(239,68,68,0.8)' }
          : trending ? { boxShadow: ['0 0 22px rgba(239,68,68,0.25)', '0 0 46px rgba(239,68,68,0.55)', '0 0 22px rgba(239,68,68,0.25)'] } : {}}
        transition={striking ? { duration: 0.5 } : trending ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : {}}
        onContextMenu={(e) => {
          if (!menu?.triggerMenu) return;
          e.preventDefault();
          menu.triggerMenu(e, 'web_post', {
            id: clip.id,
            author_id: clip.author_id,
            author_name: clip.author_name,
            name: clip.author_name,
            avatar_url: clip.author_avatar || '',
            header_sub: 'Strand on the web',
            is_relayed: Array.isArray(clip.relays) && currentUser?.id ? clip.relays.includes(currentUser.id) : false,
            is_own: clip.author_id === currentUser?.id,
          });
        }}
      >
        {encrypting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center font-mono pointer-events-none"
          >
            <Lock className="w-8 h-8 text-green-400 mb-3" />
            <motion.div
              className="text-green-400 text-xs tracking-widest"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              &gt; ENCRYPTING_NODE...
            </motion.div>
            <div className="text-green-600 text-[10px] mt-1 tracking-widest">SAVED TO VAULT</div>
          </motion.div>
        )}
        {trending && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-red-500/50 pointer-events-none"
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <span className="text-[9px] font-black tracking-widest text-red-400 uppercase">Trending</span>
          </motion.div>
        )}

        {/* Signal Relay header — appears when this clip reached the viewer's
            feed via a repost. Sits at the very top, spans the card width,
            uses a frosted purple pill with the reposter's mini-avatar
            inline. pointer-events-none so it never intercepts taps from
            the underlying video. */}
        {clip.repost_by && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute top-0 inset-x-0 z-30 flex justify-center pt-3 pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md"
              style={{
                background: 'rgba(10, 4, 22, 0.78)',
                border: '1px solid rgba(168, 85, 247, 0.55)',
                boxShadow: '0 0 14px rgba(168, 85, 247, 0.30), inset 0 0 8px rgba(168, 85, 247, 0.10)',
              }}
            >
              <Avatar className="w-4 h-4 border border-purple-400/60 flex-shrink-0">
                {clip.repost_by.user_avatar
                  ? <AvatarImage src={clip.repost_by.user_avatar} />
                  : <AvatarFallback className="bg-purple-900 text-white text-[9px]">
                      {(clip.repost_by.user_name || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>}
              </Avatar>
              <span className="text-[9px] font-black tracking-[0.22em] text-purple-200 uppercase whitespace-nowrap">
                <span className="text-purple-300">{clip.repost_by.user_name}</span>
                <span className="text-purple-400/70"> · Relayed this signal</span>
              </span>
              {/* Tiny pulse so the badge reads as a live frequency, not a
                  static label. */}
              <motion.span
                className="w-1 h-1 rounded-full bg-purple-300"
                animate={{ opacity: [1, 0.25, 1], scale: [1, 1.5, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            </div>
          </motion.div>
        )}

        {/* Rotate-to-watch hint — appears when a phone in portrait is
            displaying a wide clip. Rotating triggers mobile pseudo-
            fullscreen (handled by the mobileFullscreen branch above).
            Auto-dismisses after 4s so it never overstays. */}
        {showRotateHint && isActive && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 pointer-events-none"
          >
            <motion.span
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.4, 0.8, 1], ease: 'easeInOut' }}
            >
              <RotateCw className="w-3.5 h-3.5 text-white/80" />
            </motion.span>
            <span className="text-[10px] font-bold text-white/90 tracking-wider uppercase">
              Rotate for fullscreen
            </span>
          </motion.div>
        )}

        <video
          ref={videoRef}
          src={clip.video_url}
          className={`w-full h-full bg-black cursor-pointer ${clip.crop_data ? 'object-cover' : 'object-contain'}`}
          style={cropStyle}
          loop
          muted={muted}
          playsInline
          preload={isActive ? 'auto' : 'metadata'}
          onClick={togglePlay}
          onLoadedMetadata={(e) => { const v = e.target; if (v.videoWidth) setNatSize({ width: v.videoWidth, height: v.videoHeight }); }}
        />

        {/* Buffering spinner */}
        <AnimatePresence>
          {buffering && isActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-9 h-9 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paused overlay */}
        <AnimatePresence>
          {!playing && !buffering && isActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                <Play size={24} fill="white" className="text-white ml-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div className="absolute bottom-0 inset-x-0 h-0.5 bg-white/10">
          <div className="h-full bg-red-500 transition-none" style={{ width: `${progress}%` }} />
        </div>

        {/* Author/caption overlay */}
        <div className="clip-details bg-gradient-to-t from-black/90 via-black/70 to-transparent"
          onWheel={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!clip.author_id) return;
                // Preferred: open their WEB profile right here in the feed.
                if (onOpenProfile) {
                  onOpenProfile({ id: clip.author_id, full_name: clip.author_name, avatar_url: clip.author_avatar });
                  return;
                }
                // Fallback (older mounts): main-app holographic profile.
                window.dispatchEvent(new CustomEvent('spidr-open-profile', {
                  detail: { userId: clip.author_id }
                }));
              }}
              className="flex items-center gap-2 group/author cursor-pointer min-w-0"
              title={`View ${clip.author_name}'s profile`}
            >
              <Avatar className="w-7 h-7 border-2 border-red-500 flex-shrink-0 group-hover/author:border-red-400 transition-colors">
                {clip.author_avatar
                  ? <AvatarImage src={clip.author_avatar} />
                  : <AvatarFallback className="bg-red-900 text-white text-xs">
                      {clip.author_name?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>}
              </Avatar>
              <span className="font-semibold text-white text-xs truncate group-hover/author:text-red-400 transition-colors">{clip.author_name}</span>
            </button>
            {clip.author_id === currentUser?.id && onEditClip && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditClip(clip); }}
                className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/50 hover:text-white transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          {clip.caption && <p className="text-white text-xs line-clamp-2 mb-1 break-words">{clip.caption}</p>}
          {/* Game tag pill — surfaces the game the creator was playing
              when they uploaded the clip. Only renders if clip.game_tag is
              set on the payload (new optional field; safe to leave null on
              older clips). Uses purple text to distinguish from red
              hashtags. */}
          {clip.game_tag && (
            <div className="mb-1">
              <span className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 text-[10px] font-semibold text-purple-400 break-words">
                <span aria-hidden="true">🎮</span>
                {clip.game_tag}
              </span>
            </div>
          )}
          {(clip.hashtags || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {clip.hashtags.slice(0, 4).map((t, i) =>
                <span key={i} className="text-red-400 text-[10px] font-bold break-all">#{t}</span>
              )}
            </div>
          )}
          {clip.audio_id && audioMap?.[clip.audio_id] && (
            <ScrollingAudioBanner
              audioTrack={audioMap[clip.audio_id]}
              onClick={() => setFreqAudio(audioMap[clip.audio_id])}
            />
          )}

          {Array.isArray(clip.reactions) && clip.reactions.length > 0 && (
            <div className="clip-reactions flex gap-1 flex-wrap my-2" aria-label="Clip reactions">
              {clip.reactions.map((r, i) => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-zinc-800/90 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <span className="text-sm">{r.emoji}</span>
                  <span className="text-white text-[10px]">{r.users.length}</span>
                </motion.div>
              ))}
            </div>
          )}

          {/* Join Server CTA — shown when the creator linked a server. */}
          {clip.server_id && (
            <motion.button
              onClick={(e) => { e.stopPropagation(); navigate(`/servers/${clip.server_id}`); }}
              whileTap={{ scale: 0.96 }}
              className="clip-server-link mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#FF3333]/90 to-[#990000]/90 hover:from-[#FF3333] hover:to-[#990000] border border-[#FF3333]/40 shadow-[0_0_18px_rgba(255,51,51,0.3)] transition-all"
            >
              {clip.server_icon
                ? <img src={clip.server_icon} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0 border border-white/20" />
                : <span className="w-6 h-6 rounded-lg bg-black/30 flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-white" /></span>}
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[9px] uppercase tracking-widest text-white/70 leading-none">Join Server</p>
                <p className="text-xs font-bold text-white truncate leading-tight">{clip.server_name || 'Spidr Server'}</p>
              </div>
              <span className="text-[10px] font-black text-white bg-black/30 rounded-full px-2 py-1 shrink-0">JOIN</span>
            </motion.button>
          )}
          <div className="clip-footer-meta">
            {graft && (
              <AudioGraftNode audio={graft} audioRef={graftAudioRef} playing={graftPlaying}
                muted={graftMuted || !graft.previewUrl} onTap={handleGraftTap} inline />
            )}
            <TelemetryPanel clip={clip} />
          </div>
        </div>

        {/* Side actions */}
        <div className="clip-actions" aria-label="Clip actions" onWheel={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          {/* Profile Node — creator avatar sitting at the top of the dock,
              with a small red `+` button overlapping the bottom for a
              1-tap follow (TikTok pattern). Hidden when the viewer is the
              creator. Avatar opens the profile modal; the `+` is a
              separate target that doesn't bubble through. */}
          {clip.author_id && clip.author_id !== currentUser?.id && (
            <ProfileNode
              authorId={clip.author_id}
              authorName={clip.author_name}
              authorAvatar={clip.author_avatar}
              currentUserId={currentUser?.id}
              currentUserName={currentUser?.full_name || currentUser?.username}
              currentUserAvatar={currentUser?.avatar_url}
            />
          )}
          <SideBtn title={hasLiked ? 'Unlike clip' : 'Like clip'} onClick={() => likeMut.mutate()} label={clip.likes?.length || 0} active={hasLiked}>
            <Heart className="w-5 h-5" fill={hasLiked ? 'currentColor' : 'none'} />
          </SideBtn>
          <SideBtn title="Comments" onClick={() => setComments(v => !v)} label={clip.comments_count || 0} active={comments}>
            <MessageCircle className="w-5 h-5" />
          </SideBtn>
          {/* Signal Relay — 1-tap repost. The active state flips to a
              neon purple gradient (vs the red-active default) so it
              reads as a distinct gesture from likes/comments. */}
          <SideBtn
            onClick={() => { if (!relayMut.isPending) relayMut.mutate(); }}
            label={relayCount}
            active={hasRelayed}
            variant="relay"
            title={hasRelayed ? 'Revoke relay' : 'Relay to your web'}
          >
            <Repeat2 className="w-5 h-5" />
          </SideBtn>
          <EmojiPicker onEmojiSelect={(e) => reactMut.mutate(e)} currentUser={currentUser}>
            <SideBtn title="React to clip" label={userReactions.length || ''} active={userReactions.length > 0}>
              <Sparkles className="w-5 h-5" />
            </SideBtn>
          </EmojiPicker>
          <Popover open={shareMenu} onOpenChange={setShareMenu}>
            <PopoverAnchor asChild><div>
            <SideBtn title="Share clip" onClick={() => setShareMenu(v => !v)} label={clip.shares_count || 0}>
              <Share2 className="w-5 h-5" />
            </SideBtn>
            </div></PopoverAnchor>
                <PopoverContent side="left" align="center" collisionPadding={12} className="z-[120] w-40 bg-zinc-800 border-zinc-700 p-1.5" aria-label="Share clip options">
                  <button onClick={() => { setShareWeb(true); setShareMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded-lg text-white text-xs">🕸️ Sling to DMs</button>
                  <button onClick={() => handleShare('link')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded-lg text-white text-xs"><Send className="w-3 h-3" /> Copy Link</button>
                </PopoverContent>
          </Popover>
          <SideBtn title="Save clip" onClick={() => setCollectionPickerOpen(true)}><Bookmark className="w-5 h-5" /></SideBtn>
          {/* Theater mode toggle — desktop only. Wide videos in particular
              benefit; we surface the button for every aspect so it's a
              consistent control. Hidden on small viewports where mobile
              pseudo-fullscreen is the better UX. */}
          {!isSmallViewport && (
            <SideBtn
              onClick={() => setExpanded(v => !v)}
              active={expanded}
              title={expanded ? 'Collapse (Esc)' : 'Theater mode'}
            >
              {expanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </SideBtn>
          )}
          {clip.audio_id && audioMap?.[clip.audio_id] && (
            <DataDisc audioTrack={audioMap[clip.audio_id]} onOpenFrequency={(t) => setFreqAudio(t)} />
          )}
          <Popover open={showVol} onOpenChange={setShowVol}>
          <PopoverAnchor asChild><div
            className="relative"
            onMouseEnter={() => { clearTimeout(volLeaveTimer.current); setShowVol(true); }}
            onMouseLeave={() => { volLeaveTimer.current = setTimeout(() => setShowVol(false), 150); }}
          >
            <SideBtn title={muted ? 'Unmute clip' : 'Mute clip'} onClick={() => setMuted(v => !v)}>
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </SideBtn>
          </div></PopoverAnchor>
              <PopoverContent side="left" align="center" collisionPadding={12} onOpenAutoFocus={e => e.preventDefault()}
                className="z-[120] w-28 bg-zinc-800/95 p-3 shadow-xl" aria-label="Clip volume"
                onMouseEnter={() => { clearTimeout(volLeaveTimer.current); setShowVol(true); }}
                onMouseLeave={() => { volLeaveTimer.current = setTimeout(() => setShowVol(false), 150); }}
              >
                <input
                  aria-label="Volume"
                  type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVol(v);
                    setMuted(v === 0);
                  }}
                  className="w-20 h-1 appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right,#dc2626 0%,#dc2626 ${(muted ? 0 : vol) * 100}%,#3f3f46 ${(muted ? 0 : vol) * 100}%,#3f3f46 100%)`,
                  }}
                />
              </PopoverContent>
          </Popover>
        </div>
      </motion.div>

      {/* Comments pane */}
      {renderComments(<AnimatePresence>
        {comments && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: isSmallViewport ? 'calc(100% - 24px)' : 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="clip-comments bg-zinc-900 border border-white/10 rounded-lg overflow-hidden flex-shrink-0 flex flex-col"
            style={isSmallViewport ? { position: 'fixed', inset: 12, height: 'calc(100dvh - 24px)', zIndex: 130 } : { height: '100%' }}
            onWheel={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
          >
            <div className="flex justify-end p-2 border-b border-white/10">
              <button onClick={() => setComments(false)} title="Close comments" aria-label="Close comments" className="p-2 text-zinc-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
            <RichComments clipId={clip.id} currentUser={currentUser} onOpenProfile={onOpenProfile} />
            </div>

            {/* Save-to-collection picker */}
            {collectionPickerOpen && (
              <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={() => setCollectionPickerOpen(false)}>
                <div
                  className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-t-2xl p-4 pb-6 space-y-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 pb-2">Save to collection</p>
                  {(myCollections.length ? myCollections : [{ id: null, name: 'Saved', clip_ids: [] }]).map((c) => {
                    const inCol = (c.clip_ids || []).includes(clip.id);
                    return (
                      <button
                        key={c.id || 'saved-default'}
                        onClick={() => { saveMut.mutate(c.id); setCollectionPickerOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 text-left transition-colors"
                      >
                        <span className="text-sm text-white font-medium truncate">{c.name}</span>
                        <span className={`text-[10px] font-mono uppercase tracking-widest shrink-0 ${inCol ? 'text-red-400' : 'text-zinc-600'}`}>
                          {inCol ? 'Remove' : 'Add'}
                        </span>
                      </button>
                    );
                  })}
                  <div className="flex gap-2 pt-2 border-t border-white/5 mt-2">
                    <input
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="New collection…"
                      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50"
                    />
                    <button
                      onClick={() => { const n = newCollectionName.trim(); if (n) { createCollectionMut.mutate(n); setCollectionPickerOpen(false); } }}
                      disabled={!newCollectionName.trim()}
                      className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-40 shrink-0"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>)}

      <AnimatePresence>
        {shareWeb && <ShareWeb isOpen={shareWeb} onClose={() => setShareWeb(false)} clip={clip} currentUser={currentUser} />}
      </AnimatePresence>
      <AnimatePresence>
        {freqAudio && (
          <FrequencyArchive
            audioTrack={freqAudio}
            onClose={() => setFreqAudio(null)}
            currentUser={currentUser}
            onClipClick={() => setFreqAudio(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const SideBtn = React.forwardRef(function SideBtn({ children, onClick, label, active, title, variant = 'default', ...props }, ref) {
  // Active styling depends on the variant — most actions (like, comment,
  // react) flip to red. The "relay" variant flips to a neon purple-pink
  // gradient with a glow halo so the gesture reads as distinct from a
  // like or a comment.
  const activeClass =
    variant === 'relay'
      ? 'text-white'
      : 'bg-red-600/90 text-white';
  const activeStyle =
    variant === 'relay' && active
      ? {
          background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          boxShadow: '0 0 14px rgba(168, 85, 247, 0.55), 0 0 24px rgba(236, 72, 153, 0.30)',
        }
      : undefined;
  return (
    <motion.button
      {...props}
      ref={ref}
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.85 }}
      title={title}
      aria-label={title}
      className="flex flex-col items-center gap-0.5"
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          active ? activeClass : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        style={activeStyle}
      >
        {children}
      </div>
      {label !== undefined && label !== '' && (
        <span className="text-[10px] text-white font-bold">
          {typeof label === 'number' && label >= 1000 ? `${(label / 1000).toFixed(1)}k` : label}
        </span>
      )}
    </motion.button>
  );
});

// ── Telemetry Panel ─────────────────────────────────────────────────────────
// Compact metrics in the footer flow, below the caption and server link:
//   • VIEWS — raw count from clip.views (k/m formatted for headroom).
//   • SPIKE — a 0-100 score derived from total engagement (likes + comments
//             + relays) normalized so a quiet clip still pulses gently and
//             a hot clip glows brightly.
// Aesthetic matches the Symbiote HUD: thin red border, faint outer glow,
// pure-black glass body, mono small caps. The pulse dot ticks independent
// of activity so the panel always reads as "live".
function TelemetryPanel({ clip }) {
  const views = clip?.views || 0;
  const fmt = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };
  // Spike score: blend engagement signals. Tunable but kept stable across
  // renders. Caps at 100 so glow intensity has a ceiling.
  const engagement =
    (clip?.likes?.length || 0) * 1 +
    (clip?.comments_count || 0) * 1.5 +
    (clip?.relays?.length || 0) * 2;
  const spike = Math.min(100, Math.round(engagement));
  // Map spike → glow intensity (0.10 → 0.55) for a visible-but-tasteful range.
  const glow = 0.1 + (spike / 100) * 0.45;

  return (
    <div
      className="clip-telemetry flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-md font-mono pointer-events-none select-none"
      style={{
        background: 'rgba(5, 5, 5, 0.78)',
        border: '1px solid rgba(239, 68, 68, 0.45)',
        boxShadow: `0 0 10px rgba(239, 68, 68, ${glow}), inset 0 0 6px rgba(239, 68, 68, 0.08)`,
        backdropFilter: 'blur(8px)',
        zIndex: 5,
      }}
      aria-label="Clip telemetry"
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
        animate={{ opacity: [1, 0.25, 1], scale: [1, 1.4, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' }}
      />
      <span className="text-[9px] tracking-widest text-red-300/90 uppercase">
        <span className="text-red-400/60">VIEW</span>{' '}
        <span className="text-white">{fmt(views)}</span>
      </span>
      <span className="text-red-500/30">·</span>
      <span className="text-[9px] tracking-widest text-red-300/90 uppercase">
        <span className="text-red-400/60">SPIKE</span>{' '}
        <span className="text-white">{spike}</span>
      </span>
    </div>
  );
}

// ── Profile Node ────────────────────────────────────────────────────────────
// The creator's avatar pinned at the top of the right-side action dock.
// Clicking the avatar opens their profile modal. A small red `+` button
// overlaps the bottom of the avatar for a single-tap follow — when the
// viewer is already following, it flips to a check mark on a muted
// background. Self-clips don't render this (you can't follow yourself).
function ProfileNode({ authorId, authorName, authorAvatar, currentUserId, currentUserName, currentUserAvatar }) {
  const queryClient = useQueryClient();

  // Light query — "is the current user following this creator?". Cached
  // for 60s so scrubbing through clips by the same creator doesn't refire.
  const { data: followingList = [] } = useQuery({
    queryKey: ['my-following', currentUserId],
    queryFn: () => followsApi.following(currentUserId),
    enabled: !!currentUserId,
    staleTime: 60000,
  });
  const isFollowing = useMemo(
    () => followingList.some(f => (f.following_id || f.user_id) === authorId),
    [followingList, authorId]
  );

  const followMut = useMutation({
    mutationFn: async () => {
      if (isFollowing) return followsApi.unfollow(authorId);
      return followsApi.follow({
        following_id: authorId,
        following_name: authorName,
        following_avatar: authorAvatar || '',
        follower_name: currentUserName,
        follower_avatar: currentUserAvatar || '',
      });
    },
    onSuccess: () => {
      toast.success(isFollowing ? 'Unfollowed' : `Following ${authorName}`);
      queryClient.invalidateQueries({ queryKey: ['my-following', currentUserId] });
    },
    onError: () => toast.error('Could not update follow'),
  });

  const openProfile = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: authorId } }));
  };

  return (
    <div className="relative">
      <motion.button
        onClick={openProfile}
        whileTap={{ scale: 0.9 }}
        aria-label={`Open ${authorName}'s profile`}
        title={`Open ${authorName}'s profile`}
        className="block"
      >
        <Avatar className="w-11 h-11 border-2 border-white shadow-[0_0_10px_rgba(0,0,0,0.6)]">
          {authorAvatar
            ? <AvatarImage src={authorAvatar} />
            : <AvatarFallback className="bg-red-900 text-white text-sm font-bold">
                {authorName?.charAt(0)?.toUpperCase()}
              </AvatarFallback>}
        </Avatar>
      </motion.button>
      {/* Follow toggle — sits at the bottom-center, overlapping the avatar
          by half its height (TikTok pattern). Red `+` when not following,
          translucent check when already following. */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); followMut.mutate(); }}
        whileTap={{ scale: 0.85 }}
        disabled={followMut.isPending}
        aria-label={isFollowing ? `Unfollow ${authorName}` : `Follow ${authorName}`}
        title={isFollowing ? 'Following' : 'Follow'}
        className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
          isFollowing
            ? 'bg-white/15 backdrop-blur-sm border border-white/30 text-white'
            : 'bg-red-500 text-white border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.65)]'
        }`}
        style={{ pointerEvents: followMut.isPending ? 'none' : 'auto' }}
      >
        {isFollowing ? <Check className="w-3 h-3" strokeWidth={3} /> : <Plus className="w-3 h-3" strokeWidth={3} />}
      </motion.button>
    </div>
  );
}
