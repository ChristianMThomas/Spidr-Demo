import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Volume2, VolumeX, Play,
  Bookmark, Sparkles, Send,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { entities, algorithm } from '@/api/apiClient';
import { toast } from 'sonner';
import RichComments from '@/components/spidr/RichComments';
import EmojiPicker from '@/components/spidr/EmojiPicker';
import ShareWeb from '@/components/spidr/ShareWeb';
import { useMenu } from '@/components/MenuContext';
import DataDisc from '@/components/feed/DataDisc';
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

export default function ClipFeed({
  clips,
  currentUser,
  onEditClip,
  feedPersonalized,
  audioMap,
}) {
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const containerRef = useRef(null);
  const isSnappingRef = useRef(false);
  const lastSnapTimeRef = useRef(0);

  // Clamp idx if clips list shrinks
  useEffect(() => {
    if (idx >= clips.length) setIdx(Math.max(0, clips.length - 1));
  }, [clips.length, idx]);

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
    if (isSnappingRef.current) return;
    const now = Date.now();
    if (now - lastSnapTimeRef.current < 220) return; // throttle
    lastSnapTimeRef.current = now;
    setIdx((prev) => {
      const next = Math.max(0, Math.min(clips.length - 1, prev + delta));
      return next;
    });
  }, [clips.length]);

  const onWheel = useCallback((e) => {
    // Threshold of 25 prevents trackpad inertia from triggering many advances
    if (Math.abs(e.deltaY) < 25) return;
    e.preventDefault();
    advance(e.deltaY > 0 ? 1 : -1);
  }, [advance]);

  // Keyboard navigation — accessibility
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault();
        advance(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
        e.preventDefault();
        advance(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance]);

  // ── Touch / pointer swipe (mobile) ─────────────────────────────────────────
  const touchStartY = useRef(null);
  const onTouchStart = (e) => { touchStartY.current = e.touches[0]?.clientY; };
  const onTouchEnd = (e) => {
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
      <div className="absolute top-3 inset-x-0 text-center z-10 pointer-events-none">
        <span className="text-[10px] font-black tracking-widest text-red-600/40 uppercase">
          {feedPersonalized ? '⚡ For You' : 'THE WEB'} // {idx + 1} / {clips.length}
        </span>
      </div>

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
              <div className={isCurrent ? 'pointer-events-auto' : 'pointer-events-none'}>
                <ClipCard
                  clip={clip}
                  isActive={isCurrent}
                  currentUser={currentUser}
                  onEditClip={onEditClip}
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
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-20">
        {clips.slice(Math.max(0, idx - 3), idx + 4).map((_, i) => {
          const ai = Math.max(0, idx - 3) + i;
          return (
            <button
              key={ai}
              onClick={() => setIdx(ai)}
              className={`w-1 rounded-full transition-all ${
                ai === idx ? 'h-6 bg-red-500' : 'h-1.5 bg-zinc-600 hover:bg-red-400'
              }`}
              aria-label={`Jump to clip ${ai + 1}`}
            />
          );
        })}
      </div>
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
  clip, isActive, currentUser, onEditClip,
  muted, setMuted, vol, setVol, audioMap,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [comments, setComments] = useState(false);
  const [shareMenu, setShareMenu] = useState(false);
  const [shareWeb, setShareWeb] = useState(false);
  const [freqAudio, setFreqAudio] = useState(null);
  const queryClient = useQueryClient();
  const menu = useMenu();
  const hasLiked = clip.likes?.includes(currentUser?.id);

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
      } else if (action === 'save') {
        saveMut.mutate();
      } else if (action === 'profile' && data.author_id) {
        window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: data.author_id } }));
      } else if (action === 'report') {
        toast.success('Post reported to moderators');
      }
    };
    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = clip?.aspect_ratio || '9:16';
  const aspectCss = ratio === '16:9' ? '16/9' : ratio === '1:1' ? '1/1' : '9/16';

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

  // Reset to start when a card becomes active again
  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = 0;
      setProgress(0);
      setUserPaused(false);
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

  const saveMut = useMutation({
    mutationFn: async () => {
      const cols = await entities.Collection.filter({ user_id: currentUser?.id });
      let col = (cols || []).find(c => c.name === 'Saved');
      if (!col) {
        await entities.Collection.create({ user_id: currentUser?.id, name: 'Saved', clip_ids: [clip.id] });
        return 'added';
      }
      const ids = col.clip_ids || [];
      const has = ids.includes(clip.id);
      await entities.Collection.update(col.id, {
        clip_ids: has ? ids.filter(id => id !== clip.id) : [...ids, clip.id],
      });
      return has ? 'removed' : 'added';
    },
    onSuccess: (action) => {
      toast.success(action === 'removed' ? 'Removed from Saved' : 'Saved!');
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: () => toast.error('Could not save — try again'),
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

  return (
    <div
      className={`relative flex gap-3 ${comments ? 'max-w-4xl' : 'max-w-sm'}`}
      style={{ height: '82vh' }}
    >
      {/* Video card */}
      <div
        className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl flex-shrink-0"
        style={{ aspectRatio: aspectCss, maxHeight: '82vh' }}
        onContextMenu={(e) => {
          if (!menu?.triggerMenu) return;
          e.preventDefault();
          menu.triggerMenu(e, 'web_post', {
            id: clip.id,
            author_id: clip.author_id,
            author_name: clip.author_name,
          });
        }}
      >
        <video
          ref={videoRef}
          src={clip.video_url}
          className="w-full h-full object-contain bg-black cursor-pointer"
          loop
          muted={muted}
          playsInline
          preload={isActive ? 'auto' : 'metadata'}
          onClick={togglePlay}
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
        <div className="absolute bottom-2 left-0 right-12 px-3 pt-8 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
          <div className="flex items-center gap-2 mb-1">
            <Avatar className="w-7 h-7 border-2 border-red-500 flex-shrink-0">
              {clip.author_avatar
                ? <AvatarImage src={clip.author_avatar} />
                : <AvatarFallback className="bg-red-900 text-white text-xs">
                    {clip.author_name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>}
            </Avatar>
            <span className="font-semibold text-white text-xs truncate">{clip.author_name}</span>
            {clip.author_id === currentUser?.id && onEditClip && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditClip(clip); }}
                className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/50 hover:text-white transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          {clip.caption && <p className="text-white text-xs line-clamp-2 mb-1">{clip.caption}</p>}
          {(clip.hashtags || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {clip.hashtags.slice(0, 4).map((t, i) =>
                <span key={i} className="text-red-400 text-[10px] font-bold">#{t}</span>
              )}
            </div>
          )}
          {clip.audio_id && audioMap?.[clip.audio_id] && (
            <ScrollingAudioBanner
              audioTrack={audioMap[clip.audio_id]}
              onClick={() => setFreqAudio(audioMap[clip.audio_id])}
            />
          )}
        </div>

        {/* Reactions */}
        {Array.isArray(clip.reactions) && clip.reactions.length > 0 && (
          <div className="absolute bottom-20 left-3 flex gap-1 flex-wrap max-w-[55%]">
            {clip.reactions.map((r, i) => (
              <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="bg-zinc-800/90 rounded-full px-2 py-0.5 flex items-center gap-1">
                <span className="text-sm">{r.emoji}</span>
                <span className="text-white text-[10px]">{r.users.length}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Side actions */}
        <div className="absolute right-2 bottom-20 flex flex-col gap-3">
          <SideBtn onClick={() => likeMut.mutate()} label={clip.likes?.length || 0} active={hasLiked}>
            <Heart className="w-5 h-5" fill={hasLiked ? 'currentColor' : 'none'} />
          </SideBtn>
          <SideBtn onClick={() => setComments(v => !v)} label={clip.comments_count || 0} active={comments}>
            <MessageCircle className="w-5 h-5" />
          </SideBtn>
          <EmojiPicker onEmojiSelect={(e) => reactMut.mutate(e)} currentUser={currentUser}>
            <SideBtn label={userReactions.length || ''} active={userReactions.length > 0}>
              <Sparkles className="w-5 h-5" />
            </SideBtn>
          </EmojiPicker>
          <div className="relative">
            <SideBtn onClick={() => setShareMenu(v => !v)} label={clip.shares_count || 0}>
              <Share2 className="w-5 h-5" />
            </SideBtn>
            <AnimatePresence>
              {shareMenu && (
                <motion.div
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                  className="absolute right-12 top-0 bg-zinc-800 rounded-xl border border-zinc-700 p-1.5 w-34 shadow-2xl z-30 min-w-[130px]"
                >
                  <button onClick={() => { setShareWeb(true); setShareMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded-lg text-white text-xs">🕸️ Sling to DMs</button>
                  <button onClick={() => handleShare('link')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded-lg text-white text-xs"><Send className="w-3 h-3" /> Copy Link</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <SideBtn onClick={() => saveMut.mutate()}><Bookmark className="w-5 h-5" /></SideBtn>
          {clip.audio_id && audioMap?.[clip.audio_id] && (
            <DataDisc audioTrack={audioMap[clip.audio_id]} onOpenFrequency={(t) => setFreqAudio(t)} />
          )}
          <div className="relative group/vol">
            <SideBtn onClick={() => setMuted(v => !v)}>
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </SideBtn>
            <div className="absolute right-12 top-0 bg-zinc-800/95 rounded-xl p-3 opacity-0 group-hover/vol:opacity-100 pointer-events-none group-hover/vol:pointer-events-auto transition-all shadow-xl">
              <input
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
            </div>
          </div>
        </div>
      </div>

      {/* Comments pane */}
      <AnimatePresence>
        {comments && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ height: '82vh' }}
          >
            <RichComments clipId={clip.id} currentUser={currentUser} />
          </motion.div>
        )}
      </AnimatePresence>

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

function SideBtn({ children, onClick, label, active }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.85 }}
      className="flex flex-col items-center gap-0.5"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
        active ? 'bg-red-600/90 text-white' : 'bg-white/10 text-white hover:bg-white/20'
      }`}>
        {children}
      </div>
      {label !== undefined && label !== '' && (
        <span className="text-[10px] text-white font-bold">
          {typeof label === 'number' && label >= 1000 ? `${(label / 1000).toFixed(1)}k` : label}
        </span>
      )}
    </motion.button>
  );
}
