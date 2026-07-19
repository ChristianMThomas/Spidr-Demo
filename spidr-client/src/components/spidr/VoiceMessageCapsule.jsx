import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Sparkles, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { aiTranscribe } from '@/api/apiClient';

/**
 * VoiceMessageCapsule — Spidr's "Holographic Audio Capsule" for voice
 * messages in DMs, group chats, and server channels. Replaces the
 * browser-default <audio controls> element (which looked like a 2012 SMS
 * app) with a frosted-glass pill that fits Spidr's Comm Deck aesthetic.
 *
 * Anatomy:
 *   ┌─[●]──╫╫╫╫╫─╴╴╴╴╴───── 0:04 / 0:18 ──[T]─┐
 *   │ play   waveform        timer       AI   │
 *   └─────────────────────────────────────────┘
 *   (optional) ┌── AI Scribe transcription ──┐
 *              └─────────────────────────────┘
 *
 * Behaviors:
 *   • Click the round play button → toggle playback.
 *   • Click any waveform bar → seek to that fraction of the audio.
 *   • Played bars glow crimson; unplayed stay muted white.
 *   • Click the AI Scribe (sparkles) → expand a transcription pane
 *     below the capsule.
 *
 * The waveform is rendered as 40 vertical bars whose heights are derived
 * deterministically from a hash of the audio URL. That gives every voice
 * message its own consistent "fingerprint" without having to decode the
 * actual audio (which would be heavyweight for inline chat rendering).
 * If a real waveform extraction is wired in later, swap `generateBars`
 * for a Web-Audio-API decoder that returns the same 40-element array.
 *
 * Props:
 *   url            audio file URL (any browser-playable format)
 *   isSelf         true for sent messages — flips the sharp corner to
 *                  top-right; defaults to false (received = sharp TL).
 *   transcription  pre-computed text; if null/undefined the AI Scribe
 *                  pane explains that transcription isn't wired yet.
 */

const BAR_COUNT = 40;

