import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { spotify } from '@/api/apiClient';

/**
 * useNowPlaying — polls /api/spotify/now-playing/:userId and ticks
 * progress locally between polls so progress bars and time readouts
 * are smooth, not stair-stepped at the poll interval.
 *
 * Polling interval is 25s. Spotify's rate limits permit much faster
 * but this hook gets called per-user across rosters and avatars; at
 * 25s a server with 100 active rosters polls at 4 req/sec which is
 * comfortable. Bump down (faster) only if needed.
 *
 * Returns the same payload shape the backend sends:
 *   {
 *     is_playing, track_id, track_name, artist, album,
 *     album_art_url, spotify_url, duration_ms,
 *     progress_ms,         // ← locally interpolated between polls
 *     sampled_at,
 *   }
 *  or `null` when nothing's playing / user not connected.
 *
 * @param {string} userId      — whose now-playing to track
 * @param {object} options
 * @param {boolean} options.enabled  — pause polling (e.g. when widget hidden)
 * @param {number}  options.interval — override poll interval (ms)
 */
export default function useNowPlaying(userId, { enabled = true, interval = 25_000 } = {}) {
  const { data, refetch } = useQuery({
    queryKey: ['now-playing', userId],
    queryFn: () => spotify.nowPlaying(userId),
    enabled: !!userId && enabled,
    refetchInterval: enabled ? interval : false,
    staleTime: interval - 1000,
    retry: false, // don't pile on 429s if backend bails
  });

  // ── Local progress ticker ───────────────────────────────────────────
  // The backend returns `progress_ms` and `sampled_at` (ms-since-epoch).
  // We compute the live progress as `progress_ms + (Date.now() - sampled_at)`
  // and re-render once per second. Pauses when is_playing flips false.
  const [tickedProgress, setTickedProgress] = useState(0);
  const lastDataRef = useRef(null);

  useEffect(() => {
    if (!data || !data.is_playing) {
      setTickedProgress(data?.progress_ms || 0);
      lastDataRef.current = data || null;
      return;
    }
    lastDataRef.current = data;
    const sampledAt = data.sampled_at || Date.now();
    const computeProgress = () => {
      const drift = Date.now() - sampledAt;
      const total = Math.min((data.progress_ms || 0) + drift, data.duration_ms || 0);
      setTickedProgress(total);
    };
    computeProgress();
    const id = setInterval(computeProgress, 500);
    return () => clearInterval(id);
  }, [data]);

  if (!data) return null;
  return {
    ...data,
    progress_ms: tickedProgress,
    refresh: refetch,
  };
}
