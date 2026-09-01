import { useEffect, useRef, useState } from 'react';
import {
  getSharedAudioContext,
  getSharedSource,
  releaseSharedSource,
  getSharedElementSource,
  releaseSharedElementSource,
} from '@/lib/sharedAudioContext';

/**
 * useAudioSpectrum — live frequency energy for the DJ booth visualiser.
 *
 * Returns { bass, mid, treble, level }, each 0–1 and smoothed, so the HUD can
 * physically react to the music instead of running a fixed CSS keyframe.
 *
 * Design constraints this respects, learned the hard way in this codebase:
 *
 *  • ONE analyser total. This is a single booth-level tap, not per-peer — the
 *    per-peer speaking detectors are a separate concern and stay at 15Hz.
 *  • Sources come from the shared registries, never a fresh
 *    createMediaStreamSource / createMediaElementSource. Both APIs allow
 *    exactly one node per source and a second call silently breaks audio.
 *  • Runs at ~30Hz, not 60. The visual is a smoothed physical simulation
 *    (values ease toward targets), so sampling twice as often changes almost
 *    nothing visually and doubles the cost.
 *  • Stops entirely when there is nothing to show, so an idle booth costs
 *    zero.
 *
 * Pass EITHER a MediaStream (the DJ's incoming screen-share audio) or an
 * HTMLMediaElement (the local 30s preview). Whichever is live.
 */
export default function useAudioSpectrum({ stream = null, element = null, enabled = true } = {}) {
  const [bands, setBands] = useState({ bass: 0, mid: 0, treble: 0, level: 0 });
  const rafRef = useRef(null);
  // Smoothed values live in a ref so easing doesn't force a re-render per frame.
  const easedRef = useRef({ bass: 0, mid: 0, treble: 0, level: 0 });

  useEffect(() => {
    if (!enabled || (!stream && !element)) {
      setBands({ bass: 0, mid: 0, treble: 0, level: 0 });
      return;
    }
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const source = stream ? getSharedSource(stream) : getSharedElementSource(element);
    if (!source) return;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;                  // 128 bins — plenty for 3 bands
    analyser.smoothingTimeConstant = 0.75;   // let the analyser do some easing
    source.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const bins = buf.length;
    // Rough splits across the spectrum. Not musically exact — this drives a
    // visual, and perceptually "lows / mids / highs" is what reads.
    const bassEnd   = Math.floor(bins * 0.12);
    const midEnd    = Math.floor(bins * 0.45);

    const SAMPLE_MS = 33;                    // ~30Hz
    let last = 0;

    const avg = (from, to) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += buf[i];
      return (sum / Math.max(1, to - from)) / 255;
    };

    const tick = (ts) => {
      rafRef.current = requestAnimationFrame(tick);
      if (ts - last < SAMPLE_MS) return;
      last = ts;

      analyser.getByteFrequencyData(buf);
      const target = {
        bass:   avg(0, bassEnd),
        mid:    avg(bassEnd, midEnd),
        treble: avg(midEnd, bins),
        level:  avg(0, bins),
      };

      // Asymmetric easing: snap up fast so a kick lands on the beat, fall
      // slowly so the HUD glows down instead of strobing. A symmetric ease
      // makes percussion look mushy; no easing at all makes it flicker.
      const e = easedRef.current;
      for (const k of ['bass', 'mid', 'treble', 'level']) {
        const t = target[k];
        e[k] = t > e[k] ? e[k] + (t - e[k]) * 0.55 : e[k] + (t - e[k]) * 0.12;
      }
      setBands({ bass: e.bass, mid: e.mid, treble: e.treble, level: e.level });
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { analyser.disconnect(); } catch {}
      if (stream) releaseSharedSource(stream);
      else releaseSharedElementSource(element);
    };
  }, [stream, element, enabled]);

  return bands;
}
