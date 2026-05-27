import { useState, useEffect, useCallback, useRef } from 'react';
import { tension } from '@/api/apiClient';

/**
 * useTension — central hook for the Spidr XP ("tension") system.
 *
 * Loads the current user's XP/level/progress and exposes `report(source)` to
 * award XP for an activity. The server is authoritative on amounts and daily
 * caps; this hook just reflects the result and fires a global
 * `spidr-tension-levelup` window event (with the new level + biomass reward)
 * so the LevelUpToast / LootDrop layers can react anywhere in the app.
 *
 * Multiple components can call useTension independently; a lightweight module
 * cache + window event keeps them roughly in sync without a full context.
 */

let _cache = null;            // last known { profile, progress }
const _listeners = new Set(); // setState fns to ping on update

function broadcast(next) {
  _cache = next;
  _listeners.forEach((fn) => { try { fn(next); } catch { /* ignore */ } });
}

export function useTension() {
  const [state, setState] = useState(_cache);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    _listeners.add(setState);
    // Initial load (only the first consumer triggers the network call).
    if (!_cache) {
      tension.me()
        .then((data) => { if (mounted.current) broadcast(data); })
        .catch(() => { /* not fatal — XP just won't show */ });
    }
    return () => { mounted.current = false; _listeners.delete(setState); };
  }, []);

  const report = useCallback(async (source, reason, ref_id) => {
    try {
      const res = await tension.action(source, reason, ref_id);
      if (res?.progress) {
        broadcast({ profile: { ..._cache?.profile, xp: res.progress.xp, level: res.progress.level }, progress: res.progress });
      }
      if (res?.leveledUp) {
        window.dispatchEvent(new CustomEvent('spidr-tension-levelup', {
          detail: { level: res.toLevel, fromLevel: res.fromLevel, biomassReward: res.biomassReward || 0 },
        }));
      }
      return res;
    } catch {
      return null; // never throw into a UI action
    }
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
