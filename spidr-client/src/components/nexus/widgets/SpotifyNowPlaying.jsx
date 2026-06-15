import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Music2, ExternalLink, Unlink } from 'lucide-react';
import { entities } from '@/api/apiClient';
import { useNowPlaying } from '@/context/NowPlayingContext';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function authFetch(path, options = {}) {
  const token = localStorage.getItem('spidr_token');
  return fetch(BASE_URL + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}

function fmtTime(ms) {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function EqBars() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0.6, 1, 0.75, 0.9, 0.5].map((h, i) => (
        <motion.div
          key={i}
          className="w-[2px] bg-[#1DB954] rounded-full"
          animate={{ scaleY: [h, 1, h * 0.6, 1, h] }}
          transition={{ repeat: Infinity, duration: 0.8 + i * 0.1, ease: 'easeInOut' }}
          style={{ height: '100%', originY: 1 }}
        />
      ))}
    </div>
  );
}

const SpotifyIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export default function SpotifyNowPlaying({ userId, isOwnProfile }) {
  const queryClient = useQueryClient();
  const { ownNowPlaying, getPosition } = useNowPlaying();

  // Profile query is non-blocking — only used to show the Disconnect button
  // when the user has previously connected Spotify (does not gate the widget)
  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn:  async () => {
      const res = await entities.UserProfile.filter({ user_id: userId });
      return res?.[0] ?? null;
    },
    enabled:   !!userId && !!isOwnProfile,
    staleTime: 60_000,
  });

  const spotifyConnected = !!profile?.neural_links?.spotify_connected;

  // Live progress — updates every second from extrapolated position
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!ownNowPlaying?.isPlaying) {
      setProgress(ownNowPlaying?.positionMs ?? 0);
      return;
    }
    setProgress(getPosition(ownNowPlaying));
    const id = setInterval(() => setProgress(getPosition(ownNowPlaying)), 1000);
    return () => clearInterval(id);
  }, [ownNowPlaying?.trackName, ownNowPlaying?.isPlaying, ownNowPlaying?.positionAt, getPosition]);

  const handleDisconnect = useCallback(async () => {
    await authFetch('/spotify/auth/disconnect', { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
  }, [queryClient, userId]);

  const np = ownNowPlaying;
  const isActive = np?.isPlaying && np?.trackName;

  // ── Nothing playing / Electron not running / no media session ────────────
  if (!isActive) {
    return (
      <div className="bg-[#0a0a0f] border border-[#1DB954]/20 rounded-xl overflow-hidden min-h-[100px] flex flex-col items-center justify-center gap-2 p-4">
        <Music2 size={20} className="text-[#1DB954]/40" />
        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Nothing playing</p>
        {isOwnProfile && spotifyConnected && (
          <button
            onClick={handleDisconnect}
            className="text-gray-700 hover:text-red-500 transition-colors mt-1"
            title="Disconnect Spotify"
          >
            <Unlink size={11} />
          </button>
        )}
      </div>
    );
  }

  const artists = Array.isArray(np.artists) && np.artists.length > 0
    ? np.artists.join(', ')
    : (np.artist || '');
  const pct = np.durationMs ? Math.min(100, Math.round((progress / np.durationMs) * 100)) : 0;

  // Deep-link for T1+ enriched tracks (trackUri = 'spotify:track:<id>')
  const spotifyTrackUrl = np.trackUri
    ? `https://open.spotify.com/track/${np.trackUri.replace('spotify:track:', '')}`
    : null;

  // ── Track active ─────────────────────────────────────────────────────────
  return (
    <div
      className="bg-[#0a0a0f] border border-[#1DB954]/25 rounded-xl overflow-hidden relative"
      style={{ boxShadow: '0 0 24px rgba(29,185,84,0.1)' }}
    >
      {np.albumArt && (
        <img
          src={np.albumArt}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10 blur-sm pointer-events-none select-none"
          draggable={false}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/95 via-[#0a0a0f]/80 to-[#0a0a0f]/95" />

      <div className="relative z-10 p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 size={14} className="text-[#1DB954] shrink-0" />
            <span className="text-[9px] font-black text-[#1DB954] uppercase tracking-widest">Now Playing</span>
            <EqBars />
          </div>
          <div className="flex items-center gap-2">
            {spotifyTrackUrl && (
              <a
                href={spotifyTrackUrl}
                target="_blank"
                rel="noreferrer"
                className="text-gray-600 hover:text-[#1DB954] transition-colors"
                title="Open in Spotify"
              >
                <SpotifyIcon className="w-3 h-3 fill-current" />
              </a>
            )}
            {!spotifyTrackUrl && np.trackName && (
              <a
                href={`https://open.spotify.com/search/${encodeURIComponent(`${artists} ${np.trackName}`)}`}
                target="_blank"
                rel="noreferrer"
                className="text-gray-700 hover:text-[#1DB954] transition-colors"
                title="Search on Spotify"
              >
                <ExternalLink size={11} />
              </a>
            )}
            {isOwnProfile && spotifyConnected && (
              <button
                onClick={handleDisconnect}
                className="text-gray-700 hover:text-red-500 transition-colors"
                title="Disconnect Spotify"
              >
                <Unlink size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Track info */}
        <div className="flex items-center gap-3">
          {np.albumArt ? (
            <img src={np.albumArt} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 shadow-lg" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Music2 size={20} className="text-[#1DB954]/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm leading-tight truncate">{np.trackName}</p>
            {artists && <p className="text-gray-400 text-[11px] truncate mt-0.5">{artists}</p>}
          </div>
        </div>

        {/* Progress bar — only shown when we have duration data */}
        {np.durationMs > 0 && (
          <div className="flex flex-col gap-1">
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#1DB954] rounded-full"
                style={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'linear' }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-600 font-mono">
              <span>{fmtTime(progress)}</span>
              <span>{fmtTime(np.durationMs)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
