import React, { useRef, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

/**
 * VoiceEqualizer — real-time audio frequency visualizer for an active speaker,
 * matching the Spidr AI "voice" aesthetic (image reference): a row of vertical
 * bars with a purple→crimson gradient that jump to the live audio amplitude,
 * plus a "~ VOICE" label.
 *
 * Connects the provided MediaStream to a local AudioContext + AnalyserNode and
 * reads getByteFrequencyData on each animation frame to drive bar heights.
 * Falls back to a gentle idle shimmer if no stream/analyser is available.
 *
 * Props:
 *   stream  — MediaStream for this speaker (optional; without it, idle anim)
 *   bars    — number of bars (default 9)
 *   active  — whether the speaker is currently talking (gates the render)
 */
export default function VoiceEqualizer({ stream, bars = 9, active = true }) {
  const [heights, setHeights] = useState(() => new Array(bars).fill(0.2));
  const rafRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // Set up the analyser from the live stream (best-effort).
    const setup = () => {
      if (!stream) return false;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;            // 32 frequency bins — plenty for a few bars
        analyser.smoothingTimeConstant = 0.7;
        analyserRef.current = analyser;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);         // NOT connected to destination → no echo
        sourceRef.current = source;
        dataRef.current = new Uint8Array(analyser.frequencyBinCount);
        return true;
      } catch {
        return false;
      }
    };

    const hasAnalyser = setup();

    const tick = () => {
      if (cancelled) return;
      if (hasAnalyser && analyserRef.current && dataRef.current) {
        analyserRef.current.getByteFrequencyData(dataRef.current);
        const data = dataRef.current;
        const step = Math.floor(data.length / bars) || 1;
        const next = new Array(bars).fill(0).map((_, i) => {
          // Average a small slice of the spectrum for each bar.
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
          const v = sum / step / 255; // 0..1
          return Math.max(0.12, Math.min(1, v * 1.4));
        });
        setHeights(next);
      } else {
        // Idle shimmer when there's no analyser.
        const t = Date.now() / 200;
        setHeights(new Array(bars).fill(0).map((_, i) =>
          0.3 + 0.35 * Math.abs(Math.sin(t + i * 0.6))));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { sourceRef.current?.disconnect(); } catch { /* ignore */ }
      try { ctxRef.current?.close(); } catch { /* ignore */ }
      ctxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [stream, bars]);

  if (!active) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-end gap-[3px] h-6">
        {heights.map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full transition-[height] duration-75"
            style={{
              height: `${Math.round(h * 100)}%`,
              minHeight: '3px',
              background: 'linear-gradient(to top, #dc2626, #9333ea)',
              boxShadow: '0 0 6px rgba(220,38,38,0.5)',
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-bold text-[#dc2626] uppercase tracking-wider flex items-center gap-0.5">
        <Activity size={10} /> Voice
      </span>
    </div>
  );
}
