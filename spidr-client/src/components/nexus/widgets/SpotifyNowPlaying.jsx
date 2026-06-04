import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Music2, ExternalLink, Unlink, RefreshCw, Settings } from 'lucide-react';
import { entities } from '@/api/apiClient';
import { useNavigate } from 'react-router-dom';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function authFetch(path, options = {}) {
  const token = localStorage.getItem('spidr_token');
  return fetch(BASE_URL + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Animated equalizer bars — shown when playing
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

export default function SpotifyNowPlaying({ userId, isOwnProfile }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Load user profile to check connection state
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn:  async () => {
      const res = await entities.UserProfile.filter({ user_id: userId });
      return res?.[0] ?? null;
    },
    enabled: !!userId,
  });

  const connected = !!profile?.neural_links?.spotify_connected;

  // Fetch now-playing — only when connected
  const { data: np, isLoading: npLoading, refetch } = useQuery({
    queryKey:       ['spotify-now-playing', userId],
    queryFn:        async () => {
      const res = await authFetch('/spotify/now-playing');
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    },
    enabled:        connected,
    refetchInterval: 30_000,
    staleTime:       25_000,
    retry:           1,
  });

  // Live progress interpolation between 30s polls
  const [progress, setProgress] = useState(0);
  const pRef = useRef({ base: 0, t0: 0, playing: false });

  useEffect(() => {
    if (!np?.track) return;
    pRef.current = { base: np.track.progress || 0, t0: Date.now(), playing: np.playing };
    setProgress(np.track.progress || 0);
  }, [np]);

  useEffect(() => {
    if (!np?.playing) return;
    const id = setInterval(() => {
      const { base, t0 } = pRef.current;
      setProgress(Math.min(base + (Date.now() - t0), np?.track?.duration || 0));
    }, 1000);
    return () => clearInterval(id);
  }, [np?.playing, np?.track?.id]);

  const handleDisconnect = async () => {
    await authFetch('/spotify/auth/disconnect', { method: 'DELETE' });
    queryClient.removeQueries({ queryKey: ['spotify-now-playing', userId] });
    queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
  };

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!profileLoading && !connected) {
    return (
      <div className="bg-[#0d0d1a] border border-white/10 rounded-xl overflow-hidden min-h-[120px] flex flex-col items-center justify-center gap-3 p-5">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#1DB954]/40">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Spotify Now Playing</span>
        </div>
        {isOwnProfile ? (
          <button
            onClick={() => navigate('/settings?tab=connections')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors"
          >
            <Settings size={10} /> Connect in Settings → Neural
          </button>
        ) : (
          <p className="text-[9px] text-gray-600 uppercase tracking-widest">Not connected</p>
        )}
      </div>
    );
  }

  if (profileLoading || npLoading) {
    return (
      <div className="bg-[#0d0d1a] border border-white/10 rounded-xl min-h-[120px] flex items-center justify-center">
        <div className="w-4 h-4 rounded-full border-2 border-[#1DB954]/30 border-t-[#1DB954] animate-spin" />
      </div>
    );
  }

  const track = np?.track;
  const playing = np?.playing;
  const pct = track ? Math.round((progress / track.duration) * 100) : 0;

  // ── Token expired — show reconnect prompt ────────────────────────────────
  if (np?.error === 'quota_exceeded') {
    return (
      <div className="bg-[#0d0a00] border border-[#1DB954]/30 rounded-xl overflow-hidden p-5 flex flex-col gap-3"
           style={{ boxShadow: '0 0 20px rgba(29,185,84,0.08)' }}>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#1DB954]/60 shrink-0">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span className="text-[11px] font-black text-[#1DB954]/80 uppercase tracking-widest">Spotify — Access Limited</span>
        </div>
        <p className="text-[11px] text-gray-300 leading-relaxed">
          Spidr's Spotify integration is currently in <span className="text-[#1DB954] font-bold">development mode</span> — only allowlisted accounts can stream live data.
        </p>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Help us unlock it for everyone — we need <span className="text-white/70 font-bold">250,000 users</span> to qualify for full public access. Share Spidr with a friend and get us closer to the goal.
        </p>
        <button
          onClick={() => {}}
          className="self-start px-3 py-1.5 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/20 text-[#1DB954] text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors"
        >
          Ok
        </button>
      </div>
    );
  }

  if (np?.error === 'token_expired') {
    return (
      <div className="bg-[#0a0a0f] border border-red-500/20 rounded-xl overflow-hidden min-h-[100px] flex flex-col items-center justify-center gap-2 p-4">
        <Unlink size={20} className="text-red-400/60" />
        <p className="text-[10px] font-mono text-red-400/70 uppercase tracking-widest">Connection expired</p>
        {isOwnProfile && (
          <button
            onClick={() => navigate('/settings?tab=connections')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors mt-1"
          >
            <Settings size={10} /> Reconnect
          </button>
        )}
      </div>
    );
  }

  // ── Connected — no track ──────────────────────────────────────────────────
  if (!track) {
    return (
      <div className="bg-[#0a0a0f] border border-[#1DB954]/20 rounded-xl overflow-hidden min-h-[100px] flex flex-col items-center justify-center gap-2 p-4">
        <Music2 size={20} className="text-[#1DB954]/40" />
        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Nothing playing</p>
        {isOwnProfile && (
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => refetch()} className="text-gray-700 hover:text-[#1DB954] transition-colors" title="Refresh">
              <RefreshCw size={11} />
            </button>
            <button onClick={handleDisconnect} className="text-gray-700 hover:text-red-500 transition-colors" title="Disconnect">
              <Unlink size={11} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Connected — track playing or recently played ──────────────────────────
  return (
    <div className="bg-[#0a0a0f] border border-[#1DB954]/25 rounded-xl overflow-hidden relative"
         style={{ boxShadow: '0 0 24px rgba(29,185,84,0.1)' }}>

      {/* Album art full-bleed background */}
      {track.albumArt && (
        <img
          src={track.albumArt}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10 blur-sm pointer-events-none select-none"
          draggable={false}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/95 via-[#0a0a0f]/80 to-[#0a0a0f]/95" />

      <div className="relative z-10 p-4 flex flex-col gap-3">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#1DB954] shrink-0">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span className="text-[9px] font-black text-[#1DB954] uppercase tracking-widest">
              {playing ? 'Now Playing' : 'Last Played'}
            </span>
            {playing && <EqBars />}
          </div>
          <div className="flex items-center gap-2">
            {track.url && (
              <a href={track.url} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-[#1DB954] transition-colors">
                <ExternalLink size={11} />
              </a>
            )}
            {isOwnProfile && (
              <button onClick={handleDisconnect} className="text-gray-700 hover:text-red-500 transition-colors" title="Disconnect Spotify">
                <Unlink size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Track info */}
        <div className="flex items-center gap-3">
          {track.albumArt ? (
            <img src={track.albumArt} alt={track.album} className="w-12 h-12 rounded-lg object-cover shrink-0 shadow-lg" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Music2 size={20} className="text-[#1DB954]/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm leading-tight truncate">{track.name}</p>
            <p className="text-gray-400 text-[11px] truncate mt-0.5">{track.artist}</p>
            <p className="text-gray-600 text-[10px] truncate">{track.album}</p>
          </div>
        </div>

        {/* Progress bar */}
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
            <span>{fmtTime(track.duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
