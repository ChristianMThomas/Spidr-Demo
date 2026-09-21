import { useEffect, useRef, useState } from 'react';

/**
 * useTypewriter — types a line out, holds it, deletes it, moves to the next.
 *
 * Used for the homepage banner's status line, which cycles through real
 * signals (unread messages, the newest patch, today's date) rather than
 * decorative filler.
 *
 * Notes on the implementation:
 *
 *  • Driven by a single self-scheduling timeout rather than an interval, so
 *    each phase can have its own duration — typing is fast, the hold is long
 *    enough to actually read, deleting is faster than typing (which is how
 *    real terminals feel).
 *  • The timer is torn down and rebuilt whenever the LINES change, so a
 *    freshly-arrived notification doesn't wait a full cycle to appear.
 *  • Respects prefers-reduced-motion by showing the full line and swapping
 *    on a plain interval, with no character animation at all.
 */
export default function useTypewriter(lines, {
  typeMs = 45,
  deleteMs = 22,
  holdMs = 2600,
  gapMs = 380,
} = {}) {
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  // Snapshot the phase in a ref so the scheduler doesn't need it as a dep and
  // re-enter on every character.
  const stateRef = useRef({ phase: 'typing', char: 0, line: 0 });

  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    clearTimeout(timerRef.current);
    const list = (lines || []).filter(Boolean);
    if (list.length === 0) { setText(''); return; }

    // Reduced motion: no per-character animation, just rotate the full line.
    if (reduced) {
      let i = 0;
      setText(list[0]);
      const iv = setInterval(() => {
        i = (i + 1) % list.length;
        setText(list[i]);
        setIndex(i);
      }, holdMs + 1200);
      return () => clearInterval(iv);
    }

    // Reset when the source lines change so new signals show immediately.
    stateRef.current = { phase: 'typing', char: 0, line: 0 };

    const step = () => {
      const s = stateRef.current;
      const current = list[s.line % list.length] || '';

      if (s.phase === 'typing') {
        s.char += 1;
        setText(current.slice(0, s.char));
        if (s.char >= current.length) {
          s.phase = 'holding';
          timerRef.current = setTimeout(step, holdMs);
        } else {
          timerRef.current = setTimeout(step, typeMs);
        }
        return;
      }

      if (s.phase === 'holding') {
        // A single line has nothing to rotate to — leave it typed rather
        // than deleting and retyping the same text forever.
        if (list.length === 1) return;
        s.phase = 'deleting';
        timerRef.current = setTimeout(step, deleteMs);
        return;
      }

      // deleting
      s.char -= 1;
      setText(current.slice(0, Math.max(0, s.char)));
      if (s.char <= 0) {
        s.line = (s.line + 1) % list.length;
        s.phase = 'typing';
        setIndex(s.line);
        timerRef.current = setTimeout(step, gapMs);
      } else {
        timerRef.current = setTimeout(step, deleteMs);
      }
    };

    timerRef.current = setTimeout(step, typeMs);
    return () => clearTimeout(timerRef.current);
    // Join the lines so the effect re-runs on CONTENT change, not identity —
    // otherwise a re-render with a new array literal restarts the animation
    // mid-word every time the parent updates.
  }, [(lines || []).join('\u0000'), typeMs, deleteMs, holdMs, gapMs, reduced]);

  return { text, index, reduced };
}
