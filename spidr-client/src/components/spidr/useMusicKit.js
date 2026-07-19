import { useState, useEffect, useCallback, useRef } from 'react';
import { appleMusic, getSocket } from '@/api/apiClient';

/**
 * useMusicKit — Apple Music integration hook (MusicKit JS v3).
 *
 * What it gives Spidr that Discord doesn't have at all:
 *   • connect an Apple Music account (Music User Token via authorize())
 *   • catalog search + 30s previews for EVERY user (dev token only)
 *   • FULL-track in-app playback for Apple Music subscribers — the DJ booth
 *     upgrades from 30s previews to the whole song, in sync
 *   • live now-playing presence when playing through Spidr (Apple has no
 *     official live now-playing API, so in-app playback IS the live signal;
 *     the desktop OS media-session pipeline covers the native Music app)
 *
 * States:
 *   configured  server has Apple credentials (else all Apple UI hides)
 *   ready       MusicKit script loaded + configured with a dev token
 *   authorized  user granted access (Music User Token exists)
 *
 * All failure paths degrade silently to "not available" — never a crash.
 */

let musicKitLoadPromise = null;

function loadMusicKitScript() {
  if (window.MusicKit) return Promise.resolve();
  if (musicKitLoadPromise) return musicKitLoadPromise;
  musicKitLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { musicKitLoadPromise = null; reject(new Error('MusicKit script failed to load')); };
    document.head.appendChild(s);
  });
  return musicKitLoadPromise;
}

export default function useMusicKit({ appName = 'Spidr' } = {}) {
  const [configured, setConfigured] = useState(null); // null = checking
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const instanceRef = useRef(null);
  const presenceTimerRef = useRef(null);

  // ── Boot: dev token → script → configure ────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await appleMusic.devToken();
        if (!alive) return;
        if (!res?.configured || !res?.token) { setConfigured(false); return; }
        setConfigured(true);
        await loadMusicKitScript();
        if (!alive) return;
        const mk = await window.MusicKit.configure({
          developerToken: res.token,
          app: { name: appName, build: '1.0.0' },
        });
        if (!alive) return;
        instanceRef.current = mk;
        setReady(true);
        setAuthorized(!!mk.isAuthorized);
      } catch (err) {
        // 503 (not configured) or script/network failure — hide the feature.
        if (alive) setConfigured((c) => (c === null ? false : c));
        console.warn('[MusicKit] unavailable:', err?.message);
      }
    })();
    return () => { alive = false; };
  }, [appName]);

  // ── Connect / disconnect ─────────────────────────────────────────────
  const authorize = useCallback(async () => {
    const mk = instanceRef.current;
    if (!mk) throw new Error('MusicKit not ready');
    const userToken = await mk.authorize(); // Apple's own popup flow
    setAuthorized(true);
    // Persist server-side: flips neural_links.apple_music_connected and lets
    // the server hit /v1/me endpoints (recently played).
    await appleMusic.saveUserToken(userToken);
    return userToken;
  }, []);

  const unauthorize = useCallback(async () => {
    const mk = instanceRef.current;
    try { await mk?.unauthorize(); } catch {}
    setAuthorized(false);
    try { await appleMusic.disconnect(); } catch {}
  }, []);

  // ── Full-track playback (subscribers) ────────────────────────────────
  // Plays a catalog song by id, optionally seeking — used by the DJ booth to
  // sync everyone to the session clock. Falls back by throwing; callers keep
  // the 30s preview path as the safety net.
  const playTrack = useCallback(async (songId, positionSec = 0) => {
    const mk = instanceRef.current;
    if (!mk) throw new Error('MusicKit not ready');
    if (!mk.isAuthorized) throw new Error('Not authorized');
    await mk.setQueue({ song: songId });
    await mk.play();
    if (positionSec > 1) {
      try { await mk.seekToTime(positionSec); } catch {}
    }
  }, []);

  const stop = useCallback(() => {
    try { instanceRef.current?.stop(); } catch {}
  }, []);

  const setVolume = useCallback((v01) => {
    const mk = instanceRef.current;
    if (mk) try { mk.volume = Math.max(0, Math.min(1, v01)); } catch {}
  }, []);

  // ── Presence: in-app playback IS the live now-playing signal ─────────
  useEffect(() => {
    if (!ready) return;
    const mk = instanceRef.current;
    if (!mk) return;

    const emitPresence = () => {
      const item = mk.nowPlayingItem;
      const socket = getSocket();
      if (!socket) return;
      if (mk.playbackState === window.MusicKit?.PlaybackStates?.playing && item) {
        socket.emit('nowplaying:update', {
          isPlaying: true,
          source: 'apple',
          provider: 'apple_music',
          trackName: item.title || item.attributes?.name || '',
          artists: [item.artistName || item.attributes?.artistName || ''].filter(Boolean),
          albumArt: item.artworkURL || item.attributes?.artwork?.url?.replace('{w}', '120').replace('{h}', '120') || '',
          durationMs: (item.playbackDuration || 0) * 1000,
          positionMs: (mk.currentPlaybackTime || 0) * 1000,
        });
      } else {
        socket.emit('nowplaying:clear');
      }
    };

    const onState = () => {
      emitPresence();
      // While playing, refresh the position every 20s so friends' widgets
      // don't drift stale.
      clearInterval(presenceTimerRef.current);
      if (mk.playbackState === window.MusicKit?.PlaybackStates?.playing) {
        presenceTimerRef.current = setInterval(emitPresence, 20000);
      }
    };

    mk.addEventListener('playbackStateDidChange', onState);
    mk.addEventListener('nowPlayingItemDidChange', onState);
    return () => {
      mk.removeEventListener('playbackStateDidChange', onState);
      mk.removeEventListener('nowPlayingItemDidChange', onState);
      clearInterval(presenceTimerRef.current);
    };
  }, [ready]);

  return { configured, ready, authorized, authorize, unauthorize, playTrack, stop, setVolume, instance: instanceRef };
}
