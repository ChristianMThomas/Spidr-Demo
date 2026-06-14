import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Volume2, VolumeX, Play, Pause, Upload, X, Loader2 } from 'lucide-react';
import { entities, integrations } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * ProfileAnthem — frosted glass widget that lives under a profile's bio
 * and plays an audio anthem the user has uploaded. Designed to bring the
 * "MySpace song" vibe back without subjecting the visitor to surprise audio.
 *
 * Browser autoplay policy:
 *   Chromium / Safari block <audio autoplay> with sound until the page
 *   has user interaction. We don't fight it — the widget starts muted by
 *   default, the visitor sees a glowing PLAY button, and one click does
 *   both: unmutes (or starts) playback.
 *
 * Persistent preferences:
 *   • spidr_anthem_volume   — 0–100 slider position, restored across sessions
 *   • spidr_anthem_muted    — boolean override; if the visitor mutes once,
 *                             every subsequent profile opens muted
 *
 * Cross-page state:
 *   Each profile-modal mount creates its own <audio> element — when the
 *   user closes the profile, the element is unmounted and the song stops.
 *   This is deliberate; trying to keep audio playing while the user is
 *   browsing elsewhere is more annoying than not-playing.
 */
export default function ProfileAnthem({ userProfile, isOwnProfile, currentUser }) {
  const audioRef = useRef(null);
  const queryClient = useQueryClient();

  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('spidr_anthem_muted') === '1'; } catch { return true; }
  });
  const [volume, setVolume] = useState(() => {
    try {
      const stored = parseInt(localStorage.getItem('spidr_anthem_volume') || '60', 10);
      return Number.isFinite(stored) ? Math.min(100, Math.max(0, stored)) : 60;
    } catch { return 60; }
  });
  const [uploading, setUploading] = useState(false);

  const anthemUrl  = userProfile?.anthem_url || '';
  const anthemName = userProfile?.anthem_name || '';
  const anthemArt  = userProfile?.anthem_art_url || '';

  // Sync volume / muted into the actual <audio> element.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume / 100;
    el.muted  = muted;
  }, [volume, muted, anthemUrl]);

  // Auto-attempt playback when the audio mounts. Browsers will silently
  // reject if not muted; we catch that and just stay paused — the user
  // can hit play / unmute manually.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !anthemUrl) return;
    el.muted = muted;
    el.volume = volume / 100;
    el.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
    // Clean up when the audio source changes or the widget unmounts —
    // stop playback so the song doesn't keep going from a stale element.
    return () => {
      try { el.pause(); el.currentTime = 0; } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anthemUrl]);

  // Persist preferences as the user adjusts them.
  useEffect(() => {
    try { localStorage.setItem('spidr_anthem_volume', String(volume)); } catch {}
  }, [volume]);
  useEffect(() => {
    try { localStorage.setItem('spidr_anthem_muted', muted ? '1' : '0'); } catch {}
  }, [muted]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      // First-click unmute — if the visitor is muted by default and they
      // press play, treat that as their intent to actually hear it.
      if (muted) setMuted(false);
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  // ── Upload (own profile only) ────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Please pick an audio file (mp3, m4a, ogg, wav).');
      return;
    }
    // 8MB ceiling — keeps the profile-open download reasonable. Bigger
    // tracks should be hosted externally and linked in the bio.
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Audio file is too large — keep it under 8MB.');
      return;
    }
    setUploading(true);
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
      await entities.UserProfile.update(userProfile.id, {
        anthem_url: url,
        anthem_name: cleanName,
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Anthem saved!');
    } catch (err) {
      console.error('[ProfileAnthem] upload failed:', err);
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const clearAnthem = async () => {
    try {
      await entities.UserProfile.update(userProfile.id, {
        anthem_url: '',
        anthem_name: '',
        anthem_art_url: '',
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast('Anthem removed');
    } catch (err) {
      console.error('[ProfileAnthem] clear failed:', err);
      toast.error('Could not remove');
    }
  };

  // ── Render: empty state on own profile (upload prompt) ───────────────
  if (!anthemUrl) {
    if (!isOwnProfile) return null;
    return (
      <label className="block cursor-pointer">
        <div
          className="p-2.5 rounded-xl border border-dashed border-white/10 hover:border-red-500/40 transition-colors flex items-center gap-2.5"
          style={{ background: 'rgba(0, 0, 0, 0.30)' }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(239, 68, 68, 0.10)',
              border: '1px solid rgba(239, 68, 68, 0.30)',
            }}
          >
            {uploading
              ? <Loader2 size={14} className="text-red-400 animate-spin" />
              : <Upload size={14} className="text-red-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold">Add a profile anthem</p>
            <p className="text-zinc-500 text-[10px] mt-0.5">Plays when someone opens your profile</p>
          </div>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </div>
      </label>
    );
  }

  // ── Render: active anthem ────────────────────────────────────────────
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative p-2.5 rounded-xl overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <audio
        ref={audioRef}
        src={anthemUrl}
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="flex items-center gap-2.5">
        {/* Album art / play-pause toggle */}
        <button
          type="button"
          onClick={togglePlay}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden group"
          style={{
            background: anthemArt ? 'transparent' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.20), rgba(124, 58, 237, 0.20))',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
          aria-label={playing ? 'Pause anthem' : 'Play anthem'}
        >
          {anthemArt ? (
            <img src={anthemArt} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music size={14} className="text-red-400" />
          )}
          {/* Hover overlay reveals play/pause glyph */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity"
            style={{
              background: 'rgba(0, 0, 0, 0.55)',
              opacity: hovered ? 1 : (playing ? 0 : 0.6),
            }}
          >
            {playing
              ? <Pause size={12} className="text-white" />
              : <Play size={12} className="text-white ml-0.5" />}
          </div>
        </button>

        {/* Name + status line */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">
            {anthemName || 'Anthem'}
          </p>
          <p className="text-zinc-500 text-[10px] flex items-center gap-1">
            <motion.span
              className="w-1 h-1 rounded-full bg-emerald-500"
              animate={playing ? { opacity: [1, 0.3, 1] } : { opacity: 0.3 }}
              transition={playing ? { duration: 1.4, repeat: Infinity } : {}}
            />
            <span className="font-mono uppercase tracking-widest">
              {playing ? 'Now playing' : muted ? 'Muted' : 'Paused'}
            </span>
          </p>
        </div>

        {/* Mute toggle — always visible so the visitor never has to hunt
            for it. The volume slider reveals on hover so the widget stays
            compact in its default state. */}
        <button
          type="button"
          onClick={() => setMuted(m => !m)}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-white/70 hover:text-white hover:bg-white/10"
          aria-label={muted ? 'Unmute anthem' : 'Mute anthem'}
        >
          {muted
            ? <VolumeX size={12} />
            : <Volume2 size={12} />}
        </button>

        {/* Own-profile remove */}
        {isOwnProfile && (
          <button
            type="button"
            onClick={clearAnthem}
            title="Remove anthem"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
            aria-label="Remove anthem"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Hover-revealed volume slider */}
      <AnimatePresence>
        {hovered && !muted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-center gap-2">
              <Volume2 size={10} className="text-zinc-500 flex-shrink-0" />
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                className="flex-1 spidr-anthem-slider"
              />
              <span className="text-[9px] font-mono text-zinc-500 w-6 text-right tabular-nums">
                {volume}
              </span>
            </div>
            <style>{`
              .spidr-anthem-slider {
                -webkit-appearance: none;
                appearance: none;
                height: 3px;
                border-radius: 2px;
                background: linear-gradient(to right,
                  #ef4444 0%, #ef4444 ${volume}%,
                  rgba(255,255,255,0.10) ${volume}%, rgba(255,255,255,0.10) 100%);
                outline: none;
              }
              .spidr-anthem-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 10px; height: 10px;
                border-radius: 50%;
                background: #fff;
                box-shadow: 0 0 6px rgba(239, 68, 68, 0.55);
                cursor: pointer;
              }
              .spidr-anthem-slider::-moz-range-thumb {
                width: 10px; height: 10px;
                border-radius: 50%;
                background: #fff;
                border: 0;
                box-shadow: 0 0 6px rgba(239, 68, 68, 0.55);
                cursor: pointer;
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
