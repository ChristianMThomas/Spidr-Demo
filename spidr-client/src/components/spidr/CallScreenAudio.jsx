import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { applySink } from '@/lib/mediaDevicePrefs';

/** Keep the real WebRTC output mounted independently of the visible call stage. */
export default function CallScreenAudio({ stream, socketId, audioRefs, muted, volume = 1, onElement, onBlocked }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const key = `screen-${socketId}`;
    audioRefs.current[key] = element;
    element.srcObject = stream;
    onElement?.(element);
    applySink(element);
    return () => {
      delete audioRefs.current[key];
      onElement?.(null);
      element.pause();
      element.srcObject = null;
    };
  }, [stream, socketId, audioRefs, onElement]);

  useLayoutEffect(() => {
    const element = ref.current;
    element.muted = muted;
    element.volume = Math.max(0, Math.min(1, volume));
  }, [muted, volume]);

  useEffect(() => {
    let active = true;
    ref.current.play().catch(() => { if (active) onBlocked?.(); });
    const onPrefs = () => applySink(ref.current);
    window.addEventListener('spidr-media-prefs-changed', onPrefs);
    return () => { active = false; window.removeEventListener('spidr-media-prefs-changed', onPrefs); };
  }, [stream, onBlocked]);

  return <audio ref={ref} playsInline muted={muted} style={{ display: 'none' }} />;
}
