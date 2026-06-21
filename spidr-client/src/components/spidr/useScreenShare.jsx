import { useState, useRef, useEffect, useCallback } from 'react';

export const useScreenShare = () => {
  const [stream, setStream] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const streamRef = useRef(null);

  const stopShare = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }
    streamRef.current = null;
    setStream(null);
    setIsSharing(false);
  }, []);

  const startShare = useCallback(async (sourceId = null) => {
    // Stop any existing share first
    if (streamRef.current) stopShare();

    // In Electron, hand the chosen desktopCapturer source id to the main
    // process so its display-media request handler grants that exact source.
    // (Without this the desktop app's getDisplayMedia call had nothing to
    // capture — the root cause of "streaming not working in Electron".)
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null;
    if (electronAPI?.isElectron && electronAPI.setShareSource) {
      // Only forward real desktopCapturer ids (screen:… / window:…). Legacy
      // mock ids from the old StreamSelector are ignored so the handler falls
      // back to the primary screen instead of failing to match.
      const realId = (typeof sourceId === 'string' && /^(screen|window):/.test(sourceId)) ? sourceId : null;
      try { electronAPI.setShareSource(realId); } catch {}
    }

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsSharing(true);

      // Auto-stop when the browser's "Stop sharing" is clicked
      mediaStream.getVideoTracks().forEach(track => {
        track.onended = () => stopShare();
      });

      return mediaStream;
    } catch (err) {
      // User cancelled the share picker — not an error
      if (err.name === 'AbortError' || err.name === 'NotAllowedError') {
        return null;
      }
      console.error("Error sharing screen:", err);
      return null;
    }
  }, [stopShare]);

  // Mandatory cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
    };
  }, []);

  return { stream, isSharing, startShare, stopShare };
};