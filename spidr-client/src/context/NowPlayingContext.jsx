import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSocket, spotify } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';

const NowPlayingContext = createContext(null);

// Map the server's flat presence payload onto the camelCase shape downstream
// consumers (SpotifyNowPlaying widget) already expect.
export function toLegacyShape(payload) {
  if (!payload || payload.connected === false || !payload.track_id) return null;
  return {
    source:     'spotify-web',
    trackName:  payload.track_name,
    artist:     payload.artist,
    artists:    payload.artist ? payload.artist.split(', ') : [],
    albumArt:   payload.album_art_url,
    durationMs: payload.duration_ms,
    positionMs: payload.progress_ms,
    positionAt: payload.sampled_at ? new Date(payload.sampled_at).toISOString() : new Date().toISOString(),
    isPlaying:  !!payload.is_playing,
    trackUri:   payload.track_id ? `spotify:track:${payload.track_id}` : null,
  };
}

export function NowPlayingProvider({ children }) {
  const { user } = useAuth();
  const myUserId = user?.id;
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

  // T2: Web — subscribe to the server-side Spotify presence stream for our
  // own user (see utils/spotifyPresence.js on the server). Replaces the old
  // every-10s poll with a single socket subscription. The server runs ONE
  // poller per Spotify-connected user and pushes changes to subscribers; we
  // pay zero HTTP traffic after the initial cached snapshot.
  useEffect(() => {
    if (window.electronAPI?.isElectron) return; // Electron uses SMTC
    if (!myUserId) return;

    let cancelled = false;
    let lastKey = '';
    const socket = getSocket();

    const apply = (payload) => {
      if (cancelled) return;
      const np = toLegacyShape(payload);
      setOwnNowPlaying(np);

      // Mirror to peers — keeps the existing 'presence:nowplaying' broadcast
      // working for friends who haven't migrated to the new subscription model.
      const key = np ? `${np.trackName}-${np.isPlaying}` : '__clear__';
      if (key === lastKey) return;
      lastKey = key;
      try {
        if (np && np.isPlaying) socket.emit('nowplaying:update', np);
        else socket.emit('nowplaying:clear');
      } catch {}
    };

    const onUpdate = (payload) => {
      if (payload?.userId && payload.userId !== myUserId) return;
      apply(payload);
    };

    socket.on('spotify:now-playing', onUpdate);
    socket.emit('spotify:subscribe', { userId: myUserId });

    // Initial paint from cached snapshot — socket events take over after.
    spotify.nowPlaying(myUserId).then((snapshot) => {
      if (cancelled || !snapshot || snapshot.pending) return;
      apply(snapshot);
    });

    return () => {
      cancelled = true;
      socket.off('spotify:now-playing', onUpdate);
      socket.emit('spotify:unsubscribe', { userId: myUserId });
    };
  }, [myUserId]);

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
