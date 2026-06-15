import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Volume2, VolumeX, Play, Pause, ExternalLink, X, Plus } from 'lucide-react';
import { entities } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import SpotifySearchModal from './SpotifySearchModal';

/**
 * ProfileAnthem — Spotify-powered version. The previous file-upload
 * implementation was deprecated after running into HTTP 429 rate limits
 * on the upload route plus the obvious DMCA exposure of hosting raw MP3s.
 *
 * Data model on UserProfile:
 *   anthem_spotify_id     — Spotify track ID
 *   anthem_name           — cached track title (read on every profile open
 *                           without hitting Spotify)
 *   anthem_artist         — cached artist name
 *   anthem_album_art_url  — cached album cover (Spotify CDN)
 *   anthem_preview_url    — cached 30s MP3 preview URL (Spotify CDN). Null
 *                           for the ~10–15% of tracks where the label has
 *                           blocked previews; UI falls back to "Open in
 *                           Spotify" for those tracks.
 *   anthem_external_url   — open.spotify.com/track/<id>, used by the
 *                           null-preview fallback button
 *   anthem_duration_ms    — cached track duration (always 30000 for
 *                           preview clips, but the field exists for
 *                           future "full track via Spotify Connect")
 *
 * Legacy `anthem_url` (the old file-upload field) is still read so any
 * profile created before this refactor keeps playing — but every NEW
 * write goes through Spotify only.
 *
 * Playback rules (per blueprint):
 *   • No autoplay attempt. The album-cover is the only thing that starts
 *     the music — visitor MUST click it. Removes the autoplay-blocked
 *     fight with Chrome / Safari mobile and the surprise-audio annoyance.
 *   • Single-instance audio — one anthem playing at a time across the
 *     whole tab (managed by a module-level guard so opening a second
 *     profile pauses the first one cleanly).
 *   • Visual feedback when playing: pause-icon overlay, mini equalizer
 *     next to the track name, glowing 30s progress bar.
 */

// Module-level "currently playing" ref so opening profile B pauses
// whatever was playing on profile A. Pure transient state, not persisted.
let _activeAudio = null;
function claimAudio(el) {
  if (_activeAudio && _activeAudio !== el) {
    try { _activeAudio.pause(); } catch {}
  }
  _activeAudio = el;
}
function releaseAudio(el) {
  if (_activeAudio === el) _activeAudio = null;
}

