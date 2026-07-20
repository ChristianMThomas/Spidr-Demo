import React, { useRef, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { getSharedAudioContext, getSharedSource, releaseSharedSource } from '@/lib/sharedAudioContext';

/**
 * VoiceEqualizer — real-time audio frequency visualizer for an active speaker,
 * matching the Spidr AI "voice" aesthetic (image reference): a row of vertical
 * bars with a purple→crimson gradient that jump to the live audio amplitude,
 * plus a "~ VOICE" label.
 *
 * Uses the SHARED per-stream source registry so multiple analysers (this,
 * the tile's useSpeakingDetector, and the sidebar broadcast) all safely
 * observe the same stream. Chrome only allows ONE MediaStreamAudioSourceNode
 * per MediaStream — a second createMediaStreamSource silently detaches the
 * audio element's playback pipeline (root cause of the "everyone goes deaf
 * when someone starts talking" bug).
 *
 * Props:
 *   stream  — MediaStream for this speaker (optional; without it, idle anim)
 *   bars    — number of bars (default 9)
 *   active  — whether the speaker is currently talking (gates the render)
 */
export default function VoiceEqualizer({ stream, bars = 9, active = true }) {
  const [heights, setHeights] = useState(() => new Array(bars).fill(0.2));
  const rafRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // Set up the analyser via the shared source — one source per stream,
    // any number of downstream analysers.
    let analyser = null;
    const setup = () => {
      if (!stream) return false;
      const ctx = getSharedAudioContext();
      if (!ctx) return false;
      const source = getSharedSource(stream);
      if (!source) return false;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;
      source.connect(analyser);
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      return true;
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
      try { analyser?.disconnect(); } catch { /* ignore */ }
      // Release the shared source ref — the underlying source node persists
      // for other consumers (speaking detector, sidebar broadcast) if any.
      // NEVER close the shared context.
      if (stream) releaseSharedSource(stream);
      analyserRef.current = null;
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
