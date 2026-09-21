import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { appleMusic } from '@/api/apiClient';
import { createMusicKitClient } from '@/lib/musicKitClient';

const client = createMusicKitClient(appleMusic);

export default function useMusicKit() {
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const instanceRef = useRef(null);
  instanceRef.current = client.getInstance();
  const playbackGeneration = useRef(0);
  const playbackQueue = useRef(Promise.resolve());
  useEffect(() => { client.boot(); }, []);

  // ── Full-track playback (subscribers) ────────────────────────────────
  // Plays a catalog song by id, optionally seeking — used by the DJ booth to
  // sync everyone to the session clock. Falls back by throwing; callers keep
  // the 30s preview path as the safety net.
  const playTrack = useCallback((songId, positionSec = 0, { signal } = {}) => {
    const generation = ++playbackGeneration.current;
    const operation = playbackQueue.current.catch(() => {}).then(async () => {
    const mk = instanceRef.current;
    if (!mk) throw new Error('MusicKit not ready');
    if (!mk.isAuthorized) throw new Error('Not authorized');
    const check = () => {
      if (signal?.aborted || generation !== playbackGeneration.current) throw new DOMException('Playback cancelled', 'AbortError');
    };
    check();
    await mk.setQueue({ song: songId });
    check();
    await mk.play();
    if (signal?.aborted || generation !== playbackGeneration.current) {
      await mk.stop();
      check();
    }
    if (positionSec > 1) {
      try { await mk.seekToTime(positionSec); } catch {}
    }
    });
    playbackQueue.current = operation;
    return operation;
  }, []);

  const stop = useCallback(() => {
    playbackGeneration.current++;
    try { Promise.resolve(instanceRef.current?.stop()).catch(() => {}); } catch {}
  }, []);
  const pause = useCallback(() => instanceRef.current?.pause(), []);
  const play = useCallback(() => instanceRef.current?.play(), []);

  const setVolume = useCallback((v01) => {
    const mk = instanceRef.current;
    if (mk) try { mk.volume = Math.max(0, Math.min(1, v01)); } catch {}
  }, []);


  return { ...state, authorize: client.authorize, unauthorize: client.unauthorize,
    retry: () => client.boot(true), refresh: client.refresh,
    playTrack, stop, pause, play, setVolume, instance: instanceRef };
}
