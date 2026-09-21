import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { applySink } from '@/lib/mediaDevicePrefs';
import { clearDJPreview, getDJPreviewPosition, getDJStreamState, resolveDJAudioRoute } from '@/lib/djAudio';
import useMusicKit from '@/components/spidr/useMusicKit';

const EMPTY_MEDIA = { playing: false, blocked: false, error: '', ended: false, progress: 0, duration: 0 };

/** One playback owner for the persistent call, including when its stage changes. */
export default function useDJAudio({ djSession, isHost, hostStream, streamElement, isDeafened }) {
  const audioRef = useRef(null);
  const [localVolume, setLocalVolume] = useState(80);
  const [userPaused, setUserPaused] = useState(false);
  const [preview, setPreview] = useState(EMPTY_MEDIA);
  const [streamState, setStreamState] = useState(() => getDJStreamState(hostStream));
  const [remotePlaying, setRemotePlaying] = useState(false);
  const [remoteBlocked, setRemoteBlocked] = useState(false);
  const [appleState, setAppleState] = useState(EMPTY_MEDIA);
  const [failedAppleKey, setFailedAppleKey] = useState(null);
  const musicKit = useMusicKit();
  const { ready, authorized, playTrack, stop, setVolume, instance, pause, play } = musicKit;
  const sessionKey = `${djSession?.host_id || ''}:${djSession?.track_id || ''}:${djSession?.started_at || ''}`;
  const latestRef = useRef({});

  // Track objects change their state without changing the MediaStream identity.
  useEffect(() => {
    const tracks = new Set();
    const update = () => {
      for (const track of hostStream?.getAudioTracks?.() || []) {
        if (tracks.has(track)) continue;
        tracks.add(track);
        for (const event of ['ended', 'mute', 'unmute']) track.addEventListener(event, update);
      }
      const next = getDJStreamState(hostStream);
      setStreamState(previous => previous.connected === next.connected && previous.active === next.active ? previous : next);
    };
    update();
    hostStream?.addEventListener('addtrack', update);
    hostStream?.addEventListener('removetrack', update);
    const timer = hostStream ? setInterval(update, 1000) : null;
    return () => {
      if (timer) clearInterval(timer);
      hostStream?.removeEventListener('addtrack', update);
      hostStream?.removeEventListener('removetrack', update);
      for (const track of tracks) {
        for (const event of ['ended', 'mute', 'unmute']) track.removeEventListener(event, update);
      }
    };
  }, [hostStream]);

  // The concrete host stream suppresses previews before the API broadcast arrives.
  // Conversely, an authoritative stream route with no received audio stays waiting.
  const audioRoute = resolveDJAudioRoute(djSession, hostStream);
  const liveAudioActive = audioRoute === 'stream' && getDJStreamState(hostStream).active && streamState.active;
  const previewUrl = djSession?.preview_url || '';
  const canFullTrack = audioRoute === 'preview' && djSession?.source === 'apple' &&
    !!djSession?.track_id && ready && authorized && failedAppleKey !== sessionKey;
  const canControlAudio = !!djSession && !(isHost && audioRoute === 'stream');
  latestRef.current = { audioRoute, canFullTrack, userPaused, isDeafened, localVolume, sessionKey };

  useEffect(() => { setUserPaused(false); }, [djSession?.host_id]);

  // Listen to the physical remote element, including autoplay rejection and recovery.
  useEffect(() => {
    if (!streamElement) { setRemotePlaying(false); setRemoteBlocked(false); return; }
    let active = true;
    const update = () => setRemotePlaying(!streamElement.paused && !streamElement.ended && streamElement.readyState >= 2);
    const playing = () => { setRemoteBlocked(false); update(); };
    for (const event of ['pause', 'waiting', 'ended', 'emptied']) streamElement.addEventListener(event, update);
    streamElement.addEventListener('playing', playing);
    update();
    streamElement.play().catch(error => {
      if (active && error?.name === 'NotAllowedError') setRemoteBlocked(true);
    });
    return () => {
      active = false;
      for (const event of ['pause', 'waiting', 'ended', 'emptied']) streamElement.removeEventListener(event, update);
      streamElement.removeEventListener('playing', playing);
    };
  }, [streamElement]);

  // Own source lifetime in a layout effect: no pending canplay callback may survive
  // the handoff to WebRTC or MusicKit. Previews play once, using their real duration.
  useLayoutEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    setPreview(EMPTY_MEDIA);
    if (audioRoute !== 'preview' || !previewUrl || canFullTrack) {
      clearDJPreview(element);
      return;
    }
    let cancelled = false;
    let started = false;
    const update = () => {
      if (cancelled) return;
      setPreview(previous => ({
        ...previous,
        playing: !element.paused && !element.ended && element.readyState >= 2,
        ended: element.ended || previous.ended,
        progress: Number.isFinite(element.currentTime) ? element.currentTime : 0,
        duration: Number.isFinite(element.duration) ? element.duration : 0,
      }));
    };
    const fail = () => {
      if (!cancelled) setPreview(previous => ({ ...previous, playing: false, error: 'This preview could not be loaded.' }));
    };
    const start = () => {
      if (cancelled || started) return;
      started = true;
      const position = getDJPreviewPosition(djSession?.started_at, element.duration);
      if (position.ended) {
        setPreview({ ...EMPTY_MEDIA, ended: true, duration: element.duration, progress: element.duration });
        return;
      }
      try { element.currentTime = position.position; } catch {}
      update();
      if (latestRef.current.userPaused) return;
      element.play().then(() => {
        if (cancelled) return;
        setPreview(previous => ({ ...previous, blocked: false }));
        update();
      }).catch(error => {
        if (cancelled || error?.name === 'AbortError') return;
        setPreview(previous => ({ ...previous, playing: false, blocked: error?.name === 'NotAllowedError',
          error: error?.name === 'NotAllowedError' ? '' : 'This preview could not be played.' }));
      });
    };
    const playing = () => { setPreview(previous => ({ ...previous, blocked: false })); update(); };
    for (const event of ['pause', 'timeupdate', 'durationchange', 'ended', 'waiting']) element.addEventListener(event, update);
    element.addEventListener('playing', playing);
    element.addEventListener('error', fail);
    element.addEventListener('canplay', start, { once: true });
    element.loop = false;
    element.volume = latestRef.current.localVolume / 100;
    element.muted = latestRef.current.isDeafened;
    element.src = previewUrl;
    applySink(element);
    element.load();
    return () => {
      cancelled = true;
      for (const event of ['pause', 'timeupdate', 'durationchange', 'ended', 'waiting']) element.removeEventListener(event, update);
      element.removeEventListener('playing', playing);
      element.removeEventListener('error', fail);
      element.removeEventListener('canplay', start);
      clearDJPreview(element);
    };
  }, [sessionKey, djSession?.started_at, audioRoute, previewUrl, canFullTrack]);

  // Subscription playback is exclusive with both preview and the host's live share.
  useLayoutEffect(() => {
    setAppleState(EMPTY_MEDIA);
    if (!canFullTrack) return;
    const controller = new AbortController();
    const position = getDJPreviewPosition(djSession?.started_at, (djSession?.duration_ms || 0) / 1000);
    if (position.ended) {
      setAppleState({ ...EMPTY_MEDIA, ended: true, progress: position.position, duration: position.position });
      return;
    }
    setVolume(latestRef.current.isDeafened || latestRef.current.userPaused ? 0 : latestRef.current.localVolume / 100);
    playTrack(djSession.track_id, position.position, { signal: controller.signal }).then(async () => {
      if (controller.signal.aborted) return;
      if (latestRef.current.userPaused) await pause();
      setVolume(latestRef.current.isDeafened ? 0 : latestRef.current.localVolume / 100);
    }).catch(error => {
      if (!controller.signal.aborted && error?.name !== 'AbortError') setFailedAppleKey(sessionKey);
    });
    return () => { controller.abort(); stop(); };
  }, [canFullTrack, sessionKey, djSession?.track_id, djSession?.started_at, djSession?.duration_ms, playTrack, pause, stop, setVolume]);

  useEffect(() => {
    if (!canFullTrack) return;
    const player = instance.current;
    if (!player) return;
    const sample = () => {
      const states = window.MusicKit?.PlaybackStates || {};
      setAppleState(previous => ({ ...previous,
        playing: player.playbackState === states.playing,
        ended: player.playbackState === states.ended || player.playbackState === states.completed,
        progress: Number(player.currentPlaybackTime) || 0,
        duration: Number(player.currentPlaybackDuration) || (djSession?.duration_ms || 0) / 1000,
      }));
    };
    player.addEventListener('playbackStateDidChange', sample);
    sample();
    const timer = setInterval(sample, 500);
    return () => { clearInterval(timer); player.removeEventListener('playbackStateDidChange', sample); };
  }, [canFullTrack, instance, djSession?.duration_ms]);

  useLayoutEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, localVolume / 100));
      audioRef.current.muted = isDeafened;
      if (userPaused) audioRef.current.pause();
    }
    if (canFullTrack) setVolume(isDeafened ? 0 : localVolume / 100);
  }, [localVolume, isDeafened, userPaused, canFullTrack, setVolume]);

  const unlockAudio = useCallback(async () => {
    const current = latestRef.current;
    if (current.userPaused || current.isDeafened) return;
    const element = current.audioRoute === 'stream' ? streamElement : audioRef.current;
    if (!element || (current.audioRoute === 'preview' && (current.canFullTrack || !element.getAttribute('src') || element.ended))) return;
    try {
      await element.play();
      if (current.audioRoute === 'stream') setRemoteBlocked(false);
      else setPreview(previous => ({ ...previous, blocked: false, error: '' }));
    } catch (error) {
      if (error?.name !== 'NotAllowedError') return;
      if (current.audioRoute === 'stream') setRemoteBlocked(true);
      else setPreview(previous => ({ ...previous, blocked: true }));
    }
  }, [streamElement]);

  const togglePause = useCallback(async () => {
    if (!canControlAudio) return;
    const next = !latestRef.current.userPaused;
    latestRef.current.userPaused = next;
    setUserPaused(next);
    if (audioRoute === 'stream') return; // parent mutes only the DJ output element
    if (canFullTrack) {
      try { await (next ? pause() : play()); } catch { setAppleState(previous => ({ ...previous, error: 'Playback needs to be resumed in Apple Music.' })); }
      return;
    }
    const element = audioRef.current;
    if (next) element?.pause();
    else if (element?.getAttribute('src') && !preview.ended) {
      const position = getDJPreviewPosition(djSession?.started_at, element.duration);
      if (position.ended) { setPreview(previous => ({ ...previous, ended: true, playing: false, progress: element.duration })); return; }
      try { element.currentTime = position.position; } catch {}
      await unlockAudio();
    }
  }, [canControlAudio, audioRoute, canFullTrack, pause, play, preview.ended, djSession?.started_at, unlockAudio]);

  const fullTrackActive = !!canFullTrack;
  const media = fullTrackActive ? appleState : preview;
  const audioBlocked = audioRoute === 'stream' ? remoteBlocked : media.blocked;
  const isPlaying = !userPaused && !isDeafened && localVolume > 0 && (audioRoute === 'stream'
    ? liveAudioActive && (isHost || remotePlaying)
    : media.playing);
  let status = 'idle';
  if (djSession) {
    if (isDeafened) status = 'deafened';
    else if (userPaused) status = 'paused';
    else if (audioBlocked) status = 'blocked';
    else if (audioRoute === 'stream') status = liveAudioActive && (isHost || remotePlaying) ? 'streaming' : 'waiting';
    else if (media.error) status = 'error';
    else if (media.ended) status = 'ended';
    else if (!previewUrl && !fullTrackActive) status = 'unavailable';
    else status = media.playing ? (fullTrackActive ? 'fulltrack' : 'preview') : 'loading';
  }
  const expected = getDJPreviewPosition(djSession?.started_at, media.duration);
  return {
    audioRef, audioRoute, liveAudioActive, isPlaying, status, audioBlocked,
    audioError: media.error, localVolume, setLocalVolume, userPaused, togglePause, unlockAudio,
    fullTrackActive, canControlAudio, progressSeconds: media.progress, durationSeconds: media.duration,
    localPreviewDriftMs: audioRoute === 'preview' && !fullTrackActive && isPlaying
      ? Math.round((media.progress - expected.position) * 1000) : null,
    hostStreamConnected: getDJStreamState(hostStream).connected,
  };
}
