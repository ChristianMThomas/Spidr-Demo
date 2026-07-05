import { useState, useEffect } from 'react';

/**
 * Returns `true` immediately when `value` is true, but lingers as `true` for
 * `delayMs` after `value` flips to false. If `value` flips back to true within
 * that window, the pending fall-through is cancelled.
 *
 * Used to debounce flickery UI signals — typing indicators, "web vibration
 * detected" banners, presence pulses — so brief gaps in the source signal
 * don't tear the UI down and rebuild it.
 */
export function useStickyBoolean(value, delayMs = 350) {
  const [sticky, setSticky] = useState(!!value);
  useEffect(() => {
    if (value) {
      setSticky(true);
      return undefined;
    }
    const t = setTimeout(() => setSticky(false), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return sticky;
}

export default useStickyBoolean;
