import { useState, useEffect, useCallback, useRef } from 'react';
import { tension } from '../lib/apiClient';
import { emitter } from '../lib/eventEmitter';

let _cache: any = null;
const _listeners = new Set<(next: any) => void>();

function broadcast(next: any) {
  _cache = next;
  _listeners.forEach((fn) => { try { fn(next); } catch { /* ignore */ } });
}

export function useTension() {
  const [state, setState] = useState<any>(_cache);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    _listeners.add(setState);
    if (!_cache) {
      tension.me()
        .then((data) => { if (mounted.current) broadcast(data); })
        .catch(() => { /* not fatal */ });
    }
    return () => { mounted.current = false; _listeners.delete(setState); };
  }, []);

  const report = useCallback(async (source: string, reason?: string, ref_id?: string) => {
    try {
      const res: any = await tension.action(source, reason, ref_id);
      if (res?.progress) {
        broadcast({ profile: { ..._cache?.profile, xp: res.progress.xp, level: res.progress.level }, progress: res.progress });
      }
      if (res?.leveledUp) {
        emitter.emit('spidr-tension-levelup', {
          level: res.toLevel, fromLevel: res.fromLevel, biomassReward: res.biomassReward || 0,
        });
      }
      return res;
    } catch { return null; }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await tension.me();
      broadcast(data);
      return data;
    } catch { return null; }
  }, []);

  return {
    profile: state?.profile || null,
    progress: state?.progress || null,
    level: state?.progress?.level ?? 1,
    report,
    refresh,
  };
}

export default useTension;
