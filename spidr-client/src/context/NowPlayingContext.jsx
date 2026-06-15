import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSocket } from '@/api/apiClient';

const NowPlayingContext = createContext(null);
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function NowPlayingProvider({ children }) {
  const [ownNowPlaying, setOwnNowPlaying]     = useState(null);
  const [peersNowPlaying, setPeersNowPlaying] = useState(new Map());

  // T1: Electron OS media session (Windows SMTC via IPC) — reads ANY media
  // playing on the OS, no Spotify account required.
  useEffect(() => {
    if (!window.electronAPI?.onNowPlayingChange) return;
    const cleanup = window.electronAPI.onNowPlayingChange((data) => {
      const hasTrack = data?.trackName && String(data.trackName).trim();
      setOwnNowPlaying(hasTrack ? data : null);
      const socket = getSocket();
      if (hasTrack) {
        socket.emit('nowplaying:update', data);
      } else {
        socket.emit('nowplaying:clear');
      }
    });
    return cleanup;
  }, []);

  // T2: Web — poll the Spotify Web API via spidr-server every 10s. The
  // browser is sandboxed and can't read the OS media session, so the only
  // option is to ask Spotify what the user is playing. The server already
  // handles OAuth, token refresh, and "no active player" → recently-played
  // fallback. We shape the response to match the Electron SMTC payload so
  // SpotifyNowPlaying.jsx doesn't have to care which source it came from.
  useEffect(() => {
    if (window.electronAPI?.isElectron) return; // Electron uses SMTC

    let cancelled = false;
    let lastKey = '';

    const poll = async () => {
      const token = localStorage.getItem('spidr_token');
      if (!token) return;

      try {
        const res = await fetch(`${BASE_URL}/spotify/now-playing`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        // Not connected, no track, or backend error → clear local state
        if (!data.connected || !data.track) {
          setOwnNowPlaying(null);
          if (lastKey !== '__clear__') {
            lastKey = '__clear__';
            try { getSocket().emit('nowplaying:clear'); } catch {}
          }
          return;
        }

        const np = {
          source:     'spotify-web',
          trackName:  data.track.name,
          artist:     data.track.artist,
          artists:    data.track.artist ? data.track.artist.split(', ') : [],
          albumArt:   data.track.albumArt,
          durationMs: data.track.duration,
          positionMs: data.track.progress,
          positionAt: new Date().toISOString(),
          isPlaying:  !!data.track.playing,
          trackUri:   data.track.id ? `spotify:track:${data.track.id}` : null,
        };
        setOwnNowPlaying(np);

        // Broadcast track changes to peers — same socket events as Electron
        const key = `${np.trackName}-${np.isPlaying}`;
        if (key !== lastKey) {
          lastKey = key;
          try {
            const socket = getSocket();
            socket.emit(np.isPlaying ? 'nowplaying:update' : 'nowplaying:clear', np);
          } catch {}
        }
      } catch {
        /* transient network error — keep last known state */
      }
    };

    poll();
    const id = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Socket.io: receive peers' now-playing broadcasts
  useEffect(() => {
    const socket = getSocket();
    const handler = ({ userId, nowPlaying }) => {
      setPeersNowPlaying(prev => {
        const next = new Map(prev);
        if (nowPlaying?.isPlaying && nowPlaying?.trackName) {
          next.set(userId, nowPlaying);
        } else {
          next.delete(userId);
        }
        return next;
      });
    };
    socket.on('presence:nowplaying', handler);
    return () => socket.off('presence:nowplaying', handler);
  }, []);

  // Extrapolate live playback position between 5s polls
  const getPosition = useCallback((np) => {
    if (!np) return 0;
    if (!np.isPlaying || !np.positionAt) return np.positionMs ?? 0;
    const elapsed = Date.now() - new Date(np.positionAt).getTime();
    const extrapolated = (np.positionMs ?? 0) + elapsed;
    return np.durationMs ? Math.min(extrapolated, np.durationMs) : extrapolated;
  }, []);

  return (
    <NowPlayingContext.Provider value={{ ownNowPlaying, peersNowPlaying, getPosition }}>
      {children}
    </NowPlayingContext.Provider>
  );
}

export const useNowPlaying = () => {
  const ctx = useContext(NowPlayingContext);
  if (!ctx) return { ownNowPlaying: null, peersNowPlaying: new Map(), getPosition: () => 0 };
  return ctx;
};
