import { useEffect, useState, useRef } from 'react';
import { spotify, getSocket } from '@/api/apiClient';

/**
 * useNowPlaying — subscribes to a server-side Spotify presence stream.
 *
 * The browser does NOT poll Spotify or our backend on a timer. The server
 * runs ONE poller per Spotify-connected user (see spotifyPresence.js) and
 * broadcasts changes over Socket.io. This hook:
 *
 *   1. Fetches the cached snapshot once for initial paint.
 *   2. Emits `spotify:subscribe` so the server starts polling (if needed)
 *      and joins us to the spotify:<userId> room.
 *   3. Listens for `spotify:now-playing` updates.
 *   4. Ticks `progress_ms` locally between server updates so the bar
 *      animates smoothly.
 *   5. Emits `spotify:unsubscribe` and cleans up on unmount.
 *
 * Payload shape (or null when nothing's playing / user not connected):
 *   { userId, connected, is_playing, track_id, track_name, artist, album,
 *     album_art_url, spotify_url, duration_ms, progress_ms, sampled_at }
 *
 * @param {string} userId           — whose now-playing to track
 * @param {object} options
 * @param {boolean} options.enabled — pause subscription when false
 */
export default function useNowPlaying(userId, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [tickedProgress, setTickedProgress] = useState(0);

  // Initial paint from cache, then live updates via socket.
  useEffect(() => {
    if (!userId || !enabled) {
      setData(null);
      return;
    }

    let cancelled = false;
    const socket = getSocket();

    const onUpdate = (payload) => {
      if (cancelled) return;
      if (payload?.userId && payload.userId !== userId) return; // belt + suspenders
      setData(payload);
    };

    socket.on('spotify:now-playing', onUpdate);
    socket.emit('spotify:subscribe', { userId });

    // Cached snapshot for instant first paint. Server returns 202 + pending:true
    // when the poller hasn't completed its first cycle — we just wait for the
    // socket event in that case.
    spotify.nowPlaying(userId).then((snapshot) => {
      if (cancelled || !snapshot || snapshot.pending) return;
      setData(snapshot);
    });

    return () => {
      cancelled = true;
      socket.off('spotify:now-playing', onUpdate);
      socket.emit('spotify:unsubscribe', { userId });
    };
  }, [userId, enabled]);

  // Local progress ticker — server sends progress_ms + sampled_at, we
  // extrapolate so the UI animates smoothly between server pushes.
  useEffect(() => {
    if (!data || !data.is_playing) {
      setTickedProgress(data?.progress_ms || 0);
      return;
    }
    const sampledAt = data.sampled_at || Date.now();
    const compute = () => {
      const drift = Date.now() - sampledAt;
      const total = Math.min((data.progress_ms || 0) + drift, data.duration_ms || 0);
      setTickedProgress(total);
    };
    compute();
    const id = setInterval(compute, 500);
    return () => clearInterval(id);
  }, [data]);

  if (!data) return null;
  return { ...data, progress_ms: tickedProgress };
}
