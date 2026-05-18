import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/api/apiClient';

/**
 * useVoiceStream — keeps a media element synced with the server-canonical
 * playback state for a voice channel.
 *
 * When SPIDR AI runs /play <youtube/twitch url> in a channel, the server
 * stores the canonical playhead and broadcasts state updates. Each viewer
 * loads the URL locally (their own browser fetches the audio/video) and
 * this hook adjusts their playback to match the canonical state within ±1s.
 *
 * Why not stream audio via WebRTC?
 *   - WebRTC transcodes everything to Opus 48k. Re-encoding YouTube/Twitch
 *     audio kills quality.
 *   - Each viewer fetching independently scales infinitely; one peer pushing
 *     audio to N peers doesn't.
 *   - YouTube/Twitch already serve HLS/DASH. We just synchronize playheads.
 *
 * Drift correction:
 *   - On every 'voice:stream:state' event, compute our drift vs canonical.
 *   - If drift > 1.5s → hard seek to match.
 *   - If drift between 0.3s and 1.5s → adjust playbackRate (1.05 or 0.95)
 *     until aligned, then snap back to 1.0. This avoids audible seek jumps.
 *
 * Usage:
 *
 *   const ref = useRef();
 *   const { state, start, pause, resume, seek, stop } = useVoiceStream({
 *     channelId, mediaRef: ref, enabled: true,
 *   });
 *   <video ref={ref} src={state?.url} />
 */
export function useVoiceStream({ channelId, mediaRef, enabled = true }) {
  const [state, setState] = useState(null);    // { url, type, currentTime, playing, ownerId, updated_at }
  const socketRef = useRef(null);
  const driftTimerRef = useRef(null);

  // Apply the server-canonical state to our local <video>/<audio>
  const applyState = useCallback((srv) => {
    const el = mediaRef?.current;
    if (!el) return;

    // The server's currentTime is from the moment it was last updated.
    // Compute where the playhead "should" be right now.
    const expected = srv.playing
      ? srv.currentTime + (Date.now() - srv.updated_at) / 1000
      : srv.currentTime;

    if (el.src !== srv.url) {
      // New stream — load it
      el.src = srv.url;
      el.currentTime = expected;
      if (srv.playing) {
        el.play().catch(() => { /* autoplay blocked — caller should show "tap to play" */ });
      }
      return;
    }

    const drift = Math.abs(el.currentTime - expected);

    if (drift > 1.5) {
      // Hard seek — too far off for rate correction to feel natural
      el.currentTime = expected;
      el.playbackRate = 1.0;
    } else if (drift > 0.3) {
      // Soft correction via playbackRate. If we're behind, speed up slightly.
      el.playbackRate = el.currentTime < expected ? 1.05 : 0.95;
    } else {
      el.playbackRate = 1.0;
    }

    if (srv.playing && el.paused) el.play().catch(() => {});
    if (!srv.playing && !el.paused) el.pause();
  }, [mediaRef]);

  useEffect(() => {
    if (!enabled || !channelId) return;
    const socket = getSocket();
    socketRef.current = socket;

    const handleState = (newState) => {
      if (newState === null) {
        // Stream stopped
        setState(null);
        const el = mediaRef?.current;
        if (el) { el.pause(); el.src = ''; }
        return;
      }
      setState(newState);
      applyState(newState);
    };

    socket.on('voice:stream:state', handleState);

    // Drift correction loop — runs every 2 seconds while a stream is playing
    driftTimerRef.current = setInterval(() => {
      const s = stateRef.current;
      if (s && s.playing) applyState(s);
    }, 2000);

    return () => {
      socket.off('voice:stream:state', handleState);
      if (driftTimerRef.current) clearInterval(driftTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, enabled]);

  // Keep a ref-mirror of state for the drift timer to read without recreating
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Commands (only meaningful for the stream owner, but anyone can call) ──
  const start = useCallback((url, type = 'video', currentTime = 0) => {
    socketRef.current?.emit('voice:stream:start', { url, type, currentTime });
  }, []);
  const pause  = useCallback(() => { socketRef.current?.emit('voice:stream:pause'); }, []);
  const resume = useCallback(() => { socketRef.current?.emit('voice:stream:resume'); }, []);
  const seek   = useCallback((currentTime) => { socketRef.current?.emit('voice:stream:seek', { currentTime }); }, []);
  const stop   = useCallback(() => { socketRef.current?.emit('voice:stream:stop'); }, []);

  return { state, start, pause, resume, seek, stop };
}
