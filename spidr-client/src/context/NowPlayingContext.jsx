import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSocket } from '@/api/apiClient';

const NowPlayingContext = createContext(null);

export function NowPlayingProvider({ children }) {
  const [ownNowPlaying, setOwnNowPlaying]     = useState(null);
  const [peersNowPlaying, setPeersNowPlaying] = useState(new Map());

  // T1: Electron OS media session (Windows SMTC via IPC)
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
