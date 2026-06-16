import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc3, Volume2, Music, ChevronLeft, ChevronRight, Pause, Play, X, Loader2 } from 'lucide-react';
import { spotify } from '@/api/apiClient';
import useNowPlaying from '@/hooks/useNowPlaying';
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
  onStop,         // (host) ends the session
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Local-only volume slider for listeners (DJ has no local volume —
  // their Spotify client controls the source).
  const [localVolume, setLocalVolume] = useState(80);

  // Listen along — pull now-playing from the host. The host's own
  // useNowPlaying call elsewhere (their profile widget, for example)
  // shares the same react-query cache key so this is one network
  // request per ~25s per channel.
  const np = useNowPlaying(djSession?.host_id, { enabled: !!djSession?.host_id });

  const pct = np?.duration_ms ? Math.min(100, (np.progress_ms / np.duration_ms) * 100) : 0;

  // ── Host transport actions ──────────────────────────────────────────
  const handlePickTrack = () => setPickerOpen(true);
  const handleSelectTrack = async (track) => {
    if (!channel?.id || !track?.id) return;
    setBusy(true);
    try {
      // If a session is already running, this PATCHes it to the new
      // track. Otherwise it starts a new one.
      if (djSession?.host_id) {
        await spotify.djSession.next(channel.id, track.id);
      } else {
        await spotify.djSession.start(channel.id, track.id);
      }
      setPickerOpen(false);
      toast.success(`Now spinning: ${track.name}`);
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
        background: '#020202',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }}
    >
      {/* Ambient bass glow — soft Spotify-green radial behind the reactor */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(29, 185, 84, 0.15) 0%, transparent 60%)',
        }}
      />

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
              }}
            />
          ))}

          {/* Album disc */}
          <div
            className="relative z-10 w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              border: '4px solid #050505',
              boxShadow: '0 0 50px rgba(29, 185, 84, 0.30)',
              background: '#000',
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

      {/* Tactical Dock */}
      <footer className="relative z-20 w-full pb-6 flex justify-center px-4">
        {isHost ? (
          <HostDock
            onPick={handlePickTrack}
            onEnd={handleEnd}
            isPlaying={!!np?.is_playing}
            busy={busy}
            hasSession={!!djSession}
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
        emptyHint="Pick the next track. Everyone in the call's matrix updates the instant you select."
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
function HostDock({ onPick, onEnd, isPlaying, busy, hasSession }) {
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
      <DockBtn title="Previous" disabled>
        <ChevronLeft className="w-4 h-4" />
      </DockBtn>
      <DockBtn title={isPlaying ? 'Pause' : 'Play'} disabled>
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </DockBtn>
      <DockBtn title="Next" disabled>
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

function DockBtn({ children, title, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
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
