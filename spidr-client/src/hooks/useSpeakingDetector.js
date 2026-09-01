import { useEffect, useRef, useState } from 'react';
import { getSharedAudioContext, getSharedSource, releaseSharedSource } from '@/lib/sharedAudioContext';

/**
 * useSpeakingDetector — feeds a MediaStream's audio into a Web Audio
 * AnalyserNode and returns a boolean `isSpeaking` that flips true when the
 * RMS energy crosses a threshold.
 *
 * Used by VoiceChannel to animate a pulsing ring around speaking avatars
 * (the `.spidr-speaking` CSS class defined in index.css).
 *
 * Threshold and smoothing chosen so:
 *   - Background noise (HVAC, fans) doesn't trigger
 *   - Normal speech lights up reliably
 *   - The state doesn't flicker between syllables (300ms hold-on tail)
 *
 * @param {MediaStream|null} stream  the remote (or local) audio stream
 * @param {object}           [opts]
 * @param {boolean}          [opts.enabled=true]
 * @param {number}           [opts.threshold=0.04]  RMS threshold (0-1)
 * @returns {boolean}        isSpeaking
 */
export function useSpeakingDetector(stream, { enabled = true, threshold = 0.04 } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const rafRef = useRef(null);
  const lastSpeakingAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !stream) {
      setIsSpeaking(false);
      return;
    }

    // Only set up analyser if there's actually an audio track
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    // Shared app-wide context — see lib/sharedAudioContext.js for why we
    // never construct (or close) per-detector contexts anymore.
    const audioContext = getSharedAudioContext();
    if (!audioContext) return;
    // Shared per-stream source — only ONE MediaStreamAudioSourceNode may
    // exist per MediaStream (Chrome silently detaches audio playback if a
    // second is created). getSharedSource ref-counts sources so the sidebar
    // broadcast, EQ bars, and this hook all analyse the same source.
    const source = getSharedSource(stream);
    if (!source) return;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);

    // THROTTLED to ~15Hz rather than running the FFT on every animation
    // frame. A speaking ring cannot visibly benefit from 60Hz — the state is
    // a boolean with a 300ms hold — but the cost is real: this loop runs once
    // per peer, and at 60fps a handful of people in a call turns into
    // hundreds of full-buffer RMS passes a second. Sampling every ~66ms is
    // indistinguishable on screen and roughly a quarter of the work.
    const SAMPLE_MS = 66;
    let lastSample = 0;

    const tick = (ts) => {
      rafRef.current = requestAnimationFrame(tick);
      if (ts - lastSample < SAMPLE_MS) return;   // skip this frame
      lastSample = ts;

      analyser.getFloatTimeDomainData(buf);
      // RMS of the time-domain samples
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      const now = performance.now();
      if (rms > threshold) {
        lastSpeakingAtRef.current = now;
        setIsSpeaking((cur) => cur ? cur : true);
      } else if (now - lastSpeakingAtRef.current > 300) {
        // Hold the speaking state for 300ms after RMS drops to avoid flicker
        setIsSpeaking((cur) => cur ? false : cur);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { analyser.disconnect(); } catch {}
      // Release the shared source (ref-counted) — the underlying source
      // node persists as long as any other consumer needs it.
      releaseSharedSource(stream);
      // NEVER close the shared context — other analysers are using it.
    };
  }, [stream, enabled, threshold]);

  return isSpeaking;
}
