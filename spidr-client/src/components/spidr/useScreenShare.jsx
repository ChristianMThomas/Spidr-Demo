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