export default function ProfileAnthem({ userProfile, isOwnProfile }) {
  const audioRef = useRef(null);
  const queryClient = useQueryClient();

  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('spidr_anthem_muted') === '1'; } catch { return false; }
  });
  const [volume, setVolume] = useState(() => {
    try {
      const stored = parseInt(localStorage.getItem('spidr_anthem_volume') || '60', 10);
      return Number.isFinite(stored) ? Math.min(100, Math.max(0, stored)) : 60;
    } catch { return 60; }
  });
  const [progress, setProgress] = useState(0); // 0..1
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resolve the active anthem source. Prefer the Spotify preview when
  // present; fall back to a legacy uploaded `anthem_url` so users who
  // already had an anthem before the refactor don't lose it.
  const spotifyId      = userProfile?.anthem_spotify_id || '';
  const previewUrl     = userProfile?.anthem_preview_url || '';
  const legacyUrl      = userProfile?.anthem_url || '';
  const playableUrl    = previewUrl || legacyUrl;
  const externalUrl    = userProfile?.anthem_external_url ||
                         (spotifyId ? `https://open.spotify.com/track/${spotifyId}` : '');
  const trackName      = userProfile?.anthem_name || '';
  const trackArtist    = userProfile?.anthem_artist || '';
  const albumArtUrl    = userProfile?.anthem_album_art_url || '';
  const hasAnthem      = !!(spotifyId || legacyUrl);
  const previewBlocked = !!spotifyId && !previewUrl; // Spotify track with no preview clip

  // Sync the audio element with volume + muted state.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume / 100;
    el.muted = muted;
  }, [volume, muted, playableUrl]);

  // Stop playback if the anthem source changes (e.g. visitor swaps profiles
  // and a new ProfileAnthem mounts with a different track).
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (!el) return;
      try { el.pause(); el.currentTime = 0; } catch {}
      releaseAudio(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playableUrl]);

  // Persist preferences.
  useEffect(() => {
    try { localStorage.setItem('spidr_anthem_volume', String(volume)); } catch {}
  }, [volume]);
  useEffect(() => {
    try { localStorage.setItem('spidr_anthem_muted', muted ? '1' : '0'); } catch {}
  }, [muted]);

  // Drive the progress bar via timeupdate (lightweight, fires several
  // times per second). Resets to 0 on end so the visual matches the loop.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!el.duration || !isFinite(el.duration)) { setProgress(0); return; }
      setProgress(Math.min(1, el.currentTime / el.duration));
    };
    const onEnd = () => { setPlaying(false); setProgress(0); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, [playableUrl]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !playableUrl) return;
    if (el.paused) {
      claimAudio(el);
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  // ── Saving a new anthem (from search modal) ─────────────────────────
  const handleSelectTrack = async (track) => {
    if (!track?.id) return;
    setSaving(true);
    try {
      await entities.UserProfile.update(userProfile.id, {
        anthem_spotify_id:    track.id,
        anthem_name:          track.name || '',
        anthem_artist:        track.artist || '',
        anthem_album_art_url: track.album_art_url || '',
        anthem_preview_url:   track.preview_url || '',
        anthem_external_url:  track.external_url || `https://open.spotify.com/track/${track.id}`,
        anthem_duration_ms:   track.duration_ms || 30000,
        anthem_url:           '', // clear any legacy upload
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Anthem set!');
      setSearchOpen(false);
    } catch (err) {
      console.error('[ProfileAnthem] save failed:', err);
      toast.error(err?.message || 'Could not save anthem');
    } finally {
      setSaving(false);
    }
  };

  const clearAnthem = async () => {
    try {
      await entities.UserProfile.update(userProfile.id, {
        anthem_spotify_id:    '',
        anthem_name:          '',
        anthem_artist:        '',
        anthem_album_art_url: '',
        anthem_preview_url:   '',
        anthem_external_url:  '',
        anthem_duration_ms:   0,
        anthem_url:           '',
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast('Anthem removed');
    } catch (err) {
      console.error('[ProfileAnthem] clear failed:', err);
      toast.error('Could not remove');
    }
  };

  // ── Render: empty state on own profile ──────────────────────────────
  if (!hasAnthem) {
    if (!isOwnProfile) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="w-full p-2.5 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/40 transition-colors flex items-center gap-2.5 text-left"
          style={{ background: 'rgba(0, 0, 0, 0.30)' }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(34, 197, 94, 0.10)', border: '1px solid rgba(34, 197, 94, 0.30)' }}
          >
            <Plus size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold">Set a profile anthem</p>
            <p className="text-zinc-500 text-[10px] mt-0.5">Pick a Spotify track — 30s preview plays on your profile</p>
          </div>
        </button>
        <SpotifySearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSelectTrack}
          currentSelectedId={spotifyId}
        />
      </>
    );
  }

  // ── Render: active anthem ───────────────────────────────────────────
  return (
    <>
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
        {/* Hidden audio. preload="none" so we don't fetch the preview MP3
            until the visitor actually clicks play — keeps profile-open
            cheap. */}
        {playableUrl && (
          <audio
            ref={audioRef}
            src={playableUrl}
            preload="none"
            onPlay={() => { claimAudio(audioRef.current); setPlaying(true); }}
            onPause={() => { setPlaying(false); }}
          />
        )}

        <div className="flex items-center gap-3">
          {/* Album art is the play target. Per blueprint: "visitor has to
              manually click the album art to start the music". */}
          {previewBlocked ? (
            // Spotify track without a preview clip — replace play target
            // with an external-link to the track on Spotify so the
            // visitor can still find it.
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 group block"
              title="Preview unavailable — open on Spotify"
            >
              {albumArtUrl ? (
                <img src={albumArtUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                  <Music size={14} className="text-zinc-600" />
                </div>
              )}
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity opacity-80 group-hover:opacity-100"
                style={{ background: 'rgba(0, 0, 0, 0.55)' }}
              >
                <ExternalLink size={14} className="text-emerald-300" />
              </div>
            </a>
          ) : (
            <button
              type="button"
              onClick={togglePlay}
              disabled={!playableUrl}
              className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 group"
              title={playing ? 'Pause anthem' : 'Play anthem'}
              aria-label={playing ? 'Pause anthem' : 'Play anthem'}
            >
              {albumArtUrl ? (
                <img src={albumArtUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(124, 58, 237, 0.20))',
                  }}
                >
                  <Music size={16} className="text-emerald-300" />
                </div>
              )}
              {/* Frosted glass play / pause overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity"
                style={{
                  background: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(2px)',
                  WebkitBackdropFilter: 'blur(2px)',
                  // Always at least faintly visible (so user knows it's
                  // clickable), full on hover or while playing.
                  opacity: playing ? 1 : (hovered ? 1 : 0.55),
                }}
              >
                {playing
                  ? <Pause size={14} className="text-white" />
                  : <Play size={14} className="text-white ml-0.5" />}
              </div>
            </button>
          )}

          {/* Track meta + equalizer */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-white text-xs font-bold truncate min-w-0">
                {trackName || 'Anthem'}
              </p>
              {playing && <Equalizer />}
            </div>
            <p className="text-zinc-500 text-[11px] truncate">
              {trackArtist || (previewBlocked ? 'Preview unavailable' : 'Tap album art to play')}
            </p>
          </div>

          {/* Mute toggle */}
          {!previewBlocked && (
            <button
              type="button"
              onClick={() => setMuted(m => !m)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
              aria-label={muted ? 'Unmute anthem' : 'Mute anthem'}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          )}

          {/* Own-profile change / remove cluster */}
          {isOwnProfile && (
            <>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                title="Change anthem"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 flex-shrink-0"
                aria-label="Change anthem"
              >
                <Music size={12} />
              </button>
              <button
                type="button"
                onClick={clearAnthem}
                title="Remove anthem"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                aria-label="Remove anthem"
              >
                <X size={12} />
              </button>
            </>
          )}
        </div>

        {/* Progress bar — only while a real preview is loaded. The bar
            spans the bottom of the card with a glowing red fill that
            tracks audio.currentTime / audio.duration. */}
        {!previewBlocked && playableUrl && (
          <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
            <div
              className="h-full transition-[width] duration-150 ease-linear"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #ef4444 0%, #f97316 100%)',
                boxShadow: progress > 0 ? '0 0 8px rgba(239, 68, 68, 0.55)' : 'none',
              }}
            />
          </div>
        )}

        {/* Hover-revealed volume slider */}
        <AnimatePresence>
          {hovered && !muted && !previewBlocked && (
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
                  -webkit-appearance: none; appearance: none;
                  width: 10px; height: 10px; border-radius: 50%;
                  background: #fff; cursor: pointer;
                  box-shadow: 0 0 6px rgba(239, 68, 68, 0.55);
                }
                .spidr-anthem-slider::-moz-range-thumb {
                  width: 10px; height: 10px; border-radius: 50%;
                  background: #fff; cursor: pointer; border: 0;
                  box-shadow: 0 0 6px rgba(239, 68, 68, 0.55);
                }
              `}</style>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal mount — only when own profile and search open. */}
      {isOwnProfile && (
        <SpotifySearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSelectTrack}
          currentSelectedId={spotifyId}
        />
      )}
    </>
  );
}

/**
 * Equalizer — 3-bar mini visualization that lives next to the track
 * title while playing. Pure CSS, no audio analysis (a real FFT would
 * burn far too much CPU for a 12px decorative element).
 */
function Equalizer() {
  return (
    <span className="inline-flex items-end gap-[2px] h-3 ml-1 flex-shrink-0" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-emerald-400 rounded-sm"
          style={{
            animation: `spidr-eq 0.9s ease-in-out ${i * 0.12}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
      <style>{`
        @keyframes spidr-eq {
          0%, 100% { height: 30%; }
          50%      { height: 100%; }
        }
      `}</style>
    </span>
  );
}
