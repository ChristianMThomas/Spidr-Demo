import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Disc3 } from 'lucide-react';
import useNowPlaying from '@/hooks/useNowPlaying';
import { toast } from 'sonner';

/**
 * SonicUplinkCard — the profile-page "Listening to" widget. Spotify
 * green eyebrow, album art with a soft Spotify-green drop-shadow, track
 * name + artist, live progress bar (ticks per second via useNowPlaying),
 * and a "Sync Audio" pill.
 *
 * Sync semantics (read carefully):
 *   The Sync Audio button is a UI intent. Actually playing the same
 *   stream in lockstep on a visitor's machine requires the Spotify Web
 *   Playback SDK + Spotify Premium on the visitor's account. This
 *   widget fires a `spidr-sonic-uplink-sync` window event with the
 *   { track_id, host_id } payload so wherever you wire Web Playback
 *   later can pick it up. For now, clicking the button opens the
 *   track on Spotify in a new tab (graceful fallback).
 *
 * @param {string} userId         Whose now-playing to display
 * @param {string} userName       For display + accessibility
 * @param {string} userAvatarUrl  Used in the small header
 */
export default function SonicUplinkCard({ userId, userName, userAvatarUrl }) {
  const np = useNowPlaying(userId);
  const [synced, setSynced] = useState(false);

  // Render nothing if the user isn't streaming. Profile pages should
  // call this in a layout where collapsing to empty doesn't break the
  // flow — same pattern as NowPlayingPulse.
  if (!np || !np.is_playing) return null;

  const handleSync = () => {
    setSynced(true);
    // Fire intent — Web Playback SDK can pick this up later.
    window.dispatchEvent(new CustomEvent('spidr-sonic-uplink-sync', {
      detail: { track_id: np.track_id, host_id: userId, started_at: np.sampled_at },
    }));
    toast.success('Synced to Sonic Uplink');
    // Open the track on Spotify as the universal fallback.
    if (np.spotify_url) {
      try { window.open(np.spotify_url, '_blank', 'noopener,noreferrer'); } catch {}
    }
    // Drop the visual "synced" badge after 6s so users can re-sync
    // when the track changes.
    setTimeout(() => setSynced(false), 6000);
  };

  const pct = np.duration_ms ? Math.min(100, (np.progress_ms / np.duration_ms) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm rounded-3xl p-4 flex flex-col gap-3 overflow-hidden"
      style={{
        background: 'rgba(10, 10, 10, 0.90)',
        backdropFilter: 'blur(48px)',
        WebkitBackdropFilter: 'blur(48px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Header — avatar + name + live eq + "Sonic Uplink" eyebrow */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: '#111', border: '1px solid rgba(255, 255, 255, 0.10)' }}
          >
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-bold">{(userName || '?').charAt(0)}</span>
            )}
          </div>
          {/* Spotify-green corner dot indicating live audio */}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#1DB954]"
            style={{ boxShadow: '0 0 6px rgba(29, 185, 84, 0.7)', border: '1.5px solid #0a0a0a' }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">{userName || 'Spider'}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#1DB954] mt-0.5 flex items-center gap-1.5">
            <Equalizer />
            Sonic Uplink
          </p>
        </div>
      </div>

      {/* Track stage — album art with a green-tinted halo + vinyl peek */}
      <div
        className="relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden"
        style={{
          background: 'rgba(5, 5, 5, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Soft gradient backdrop */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.20) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          {/* Album art + spinning vinyl behind */}
          <div className="relative w-20 h-20 shrink-0">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: '#0a0a0a',
                border: '4px solid #111',
                transform: 'translateX(10px)',
                animation: 'spidr-vinyl-spin 10s linear infinite',
              }}
            >
              <span
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', border: '1px solid #222' }}
              />
              <span
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#050505]"
              />
            </div>
            {np.album_art_url ? (
              <img
                src={np.album_art_url}
                alt=""
                className="relative w-20 h-20 rounded-xl object-cover z-10"
                style={{ boxShadow: '0 0 24px rgba(29, 185, 84, 0.30)', border: '1px solid rgba(255, 255, 255, 0.10)' }}
              />
            ) : (
              <div
                className="relative w-20 h-20 rounded-xl z-10 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                  boxShadow: '0 0 24px rgba(29, 185, 84, 0.30)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                }}
              >
                <Disc3 className="w-7 h-7 text-white/70" />
              </div>
            )}
            <style>{`
              @keyframes spidr-vinyl-spin {
                from { transform: translateX(10px) rotate(0deg); }
                to   { transform: translateX(10px) rotate(360deg); }
              }
            `}</style>
          </div>

          {/* Track meta */}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/40 flex items-center gap-1 mb-1">
              <SpotifyGlyph />
              Spotify
            </p>
            <h3 className="text-white font-bold text-sm truncate">{np.track_name}</h3>
            <p className="text-white/60 text-xs truncate">{np.artist}</p>
          </div>
        </div>

        {/* Progress + time */}
        <div className="relative z-10 flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] text-white/40 font-mono">
            <span>{formatMs(np.progress_ms)}</span>
            <span>{formatMs(np.duration_ms)}</span>
          </div>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255, 255, 255, 0.08)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-linear"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.55) 0%, #ffffff 100%)',
              }}
            />
          </div>
        </div>

        {/* Sync Audio button */}
        <button
          type="button"
          onClick={handleSync}
          disabled={synced}
          className={`relative z-10 w-full py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
            synced
              ? 'bg-[#1DB954] text-black animate-pulse'
              : 'bg-[#1DB954]/10 border border-[#1DB954]/50 text-[#1DB954] hover:bg-[#1DB954] hover:text-black'
          }`}
          style={{
            boxShadow: synced
              ? '0 0 22px rgba(29, 185, 84, 0.55)'
              : '0 0 15px rgba(29, 185, 84, 0.10)',
          }}
        >
          {synced ? (
            <>
              <Equalizer dark />
              Synced
            </>
          ) : (
            <>
              <ExternalLink className="w-3.5 h-3.5" />
              Sync Audio
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function Equalizer({ dark = false }) {
  const color = dark ? '#020202' : '#1DB954';
  return (
    <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] rounded-sm"
          style={{
            background: color,
            animation: `spidr-eq-pulse 0.9s ease-in-out ${i * 0.13}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </span>
  );
}

function SpotifyGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="#1DB954" aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15.001 10.62 18.72 12.9c.361.181.54.84.24 1.14zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.239.54-.959.72-1.56.3z"/>
    </svg>
  );
}

function formatMs(ms) {
  if (!ms || !isFinite(ms)) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
