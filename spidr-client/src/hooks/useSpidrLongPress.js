import { useRef, useCallback } from 'react';

/**
 * useSpidrLongPress (Patch 2.10)
 *
 * Grants mobile users the desktop right-click experience. Returns touch + mouse
 * handlers you spread onto any element. On a ~400ms hold that doesn't move
 * (so scrolling is never hijacked), it fires `onLongPress(coords)` where coords
 * is { clientX, clientY }, plus a 50ms haptic buzz on supported devices.
 *
 * Usage:
 *   const lp = useSpidrLongPress((coords) => {
 *     triggerMenu({ preventDefault(){}, clientX: coords.clientX, clientY: coords.clientY }, 'message', data);
 *   });
 *   <div {...lp} className="select-none" style={{ WebkitTouchCallout: 'none' }} />
 *
 * Options:
 *   threshold   ms before it triggers (default 400)
 *   moveTol     px of finger travel that cancels it (default 10)
 *   onPressState(active) optional — called true on press start, false on end/cancel
 *                        (use it to drive the framer compression/tension effect)
 */
export function useSpidrLongPress(onLongPress, { threshold = 400, moveTol = 10, onPressState } = {}) {
  const timerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);

  const clear = useCallback((keepState = false) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!keepState) onPressState?.(false);
  }, [onPressState]);

  const begin = useCallback((clientX, clientY) => {
    startRef.current = { x: clientX, y: clientY };
    firedRef.current = false;
    onPressState?.(true);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      try { navigator.vibrate?.(50); } catch {}
      onLongPress?.({ clientX, clientY });
      // keep the pressed/compressed state so the element reads as "selected"
      timerRef.current = null;
    }, threshold);
  }, [onLongPress, onPressState, threshold]);

  // ── Touch ──
  const onTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    if (!t) return;
    begin(t.clientX, t.clientY);
  }, [begin]);

  const onTouchMove = useCallback((e) => {
    const t = e.touches?.[0];
    if (!t || !timerRef.current) return;
    const dx = Math.abs(t.clientX - startRef.current.x);
    const dy = Math.abs(t.clientY - startRef.current.y);
    if (dx > moveTol || dy > moveTol) clear(); // user is scrolling → cancel
  }, [clear, moveTol]);

  const onTouchEnd = useCallback(() => {
    // If it already fired, leave the selected state for the menu to clear.
    clear(firedRef.current);
  }, [clear]);

  // ── Desktop right-click parity ──
  const onContextMenu = useCallback((e) => {
    // Let the element's own onContextMenu (via triggerMenu) handle desktop;
    // we just make sure the native menu is suppressed.
    e.preventDefault();
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd, onContextMenu };
}

export default useSpidrLongPress;