// Tiny deterministic hash so the same URL always yields the same bars.
function hashStr(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

// Seeded PRNG (mulberry32) — small, fast, decent distribution.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateBars(url) {
  const rnd = mulberry32(hashStr(url || 'spidr-voice-default'));
  // Mix "burst" peaks with quieter ambient so the visual reads as speech
  // rather than a uniform noise floor.
  return Array.from({ length: BAR_COUNT }, () => {
    const burst = rnd() > 0.74;
    return burst ? 0.6 + rnd() * 0.4 : 0.22 + rnd() * 0.38;
  });
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export default function VoiceMessageCapsule({ url, isSelf = false, transcription = null }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [transcribeOpen, setTranscribeOpen] = useState(false);

  // AI Scribe — real speech-to-text. Lazy: only transcribes when the pane
  // is opened (no cost for capsules nobody expands). The server proxies
  // Whisper and caches per-URL, so repeat opens are instant for everyone.
  const {
    data: scribeData,
    isLoading: scribeLoading,
    error: scribeError,
  } = useQuery({
    queryKey: ['voice-transcription', url],
    queryFn: () => aiTranscribe(url),
    enabled: transcribeOpen && !transcription && !!url,
    staleTime: Infinity,
    retry: 1,
  });
  const liveTranscription = transcription || scribeData?.text || null;

  const bars = useMemo(() => generateBars(url), [url]);
  const progress = duration > 0 ? currentTime / duration : 0;

  // Wire up audio element events. Recreated when url changes so refs stay
  // synced if the same capsule re-renders with a different attachment.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(a.duration || 0);
    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('durationchange', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('durationchange', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, [url]);

  const toggle = (e) => {
    e?.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => { /* user-gesture lock; ignore */ });
    else a.pause();
  };

  const seekToFrac = (frac) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = Math.max(0, Math.min(duration, frac * duration));
    setCurrentTime(a.currentTime);
  };

  // Determine the sharp corner — received (default): top-left. Sent: top-right.
  const sharpCorner = isSelf ? 'rounded-tr-sm' : 'rounded-tl-sm';

  return (
    <div className="inline-block max-w-full align-top">
      {/* Hidden audio engine. `preload="metadata"` is enough to know
          duration without buffering the whole file up front. */}
      <audio ref={audioRef} src={url} preload="metadata" />

      <div
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-3xl ${sharpCorner}`}
        style={{
          background: 'rgba(5, 5, 5, 0.80)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          minWidth: 280,
          maxWidth: 360,
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Subtle red bleed anchored to the play side */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 100% at 0% 50%, rgba(239, 68, 68, 0.07), transparent 70%)',
          }}
        />

        {/* ── Play / Pause node ──────────────────────────────────────── */}
        <PlayButton playing={playing} onClick={toggle} />

        {/* ── Waveform ───────────────────────────────────────────────── */}
        <div
          className="relative flex-1 min-w-0 flex items-center gap-[2px] h-8"
          aria-label="Waveform — click any bar to seek"
        >
          {bars.map((h, i) => {
            const played = i / BAR_COUNT < progress;
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); seekToFrac(i / BAR_COUNT); }}
                className="flex-1 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(h * 100, 12)}%`,
                  minHeight: 3,
                  background: played ? '#ef4444' : 'rgba(255, 255, 255, 0.20)',
                  boxShadow: played ? '0 0 8px rgba(239, 68, 68, 0.55)' : 'none',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                }}
                aria-label={`Seek to ${Math.round((i / BAR_COUNT) * 100)}%`}
              />
            );
          })}
        </div>

        {/* ── Time stamp ─────────────────────────────────────────────── */}
        <div className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-400 tabular-nums">
          {fmtTime(currentTime)}
          <span className="text-zinc-600 mx-0.5">/</span>
          {fmtTime(duration)}
        </div>

        {/* ── AI Scribe toggle ───────────────────────────────────────── */}
        <button
          onClick={(e) => { e.stopPropagation(); setTranscribeOpen((o) => !o); }}
          aria-label="Toggle AI transcription"
          aria-pressed={transcribeOpen}
          title="AI Scribe — read instead of listen"
          className="relative shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all"
          style={{
            background: transcribeOpen
              ? 'rgba(168, 85, 247, 0.18)'
              : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${transcribeOpen ? 'rgba(168, 85, 247, 0.6)' : 'rgba(255, 255, 255, 0.10)'}`,
            color: transcribeOpen ? '#d8b4fe' : 'rgba(255, 255, 255, 0.50)',
            boxShadow: transcribeOpen ? '0 0 10px rgba(168, 85, 247, 0.45)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (transcribeOpen) return;
            e.currentTarget.style.color = 'rgba(216, 180, 254, 0.9)';
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
          }}
          onMouseLeave={(e) => {
            if (transcribeOpen) return;
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.50)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.10)';
          }}
        >
          <Sparkles size={12} />
        </button>
      </div>

      {/* ── Expandable transcription pane ────────────────────────────── */}
      <AnimatePresence initial={false}>
        {transcribeOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl px-4 py-3 text-xs leading-relaxed relative"
              style={{
                background: 'rgba(5, 5, 5, 0.78)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(168, 85, 247, 0.22)',
                boxShadow: '0 0 18px rgba(168, 85, 247, 0.06)',
                color: 'rgba(255, 255, 255, 0.85)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={10} className="text-purple-300" />
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-purple-300">
                  AI Scribe
                </span>
              </div>
              {liveTranscription ? (
                <p className="text-white/85 whitespace-pre-wrap">{liveTranscription}</p>
              ) : scribeLoading ? (
                <p className="text-purple-300/70 italic flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" /> Transcribing…
                </p>
              ) : scribeError ? (
                <p className="text-zinc-500 italic">
                  {scribeError?.message || 'Transcription failed — try again in a moment.'}
                </p>
              ) : (
                <p className="text-zinc-500 italic">
                  Opening the Scribe…
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Play / Pause node ─────────────────────────────────────────────────────
// Pulled out so the hover treatment + size are reusable and the parent
// JSX stays shallow. Idle: hollow red ring on a translucent red wash.
// Playing: solid red fill with a soft outer glow.
function PlayButton({ playing, onClick }) {
  const [hover, setHover] = useState(false);
  const filled = playing || hover;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
      style={{
        background: filled ? '#ef4444' : 'rgba(239, 68, 68, 0.10)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        color: filled ? '#ffffff' : '#ef4444',
        boxShadow: filled ? '0 0 18px rgba(239, 68, 68, 0.55)' : 'none',
      }}
    >
      {playing
        ? <Pause size={16} fill="currentColor" />
        : <Play  size={16} fill="currentColor" className="ml-0.5" />}
    </button>
  );
}
