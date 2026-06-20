import { useEffect, useState } from 'react';
import { spotify } from '../lib/apiClient';
import { getSocket } from '../lib/socket';

interface NowPlaying {
  userId?: string;
  connected?: boolean;
  is_playing?: boolean;
  track_id?: string;
  track_name?: string;
  artist?: string;
  album?: string;
  album_art_url?: string;
  spotify_url?: string;
  duration_ms?: number;
  progress_ms?: number;
  sampled_at?: number;
  pending?: boolean;
}

export default function useNowPlaying(userId?: string, { enabled = true }: { enabled?: boolean } = {}): NowPlaying | null {
  const [data, setData] = useState<NowPlaying | null>(null);
  const [tickedProgress, setTickedProgress] = useState(0);

  useEffect(() => {
    if (!userId || !enabled) { setData(null); return; }
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getSocket();
      if (cancelled) return;

      const onUpdate = (payload: any) => {
        if (cancelled) return;
        if (payload?.userId && payload.userId !== userId) return;
        setData(payload);
      };

      socket.on('spotify:now-playing', onUpdate);
      socket.emit('spotify:subscribe', { userId });

      spotify.nowPlaying(userId).then((snapshot: any) => {
        if (cancelled || !snapshot || snapshot.pending) return;
        setData(snapshot);
      });

      cleanup = () => {
        socket.off('spotify:now-playing', onUpdate);
        socket.emit('spotify:unsubscribe', { userId });
      };
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, [userId, enabled]);

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
