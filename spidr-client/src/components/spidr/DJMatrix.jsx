import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc3, Volume2, Music, ChevronLeft, ChevronRight, Pause, Play, X, Loader2, ListPlus, Trash2, SkipForward, MonitorSpeaker, Share2 } from 'lucide-react';
import { spotify } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { bestAudioRoute } from '@/lib/shareAudioSupport';
import useAudioSpectrum from '@/hooks/useAudioSpectrum';
import useNowPlaying from '@/hooks/useNowPlaying';
import useMusicKit from './useMusicKit';
import SpotifySearchModal from './SpotifySearchModal';
import { toast } from 'sonner';

/**
 * DJMatrix — the centerpiece view that takes over the voice call's
 * stream area when someone in the channel is hosting a DJ session.
 *
 * Architecture:
 *   • A "DJ session" is server state on the voice channel:
 *       { host_id, track_id, started_at }
 *     The host starts/changes/ends it via spotify.djSession.*.
 *   • Every channel member sees the same matrix because the server
 *     pushes the session over the channel's socket room.
 *   • The host's local Spotify client is the source of truth for what
 *     is playing — listeners poll the host's now-playing via the
 *     same useNowPlaying hook the Sonic Uplink uses, so the album
 *     art / progress always reflect what the host's Spotify client
 *     actually has on the speakers.
 *
 * UI parts (matches the mockup):
 *   • Top-left  "Spidr DJ: Active Session" pill (Spotify-green)
 *   • Top-right "Room Sync: 100%" pill (white-on-glass)
 *   • Center    Spinning album art + 3 expanding pulse rings
 *   • Track tag Bottom of the reactor pillar — title + artist + bar
 *   • Below     Audience semi-circle of bouncing avatars
 *   • Bottom    Tactical dock — DJ gets transport, listeners get local volume
 */
