import { useEffect, useRef, useState } from 'react';

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

    let audioContext;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      // Web Audio not available; bail silently
      return;
    }
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
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

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { source.disconnect(); } catch {}
      try { audioContext.close(); } catch {}
    };
  }, [stream, enabled, threshold]);

  return isSpeaking;
}