export default function DJMatrix({
  channel,        // { id, name }
  djSession,      // { host_id, host_user_name, track_id, started_at } | null
  isHost,         // true if currentUser.id === djSession.host_id
  currentUser,
  participants,   // [{ user_id, user_name, user_avatar }] — for audience roster
  screenStreams = {},   // socketId -> MediaStream (incoming shares)
  ownScreenStream = null, // this client's own outgoing share, if any
  onStop,         // (host) ends the session
}) {
  const queryClient = useQueryClient();
  // Full-length audio for EVERYONE in the call — including free-tier users —
  // rides the existing screen-share pipe rather than a music API. This tells
  // the DJ the one route that actually carries sound on their platform.
  const shareRoute = bestAudioRoute();

  // Flip the session's audio route the moment the DJ's share starts or stops
  // carrying sound. Doing it automatically matters: a manual toggle would
  // routinely be left in the wrong position, and the failure mode is the
  // whole room hearing the preview and the live audio at once.
  useEffect(() => {
    if (!isHost || !channel?.id || !djSession) return;
    const onShareAudio = async (e) => {
      const wantRoute = e.detail?.active ? 'stream' : 'preview';
      if ((djSession.audio_route || 'preview') === wantRoute) return;
      try {
        await spotify.djSession.next(channel.id, djSession.track_id, {
          track_name:    djSession.track_name,
          track_artist:  djSession.track_artist,
          album_art_url: djSession.album_art_url,
          preview_url:   djSession.preview_url,
          external_url:  djSession.external_url,
          duration_ms:   djSession.duration_ms,
          source:        djSession.source,
          audio_route:   wantRoute,
        });
        queryClient.invalidateQueries({ queryKey: ['dj-session', channel.id] });
      } catch { /* non-fatal — the preview simply keeps playing */ }
    };
    window.addEventListener('spidr-share-audio', onShareAudio);
    return () => window.removeEventListener('spidr-share-audio', onShareAudio);
  }, [isHost, channel?.id, djSession?.track_id, djSession?.audio_route, queryClient]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Local-only volume slider for listeners (DJ has no local volume —
  // their Spotify client controls the source).
  const [localVolume, setLocalVolume] = useState(80);
  // Local pause. Deliberately per-listener: Spidr has no system-level control
  // over the DJ's Spotify app, so "pause" can only ever mean "stop MY audio".
  const [userPaused, setUserPaused] = useState(false);

  // Listen along — pull now-playing from the host. The host's own
  // useNowPlaying call elsewhere (their profile widget, for example)
  // shares the same react-query cache key so this is one network
  // request per ~25s per channel.
  const np = useNowPlaying(djSession?.host_id, { enabled: !!djSession?.host_id });

  // ── Playback engine ─────────────────────────────────────────────────
  // THE fix for "DJ session shows the song but plays no music": every client
  // (host AND listeners) now plays the track's 30-second Spotify preview,
  // roughly synced to the session clock (started_at). Full-track playback
  // would require every listener to have Spotify Premium + OAuth (Web
  // Playback SDK) — the preview keeps the booth working for everyone free.
  // If Spotify has no preview for the track (increasingly common since late
  // 2024), we surface that clearly instead of playing silence.
  const audioRef = useRef(null);
  const [audioBlocked, setAudioBlocked] = useState(false); // autoplay gate hit
  const previewUrl = djSession?.preview_url || '';
  // When the DJ pipes real audio through their screen share, the 30s preview
  // must NOT also play — otherwise every listener hears two copies of the
  // song at different offsets. The session carries the authoritative route.
  const audioRoute = djSession?.audio_route || 'preview';
  const streamingLive = audioRoute === 'stream';

  // LISTENER-SIDE FAILSAFE. If the DJ's app crashes, their laptop sleeps, or
  // their connection dies, their client can't tell us anything — it's gone.
  // So listeners don't trust the session flag alone: if the route says
  // 'stream' but no screen stream is actually arriving from the host, we
  // treat the live audio as dead locally and fall back to the preview
  // ourselves. Without this the room sits in silence looking at a "Live
  // audio" badge, which is the worst of both states.
  const hostStreamAlive = React.useMemo(() => {
    if (!streamingLive) return true;
    const streams = [
      ...Object.values(screenStreams || {}),
      ...(ownScreenStream ? [ownScreenStream] : []),
    ];
    return streams.some(s => {
      try { return s.getAudioTracks().some(t => t.readyState === 'live'); }
      catch { return false; }
    });
  }, [streamingLive, screenStreams, ownScreenStream]);

  // Effective route — what this client should ACTUALLY do right now.
  const liveAudioActive = streamingLive && hostStreamAlive;

  // NOTE ON PLACEMENT: this block must sit BELOW liveAudioActive, previewUrl
  // and userPaused. It originally sat near the top of the component and
  // referenced all three before they were declared — const bindings are
  // hoisted but unreachable until their line runs, so every render threw
  // "Cannot access ... before initialization" and the whole booth white-
  // screened. Same trap that took out the friends page in 1.9.47.
  // ── Biometric visualiser ────────────────────────────────────────────────
  // Analyse whatever the room is ACTUALLY hearing, not a fixed animation.
  // On a live share that's the DJ's incoming screen-share audio; otherwise
  // it's the local preview element. Each listener analyses their own
  // received audio rather than the DJ broadcasting numbers — the pulse then
  // matches what THAT person hears, instead of drifting against their jitter
  // buffer by tens of milliseconds.
  const spectrumStream = React.useMemo(() => {
    if (!liveAudioActive) return null;
    const all = [
      ...Object.values(screenStreams || {}),
      ...(ownScreenStream ? [ownScreenStream] : []),
    ];
    return all.find(s => {
      try { return s.getAudioTracks().some(t => t.readyState === 'live'); }
      catch { return false; }
    }) || null;
  }, [liveAudioActive, screenStreams, ownScreenStream]);

  const spectrum = useAudioSpectrum({
    stream: spectrumStream,
    element: !liveAudioActive && previewUrl ? audioRef.current : null,
    // Nothing to visualise when the booth is silent — an idle booth costs
    // zero rather than animating against an empty buffer.
    enabled: !!djSession && (liveAudioActive || (!!previewUrl && !userPaused)),
  });


  // ── Apple Music full-track upgrade ──────────────────────────────────
  // For 'apple' sessions, listeners who connected Apple Music (and have a
  // subscription) hear the ENTIRE song via MusicKit, synced to the session
  // clock — everyone else stays on the 30s preview loop. This is the
  // listen-along Discord doesn't have.
  const musicKit = useMusicKit();
  const [fullTrackActive, setFullTrackActive] = useState(false);
  const canFullTrack = djSession?.source === 'apple' && musicKit.ready && musicKit.authorized;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!djSession || !canFullTrack) { setFullTrackActive(false); return; }
      try {
        const startedMs = djSession.started_at ? new Date(djSession.started_at).getTime() : Date.now();
        const offsetSec = Math.max(0, (Date.now() - startedMs) / 1000);
        // Past the track's end (host idle on a finished song) → stay on preview loop.
        const durSec = (djSession.duration_ms || 0) / 1000;
        if (durSec && offsetSec >= durSec - 2) { setFullTrackActive(false); return; }
        await musicKit.playTrack(djSession.track_id, offsetSec);
        if (!cancelled) {
          setFullTrackActive(true);
          audioRef.current?.pause(); // silence the preview loop underneath
        }
      } catch (err) {
        // Not a subscriber / DRM / anything — preview loop stays the truth.
        if (!cancelled) setFullTrackActive(false);
        console.warn('[DJ] full-track fallback to preview:', err?.message);
      }
    })();
    return () => { cancelled = true; try { musicKit.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [djSession?.track_id, djSession?.started_at, canFullTrack]);

  // Volume follows the booth slider in both modes.
  useEffect(() => {
    if (fullTrackActive) musicKit.setVolume(localVolume / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localVolume, fullTrackActive]);

  // THE ZOMBIE-PREVIEW KILLER.
  //
  // Calling el.pause() was not enough and this is why the 30s clip kept
  // playing over a live share:
  //   1. The cleanup never removed the pending 'canplay' listener, so when
  //      the route flipped to 'stream' that listener fired afterwards and
  //      called play() again on an element we thought we'd stopped.
  //   2. An in-flight play() promise resolves AFTER pause() runs, resuming
  //      playback a beat later.
  //   3. Leaving el.src set means the browser can keep buffering and
  //      re-entering a playable state on its own.
  // So suppression now tears the element down completely, and every run
  // tracks whether it has been superseded before it is allowed to play.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const suppressed = !djSession || !previewUrl || fullTrackActive || liveAudioActive || userPaused;
    if (suppressed) {
      try {
        el.pause();
        el.removeAttribute('src');   // stop buffering entirely
        el.load();                   // abort any in-flight fetch + reset
      } catch {}
      return;
    }

    let cancelled = false;           // guards against a late canplay/promise
    el.src = previewUrl;
    el.loop = true; // 30s clip loops for the length of the session
    const startedMs = djSession.started_at ? new Date(djSession.started_at).getTime() : Date.now();
    const offsetSec = Math.max(0, ((Date.now() - startedMs) / 1000) % 30);
    const play = () => {
      if (cancelled) return;         // route changed while we were loading
      try { el.currentTime = offsetSec; } catch {}
      el.play()
        .then(() => { if (cancelled) el.pause(); else setAudioBlocked(false); })
        .catch(() => { if (!cancelled) setAudioBlocked(true); });
    };
    if (el.readyState >= 2) play();
    else { el.addEventListener('canplay', play); el.load(); }

    return () => {
      cancelled = true;
      el.removeEventListener('canplay', play);   // <- the missing piece
      try { el.pause(); } catch {}
    };
  }, [djSession?.track_id, previewUrl, djSession?.started_at, fullTrackActive, liveAudioActive, userPaused]);

  // Volume slider actually controls the booth audio now.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, localVolume / 100));
  }, [localVolume]);

  const unlockAudio = () => {
    audioRef.current?.play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  };

  const pct = np?.duration_ms ? Math.min(100, (np.progress_ms / np.duration_ms) * 100) : 0;

  // ── Host transport actions ──────────────────────────────────────────
  // Picker mode: 'now' replaces the current track (host only), 'queue'
  // appends. Reusing one modal keeps search behaviour identical in both.
  const [pickerMode, setPickerMode] = useState('now');
  // Pause behaves differently per route, because the three sources are
  // physically different things:
  //   preview   — pause the local <audio> element
  //   fulltrack — pause the local MusicKit player
  //   stream    — Spidr cannot pause the DJ's app, so we mute the incoming
  //               WebRTC audio for THIS listener only, and say so plainly
  //               rather than pretending the button reached the source.
  const togglePause = () => {
    const next = !userPaused;
    setUserPaused(next);
    if (liveAudioActive) {
      Object.values(screenStreams || {}).forEach((s) => {
        try { s.getAudioTracks().forEach((t) => { t.enabled = !next; }); } catch {}
      });
      if (next) {
        toast('Muted for you', {
          description: 'Audio is live via the DJ\'s share — pause it in their app to stop it for everyone.',
        });
      }
      return;
    }
    if (fullTrackActive) {
      try { next ? musicKit.pause?.() : musicKit.play?.(); } catch {}
    }
    // preview route is handled by the effect above via `userPaused`
  };

  // ── Pass the Aux ────────────────────────────────────────────────────────
  const [auxPickerOpen, setAuxPickerOpen] = useState(false);
  const pendingAux = djSession?.handoff || null;
  const auxOfferedToMe = !!pendingAux && pendingAux.to_user_id === currentUser?.id;
  const auxOfferedByMe = !!pendingAux && pendingAux.from_user_id === currentUser?.id;

  const handlePassAux = async (targetId, targetName) => {
    if (!channel?.id) return;
    setAuxPickerOpen(false);
    try {
      await spotify.djSession.passAux(channel.id, targetId, targetName);
      queryClient.invalidateQueries({ queryKey: ['dj-session', channel.id] });
      toast.success(`Aux offered to ${targetName}`);
    } catch (err) {
      toast.error(err?.message || 'Could not pass the aux');
    }
  };

  const handleAcceptAux = async () => {
    if (!channel?.id) return;
    try {
      await spotify.djSession.acceptAux(channel.id);
      queryClient.invalidateQueries({ queryKey: ['dj-session', channel.id] });
      toast.success('You have the aux', {
        description: 'Hit Share Audio to start playing for the room.',
      });
      // Nudge straight into the share flow — taking the aux without sharing
      // leaves the room on the 30s preview, which is the confusing state.
      window.dispatchEvent(new CustomEvent('spidr-open-share'));
    } catch (err) {
      toast.error(err?.message || 'Could not take the aux');
    }
  };

  const handleDeclineAux = async () => {
    if (!channel?.id) return;
    try {
      await spotify.djSession.declineAux(channel.id);
      queryClient.invalidateQueries({ queryKey: ['dj-session', channel.id] });
    } catch { /* non-fatal */ }
  };

  const handlePickTrack = () => { setPickerMode('now'); setPickerOpen(true); };
  const handleQueueTrack = () => { setPickerMode('queue'); setPickerOpen(true); };

  const queue = djSession?.queue || [];

  const handleDequeue = async (qid) => {
    if (!channel?.id) return;
    try {
      await spotify.djSession.dequeue(channel.id, qid);
      queryClient.invalidateQueries({ queryKey: ['dj-session', channel.id] });
    } catch (err) {
      toast.error(err?.message || 'Could not remove track');
    }
  };

  const handleAdvance = async () => {
    if (!channel?.id) return;
    setBusy(true);
    try {
      await spotify.djSession.advance(channel.id);
      queryClient.invalidateQueries({ queryKey: ['dj-session', channel.id] });
    } catch (err) {
      toast.error(err?.message || 'Could not advance');
    } finally {
      setBusy(false);
    }
  };
  const handleSelectTrack = async (track) => {
    if (!channel?.id || !track?.id) return;
    // Queue mode: append rather than hijacking what's currently playing.
    if (pickerMode === 'queue') {
      setBusy(true);
      try {
        await spotify.djSession.enqueue(channel.id, track.id, {
          track_name:    track.name || '',
          track_artist:  track.artist || '',
          album_art_url: track.album_art_url || '',
          preview_url:   track.preview_url || '',
          external_url:  track.external_url || `https://open.spotify.com/track/${track.id}`,
          duration_ms:   track.duration_ms || 0,
          source:        track.source === 'apple' ? 'apple' : 'spotify',
        });
        queryClient.invalidateQueries({ queryKey: ['dj-session', channel.id] });
        setPickerOpen(false);
        toast.success(`Queued: ${track.name}`);
      } catch (err) {
        toast.error(err?.message || 'Could not queue track');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      // If a session is already running, this PATCHes it to the new
      // track. Otherwise it starts a new one.
      const meta = {
        track_name:    track.name || '',
        track_artist:  track.artist || '',
        album_art_url: track.album_art_url || '',
        preview_url:   track.preview_url || '',
        external_url:  track.external_url || `https://open.spotify.com/track/${track.id}`,
        duration_ms:   track.duration_ms || 0,
        source:        track.source === 'apple' ? 'apple' : 'spotify',
        // Keep the room on the live share while one is running — otherwise
        // announcing a new track would silently drop everyone back to the
        // 30s preview on top of the audio they're already hearing.
        audio_route:   streamingLive ? 'stream' : 'preview',
      };
      if (djSession?.host_id) {
        await spotify.djSession.next(channel.id, track.id, meta);
      } else {
        await spotify.djSession.start(channel.id, track.id, meta);
      }
      setPickerOpen(false);
      toast.success(
        streamingLive
          ? `Now showing: ${track.name}`
          : `Now spinning: ${track.name}`,
        streamingLive
          ? { description: 'Room art updated — audio keeps riding your share.' }
          : undefined
      );
    } catch (err) {
      console.error('[DJMatrix] start/next failed:', err);
      toast.error(err?.message || 'Could not change track');
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!channel?.id) return;
    setBusy(true);
    try {
      await spotify.djSession.end(channel.id);
      onStop?.();
      toast('Session ended');
    } catch (err) {
      console.error('[DJMatrix] end failed:', err);
      toast.error(err?.message || 'Could not end session');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col"
      style={{
        // Spidr gradient stage — deep black bleeding into brand red/purple.
        // (Replaced the old 60px grid-line pattern that read as generic/AI.)
        background:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124, 58, 237, 0.16), transparent 60%),' +
          'radial-gradient(ellipse 70% 55% at 50% 115%, rgba(220, 38, 38, 0.16), transparent 60%),' +
          'linear-gradient(180deg, #050505 0%, #0a0508 50%, #050505 100%)',
      }}
    >
      {/* Ambient bass glow — now driven by the actual low end rather than a
          fixed value, so the whole room breathes with the track. Radius and
          opacity both track bass; treble adds a faint high shimmer on top so
          hi-hats register without muddying the main pulse. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(29, 185, 84, ${0.10 + spectrum.bass * 0.22}) 0%, transparent ${52 + spectrum.bass * 22}%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(180, 255, 210, ${spectrum.treble * 0.07}) 0%, transparent 40%)`,
        }}
      />

      {/* Booth audio — hidden element every client plays the preview through */}
      <audio ref={audioRef} preload="auto" />

      {/* Autoplay unlock — browsers block audio until a gesture */}
      {djSession && previewUrl && audioBlocked && (
        <button
          onClick={unlockAudio}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DB954] text-black text-[11px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(29,185,84,0.4)] hover:scale-105 transition-transform"
        >
          ▶ Tap to hear the booth
        </button>
      )}
      {/* Full-track mode badge — Apple Music subscribers hear the whole song */}
      {djSession && fullTrackActive && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_18px_rgba(250,36,60,0.4)]"
          style={{ background: 'linear-gradient(135deg, #fa243c, #a250fa)' }}
        >
          ♫ Full track · Apple Music
        </div>
      )}
      {/* No-preview notice — Spotify stopped shipping previews for many
          tracks in late 2024; be honest instead of playing silence. */}
      {/* Substitute-source notice — when Spotify shipped no preview we fall
          back to a verified iTunes match, which is a different recording of
          the same track. Saying so beats letting it sound "off" unexplained. */}
      {djSession && previewUrl && !fullTrackActive && !liveAudioActive && djSession?.preview_source === 'itunes' && (
        <div className="relative z-20 mx-auto mb-2 w-fit px-3 py-1 rounded-full bg-white/[0.03] border border-white/10">
          <span className="font-mono text-[9px] tracking-widest uppercase text-white/40">
            Preview via iTunes · 30s
          </span>
        </div>
      )}

      {djSession && liveAudioActive && (
        <div className="relative z-20 mx-auto mb-2 w-fit px-3 py-1 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/30">
          <span className="font-mono text-[9px] tracking-widest uppercase text-[#1DB954]">
            Live audio · full track via {djSession?.host_user_name || 'the DJ'}
          </span>
        </div>
      )}

      {djSession && !previewUrl && !fullTrackActive && !liveAudioActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-black/70 border border-white/10 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
          No audio preview for this track — DJ, try another song
        </div>
      )}

      {/* Header pills */}
      <header className="relative z-20 w-full flex justify-between items-center p-4">
        <SessionPill />
        <SyncPill percent={djSession ? 100 : 0} />
      </header>

      {/* Center reactor — album art surrounded by pulse rings */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-6">
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center mb-14">
          {/* 3 expanding rings staggered by 0.8s */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className="absolute inset-0 rounded-full border-2 pointer-events-none"
              style={{
                borderColor: '#1DB954',
                animation: `spidr-dj-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) ${i * 0.8}s infinite`,
                // Bass drives ring weight and glow. The expansion keyframe
                // still provides the base motion; the audio modulates how
                // HARD each pulse hits, so 808s visibly punch.
                borderWidth: `${2 + spectrum.bass * 4}px`,
                opacity: 0.35 + spectrum.bass * 0.65,
                filter: `drop-shadow(0 0 ${6 + spectrum.bass * 26}px rgba(29,185,84,${0.25 + spectrum.bass * 0.5}))`,
              }}
            />
          ))}

          {/* Album disc */}
          <div
            className="relative z-10 w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              border: '4px solid #050505',
              boxShadow: `0 0 ${40 + spectrum.level * 70}px rgba(29, 185, 84, ${0.22 + spectrum.level * 0.55})`,
              background: '#000',
              // Mids swell the disc itself — subtle, since the art is the
              // focal point and shouldn't wobble.
              transform: `scale(${1 + spectrum.mid * 0.045})`,
            }}
          >
            {np?.album_art_url ? (
              <img
                src={np.album_art_url}
                alt=""
                className="w-full h-full object-cover opacity-90"
                style={{ animation: 'spidr-dj-spin 12s linear infinite' }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #1f1f1f, #050505)',
                  animation: 'spidr-dj-spin 12s linear infinite',
                }}
              >
                <Disc3 className="w-14 h-14 text-white/30" />
              </div>
            )}
            {/* Center pin */}
            <span
              className="absolute w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: '#020202', border: '2px solid #111' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#1DB954]"
                style={{ boxShadow: '0 0 6px #1DB954' }}
              />
            </span>
            {/* Subtle gloss */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'linear-gradient(to top right, rgba(255,255,255,0.10), transparent 60%)',
              }}
            />
          </div>

          {/* Track tag — sits at the bottom of the reactor */}
          <div
            className="absolute -bottom-7 w-72 rounded-xl p-3 flex flex-col items-center z-20"
            style={{
              background: 'rgba(10, 10, 10, 0.90)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
            }}
          >
            <h1 className="text-lg font-black text-white tracking-wide truncate max-w-full">
              {np?.track_name || (djSession ? 'Loading track…' : 'No track')}
            </h1>
            <p className="text-[11px] text-white/50 font-bold uppercase tracking-widest mt-0.5 truncate max-w-full">
              {np?.artist || '—'}
            </p>
            <div
              className="w-full h-1 rounded-full mt-3 overflow-hidden"
              style={{ background: 'rgba(255, 255, 255, 0.10)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-linear"
                style={{
                  width: `${pct}%`,
                  background: '#1DB954',
                  boxShadow: pct > 0 ? '0 0 8px #1DB954' : 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Audience roster — semi-circle of avatars below the reactor.
            Each bounces subtly to a different phase so the roster
            collectively reads as "everyone is hearing it". */}
        <AudienceRoster
          participants={participants}
          hostId={djSession?.host_id}
          enabled={!!djSession && !!np?.is_playing}
        />
      </main>

      {/* ── Pass the Aux prompts ───────────────────────────────────────── */}
      {auxOfferedToMe && (
        <div className="relative z-30 w-full max-w-md mx-auto px-4 mb-3">
          <div
            className="rounded-2xl p-4 border"
            style={{
              background: 'rgba(29,185,84,0.08)',
              borderColor: 'rgba(29,185,84,0.4)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#1DB954] mb-1">
              Aux offered
            </p>
            <p className="text-sm text-white mb-3">
              <strong>{pendingAux.from_user_name}</strong> wants to pass you the aux.
              You'll share your audio to keep the music going.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptAux}
                className="flex-1 py-2 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-black text-[10px] font-black tracking-widest uppercase transition-colors"
              >
                Take the aux
              </button>
              <button
                onClick={handleDeclineAux}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-black tracking-widest uppercase transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {auxOfferedByMe && (
        <div className="relative z-30 w-full max-w-md mx-auto px-4 mb-3">
          <div className="rounded-xl px-4 py-2.5 bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
            <p className="text-[11px] text-white/60 min-w-0 truncate">
              Waiting for <strong className="text-white/85">{pendingAux.to_user_name}</strong> to take the aux…
            </p>
            <button
              onClick={handleDeclineAux}
              className="text-[10px] font-black tracking-widest uppercase text-white/40 hover:text-white shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Host's target picker */}
      {auxPickerOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setAuxPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10,10,10,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">Pass the aux to</h3>
              <button onClick={() => setAuxPickerOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto spidr-scroll">
              {(participants || []).filter(p => p.user_id !== currentUser?.id).length === 0 ? (
                <p className="text-[11px] text-white/40 text-center py-6">
                  Nobody else is in the call yet.
                </p>
              ) : (participants || [])
                .filter(p => p.user_id !== currentUser?.id)
                .map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => handlePassAux(p.user_id, p.user_name)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.05] transition-colors text-left"
                  >
                    <img
                      src={p.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id}`}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-white/10"
                    />
                    <span className="text-sm text-white truncate">{p.user_name || 'Spider'}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Up Next ─────────────────────────────────────────────────────────
          The collaborative queue. Anyone in the call can append; the DJ
          advances. Each row shows who added it, and you can pull your own
          entry (the DJ can pull anyone's). */}
      {djSession && (
        <div className="relative z-20 w-full max-w-xl mx-auto px-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/40">
              Up Next{queue.length > 0 ? ` · ${queue.length}` : ''}
            </span>
            <div className="flex items-center gap-2">
              {isHost && (
                <button
                  onClick={() => setAuxPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-[#1DB954] border border-white/10 hover:border-[#1DB954]/40 bg-white/[0.02] transition-all"
                  title="Hand the session to someone else"
                >
                  <Share2 className="w-3.5 h-3.5" /> Pass the aux
                </button>
              )}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('spidr-open-share'))}
                title={shareRoute.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-white border border-white/10 hover:border-white/30 bg-white/[0.02] transition-all"
              >
                <MonitorSpeaker className="w-3.5 h-3.5" /> Share audio
              </button>
              <button
                onClick={handleQueueTrack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-[#1DB954] border border-white/10 hover:border-[#1DB954]/40 bg-white/[0.02] transition-all"
              >
                <ListPlus className="w-3.5 h-3.5" /> Add to queue
              </button>
              {isHost && queue.length > 0 && (
                <button
                  onClick={handleAdvance}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase text-black bg-[#1DB954] hover:bg-[#1ed760] transition-all disabled:opacity-50"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Play next
                </button>
              )}
            </div>
          </div>

          {queue.length === 0 ? (
            <p className="text-[11px] text-white/25 text-center py-2">
              Queue is empty — anyone in the call can add a track.
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto spidr-scroll">
              {queue.map((q) => {
                const mine = q.added_by === currentUser?.id;
                return (
                  <div
                    key={q.qid}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02] border border-white/5"
                  >
                    {q.album_art_url
                      ? <img src={q.album_art_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0"><Music className="w-3.5 h-3.5 text-white/30" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-white truncate">{q.track_name}</p>
                      <p className="text-[10px] text-white/40 truncate">
                        {q.track_artist} · added by {mine ? 'you' : q.added_by_name}
                      </p>
                    </div>
                    {(mine || isHost) && (
                      <button
                        onClick={() => handleDequeue(q.qid)}
                        className="text-white/25 hover:text-red-400 transition-colors shrink-0"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tactical Dock */}
      <footer className="relative z-20 w-full pb-6 flex justify-center px-4">
        {isHost ? (
          <HostDock
            onPick={handlePickTrack}
            onEnd={handleEnd}
            isPlaying={!!np?.is_playing}
            busy={busy}
            hasSession={!!djSession}
            volume={localVolume}
            setVolume={setLocalVolume}
            paused={userPaused}
            onTogglePause={togglePause}
            canSkip={queue.length > 0}
            onSkip={handleAdvance}
          />
        ) : djSession ? (
          <ListenerDock volume={localVolume} setVolume={setLocalVolume} />
        ) : null}
      </footer>

      {/* Track picker — reuses the existing Spotify search modal so
          the DJ can pick the next track from Spotify's full catalog. */}
      <SpotifySearchModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectTrack}
        title="Change Track"
        subtitle="Spidr DJ"
        actionLabel="Spin"
        requirePreview
        allowAppleMusic
        emptyHint="Pick the next track — only songs with a playable 30s preview are shown, so the whole call hears it."
      />

      <style>{`
        @keyframes spidr-dj-ring {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes spidr-dj-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes spidr-aud-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SessionPill — Spotify-tinted glass chip in the top-left.
function SessionPill() {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-full"
      style={{
        background: 'rgba(10, 10, 10, 0.80)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(29, 185, 84, 0.30)',
        boxShadow: '0 0 15px rgba(29, 185, 84, 0.20)',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#1DB954" aria-hidden>
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15.001 10.62 18.72 12.9c.361.181.54.84.24 1.14zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.239.54-.959.72-1.56.3z"/>
      </svg>
      <span className="font-bold tracking-widest text-[10px] uppercase text-white/90">
        Spidr DJ: Active Session
      </span>
    </div>
  );
}

// SyncPill — Room Sync % display in the top-right.
function SyncPill({ percent = 100 }) {
  return (
    <div
      className="px-4 py-2 rounded-full font-mono text-[10px] tracking-widest text-white/60"
      style={{
        background: 'rgba(0, 0, 0, 0.40)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
      }}
    >
      ROOM SYNC: {percent}%
    </div>
  );
}

// AudienceRoster — semi-circle of avatars subtly bouncing.
function AudienceRoster({ participants = [], hostId, enabled }) {
  // Cap the visible row at 7 so the layout doesn't break with packed
  // calls. The host is always shown first. Listeners after.
  const sorted = React.useMemo(() => {
    if (!Array.isArray(participants)) return [];
    return [...participants].sort((a, b) => {
      if (a.user_id === hostId) return -1;
      if (b.user_id === hostId) return 1;
      return 0;
    }).slice(0, 7);
  }, [participants, hostId]);

  return (
    <div className="flex items-center justify-center gap-5 mt-10 flex-wrap max-w-xl">
      {sorted.map((p, i) => {
        const isHost = p.user_id === hostId;
        return (
          <div
            key={p.user_id || i}
            className="flex flex-col items-center gap-1.5"
            style={
              enabled
                ? { animation: `spidr-aud-bounce 0.8s ease-in-out ${(i * 0.18) % 1.6}s infinite` }
                : undefined
            }
          >
            <div className="relative">
              <div
                className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  background: '#111',
                  border: `2px solid ${isHost ? '#1DB954' : 'rgba(29, 185, 84, 0.50)'}`,
                  boxShadow: isHost
                    ? '0 0 18px rgba(29, 185, 84, 0.45)'
                    : '0 0 12px rgba(29, 185, 84, 0.18)',
                }}
              >
                {p.user_avatar ? (
                  <img src={p.user_avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xs font-bold">
                    {(p.user_name || '?').charAt(0)}
                  </span>
                )}
              </div>
              {/* Speaker icon */}
              <div
                className="absolute -bottom-1 -right-1 rounded-full p-0.5 flex items-center justify-center"
                style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.10)' }}
              >
                <Volume2 className="w-2.5 h-2.5" color="#1DB954" strokeWidth={2.5} />
              </div>
            </div>
            <span className="text-[10px] font-bold text-white/60 truncate max-w-[80px]">
              {p.user_name || 'Spider'}
              {isHost && <span className="text-[#1DB954] ml-1">·DJ</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// HostDock — DJ controls: pick track, play/pause hint, end session.
function HostDock({ onPick, onEnd, isPlaying, busy, hasSession, volume, setVolume, paused, onTogglePause, canSkip, onSkip }) {
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-2xl"
      style={{
        background: 'rgba(0, 0, 0, 0.80)',
        backdropFilter: 'blur(40px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
      }}
    >
      {/* Transport. These were previously hardcoded `disabled` with no
          handlers at all — decoration that looked functional, which is why
          pause appeared broken. Prev stays disabled honestly: there is no
          history stack to step back through yet. */}
      <DockBtn title="No previous track" disabled>
        <ChevronLeft className="w-4 h-4" />
      </DockBtn>
      <DockBtn
        title={paused ? 'Resume (for you)' : 'Pause (for you)'}
        onClick={onTogglePause}
      >
        {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </DockBtn>
      <DockBtn
        title={canSkip ? 'Play next queued track' : 'Queue is empty'}
        onClick={canSkip ? onSkip : undefined}
        disabled={!canSkip}
      >
        <ChevronRight className="w-4 h-4" />
      </DockBtn>

      <div className="w-px h-6 bg-white/10 mx-2" />

      {/* The only host control that actually does anything client-side
          today is "pick next track" — true play/pause/seek control over
          Spotify playback requires the Web Playback SDK + Premium,
          which is a separate per-user OAuth + device-handoff flow. */}
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="px-4 py-2.5 rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50"
        style={{
          background: '#1DB954',
          color: '#020202',
          boxShadow: '0 0 15px rgba(29, 185, 84, 0.45)',
        }}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
        {hasSession ? 'Change track' : 'Pick track'}
      </button>

      <div className="w-px h-6 bg-white/10 mx-2" />

      {/* Host volume — local monitoring level for the DJ. Drives the same
          <audio> element and MusicKit player the listeners' slider does. */}
      <div className="flex items-center gap-2 px-1">
        <Volume2 className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          value={volume ?? 80}
          onChange={(e) => setVolume?.(Number(e.target.value))}
          className="w-24 accent-[#1DB954] cursor-pointer"
          title={`Volume ${volume ?? 80}%`}
        />
        <span className="text-[9px] font-mono tabular-nums text-white/40 w-6 text-right">
          {volume ?? 80}
        </span>
      </div>

      <div className="w-px h-6 bg-white/10 mx-2" />

      <button
        type="button"
        onClick={onEnd}
        disabled={busy}
        className="px-4 py-2.5 rounded-xl font-bold text-[10px] tracking-widest uppercase text-white transition-all flex items-center gap-2 disabled:opacity-50"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.20)',
        }}
      >
        <X className="w-3.5 h-3.5" />
        End Session
      </button>
    </div>
  );
}

// ListenerDock — local-volume slider that does NOT affect the room.
function ListenerDock({ volume, setVolume }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[280px]"
      style={{
        background: 'rgba(0, 0, 0, 0.80)',
        backdropFilter: 'blur(40px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
      }}
    >
      <Volume2 className="w-4 h-4 text-white/50" />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-mono uppercase tracking-widest text-white/40 mb-1">
          Local volume
        </p>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(parseInt(e.target.value, 10))}
          className="w-full spidr-dj-listener-slider"
          aria-label="Local volume"
        />
        <style>{`
          .spidr-dj-listener-slider {
            -webkit-appearance: none; appearance: none;
            height: 3px; border-radius: 2px; outline: none;
            background: linear-gradient(to right,
              #1DB954 0%, #1DB954 ${volume}%,
              rgba(255, 255, 255, 0.10) ${volume}%, rgba(255, 255, 255, 0.10) 100%);
          }
          .spidr-dj-listener-slider::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 10px; height: 10px; border-radius: 50%;
            background: #fff; cursor: pointer;
            box-shadow: 0 0 6px rgba(29, 185, 84, 0.65);
          }
          .spidr-dj-listener-slider::-moz-range-thumb {
            width: 10px; height: 10px; border-radius: 50%;
            background: #fff; cursor: pointer; border: 0;
            box-shadow: 0 0 6px rgba(29, 185, 84, 0.65);
          }
        `}</style>
      </div>
      <span className="font-mono text-[10px] text-white/50 w-7 text-right tabular-nums">
        {volume}
      </span>
    </div>
  );
}

// NOTE: this swallowed onClick entirely — every transport button was inert
// even once handlers were passed, which is the other half of why pause
// looked broken.
function DockBtn({ children, title, disabled, onClick }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
        disabled
          ? 'text-white/30 cursor-not-allowed'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
