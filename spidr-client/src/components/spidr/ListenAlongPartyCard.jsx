import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, RefreshCw, Music, Radio } from 'lucide-react';
import { spotify } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * ListenAlongPartyCard — the Spotify side of an Apple Music DJ booth.
 *
 * The booth hosts from Apple Music only: the DJ's subscription supplies the
 * master recording, and Apple subscribers in the room play it locally in sync.
 * This card is how everyone on Spotify gets into the same song. It does NOT
 * stream them anything — the server resolves the DJ's current track by ISRC
 * and commands the listener's own Spotify client to play that recording at the
 * session's position. Each account plays for its own owner.
 *
 * Why the states are spelled out
 * ──────────────────────────────
 * Spotify can refuse this for four different reasons and all four look the
 * same from the outside: no account connected, a connection that predates the
 * playback-control scope, a free account (playback control is Premium-only,
 * with no workaround), and no device to play on. Collapsing them into one
 * disabled button teaches people the feature is broken. Each one names the
 * thing the person can actually do next.
 */

const SPOTIFY_GREEN = '#1DB954';
const APPLE_RED = '#fa233b';

function SpotifyGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg className={`${className} fill-current`} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.72-.659 13.44 1.62.361.181.54.78.241 1.2zm.12-3.36c-3.841-2.28-10.261-2.52-13.921-1.379-.6.18-1.2-.181-1.38-.78-.18-.601.18-1.2.78-1.381 4.2-1.26 11.28-1.02 15.78 1.681.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
    </svg>
  );
}

const fmt = ms => {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function ListenAlongPartyCard({ channelId, djSession, currentUser, isHost }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  // Local clock. The session stores `started_at`, not a ticking position, so
  // the progress bar is derived rather than pushed — no socket traffic per
  // second, and it stays smooth between session updates.
  const [now, setNow] = useState(() => Date.now());

  const listeners = djSession?.listen_along || [];
  const inParty = listeners.some(l => l.user_id === currentUser?.id);
  const myEntry = listeners.find(l => l.user_id === currentUser?.id);
  const durationMs = Number(djSession?.duration_ms) || 0;
  const startedAt = new Date(djSession?.started_at || 0).getTime();
  const positionMs = Number.isFinite(startedAt) && startedAt
    ? Math.min(durationMs || Infinity, Math.max(0, now - startedAt))
    : 0;
  const progressPercent = durationMs ? Math.min(100, (positionMs / durationMs) * 100) : 0;
  const hasIsrc = !!djSession?.isrc;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Eligibility. Only fetched for people who might actually press the button —
  // the host is already the audio source and has nothing to join.
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['listenAlongStatus'],
    queryFn: () => spotify.djSession.listenAlong.status(),
    enabled: !isHost,
    staleTime: 60_000,
    retry: false,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['djSession', channelId] }),
    [queryClient, channelId],
  );

  // Every failure path below names its own recovery. `code` comes from the
  // server (services/spotifySync.js), which is why this can be specific.
  const explain = (error) => {
    const code = error?.data?.code || error?.code;
    const messages = {
      no_active_device: 'Open Spotify on any device, then try again.',
      premium_required: 'Spotify Premium is required to listen along.',
      reconnect_required: 'Reconnect Spotify in Settings to grant playback control.',
      not_connected: 'Connect Spotify in Settings to listen along.',
      not_in_catalog: 'This recording is not on Spotify in your region.',
      no_isrc: 'This track has no ISRC, so Spotify cannot be matched to it.',
      rate_limited: 'Spotify is rate-limiting this account. Try again shortly.',
    };
    return messages[code] || error?.data?.error || error?.message || 'Could not sync Spotify.';
  };

  const run = async (action, success) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await refresh();
      success?.();
    } catch (error) {
      toast.error(explain(error));
      // A rejection can mean the grant went stale since the card mounted.
      if (['reconnect_required', 'not_connected', 'premium_required'].includes(error?.data?.code)) refetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const join = () => run(
    () => spotify.djSession.listenAlong.join(channelId),
    () => toast.success('Synced to the party'),
  );
  const leave = () => run(() => spotify.djSession.listenAlong.leave(channelId));
  const resync = () => run(
    () => spotify.djSession.listenAlong.resync(channelId),
    () => toast.success('Back in sync'),
  );

  const state = isHost ? 'host' : (statusLoading ? 'loading' : (status?.state || 'not_connected'));

  return (
    <div
      className="w-full rounded-2xl p-4 sm:p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(14,7,7,0.94), rgba(6,3,3,0.97))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header — who is on the aux, and on what */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            {djSession?.host_user_avatar ? (
              <img
                src={djSession.host_user_avatar}
                alt=""
                className="w-9 h-9 rounded-full object-cover"
                style={{ border: `1px solid ${APPLE_RED}80` }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white"
                style={{ background: 'rgba(250,35,59,0.15)', border: `1px solid ${APPLE_RED}80` }}
              >
                {(djSession?.host_user_name || '?')[0]}
              </div>
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{ background: APPLE_RED, border: '2px solid #0a0505' }}
              title="Apple Music host"
            >
              <Music size={7} className="text-white" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black text-white tracking-wide uppercase truncate">
                {djSession?.host_user_name || 'DJ'}
              </span>
              <span
                className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded"
                style={{ color: APPLE_RED, background: 'rgba(250,35,59,0.10)', border: `1px solid ${APPLE_RED}33` }}
              >
                APPLE MUSIC DJ
              </span>
            </div>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              {listeners.length ? `${listeners.length} on Spotify` : 'Broadcasting live signal'}
            </p>
          </div>
        </div>

        {inParty && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg flex-shrink-0"
            style={{ background: `${SPOTIFY_GREEN}1A`, border: `1px solid ${SPOTIFY_GREEN}33` }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: SPOTIFY_GREEN }} />
            <span className="text-[9px] font-mono font-bold" style={{ color: SPOTIFY_GREEN }}>SPOTIFY SYNC</span>
          </div>
        )}
      </div>

      {/* Track */}
      <div className="flex gap-3 sm:gap-4 rounded-xl p-3 mb-4 bg-white/[0.02] border border-white/5">
        {djSession?.album_art_url ? (
          <img src={djSession.album_art_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10 flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Music size={20} className="text-zinc-600" />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="text-sm font-bold text-white truncate">{djSession?.track_name || 'Live audio'}</h4>
          <p className="text-xs text-white/60 truncate mt-0.5">{djSession?.track_artist || djSession?.host_user_name || ''}</p>
          {durationMs > 0 && (
            <>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%`, background: inParty ? SPOTIFY_GREEN : APPLE_RED }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-white/30 mt-1 tabular-nums">
                <span>{fmt(positionMs)}</span><span>{fmt(durationMs)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Party roster + action */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
        <div className="flex items-center min-w-0">
          {listeners.length > 0 ? (
            <>
              <div className="flex -space-x-2 mr-2">
                {listeners.slice(0, 4).map(listener => (
                  listener.user_avatar ? (
                    <img
                      key={listener.user_id}
                      src={listener.user_avatar}
                      alt={listener.user_name}
                      title={listener.user_name}
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-[#0a0505] object-cover"
                    />
                  ) : (
                    <span
                      key={listener.user_id}
                      title={listener.user_name}
                      className="inline-flex h-6 w-6 rounded-full ring-2 ring-[#0a0505] bg-zinc-800 text-[9px] font-bold text-white items-center justify-center"
                    >
                      {(listener.user_name || '?')[0]}
                    </span>
                  )
                ))}
              </div>
              <span className="text-[10px] font-mono text-white/40 truncate">
                {listeners.length} listening along
                {listeners.length > 4 && ` (+${listeners.length - 4})`}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-mono text-white/30">No one on Spotify yet</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {inParty && (
            <button
              type="button"
              onClick={resync}
              disabled={busy}
              title="Re-sync my Spotify to the DJ"
              aria-label="Re-sync my Spotify to the DJ"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            </button>
          )}
          <PartyAction
            state={state}
            inParty={inParty}
            busy={busy}
            hasIsrc={hasIsrc}
            onJoin={join}
            onLeave={leave}
          />
        </div>
      </div>

      {/* One honest line under the action, only when there is something true
          to say. An always-present helper strip trains people to ignore it. */}
      {!isHost && !inParty && state !== 'ready' && state !== 'loading' && (
        <p className="text-[10px] text-white/35 mt-2.5 leading-relaxed">{status?.reason || EXPLAIN[state]}</p>
      )}
      {!isHost && state === 'ready' && !hasIsrc && (
        <p className="text-[10px] text-white/35 mt-2.5 leading-relaxed">
          This track has no ISRC, so Spotify has no reliable way to match the same recording. The next track should work.
        </p>
      )}
      {myEntry?.last_error === 'no_active_device' && (
        <p className="text-[10px] mt-2.5 leading-relaxed" style={{ color: '#fbbf24' }}>
          The last track change could not reach a Spotify device. Open Spotify, then hit re-sync.
        </p>
      )}
    </div>
  );
}

const EXPLAIN = {
  not_connected: 'Connect Spotify in Settings to listen along.',
  reconnect_required: 'Reconnect Spotify in Settings — Listen Along needs permission to control playback.',
  premium_required: 'Spotify Premium is required. Apple Music subscribers can listen in the booth directly.',
  error: 'Spotify is unreachable right now.',
};

function PartyAction({ state, inParty, busy, hasIsrc, onJoin, onLeave }) {
  if (state === 'host') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/40 bg-white/[0.04] border border-white/10">
        <Radio size={12} /> You are the source
      </span>
    );
  }
  if (state === 'loading') {
    return (
      <span className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/30 bg-white/[0.04] border border-white/10">
        <Loader2 size={12} className="animate-spin" /> Checking
      </span>
    );
  }
  if (inParty) {
    return (
      <button
        type="button"
        onClick={onLeave}
        disabled={busy}
        className="px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors disabled:opacity-40"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : 'Disconnect'}
      </button>
    );
  }
  // Premium is a wall, not a retry — there is no in-app path past it, so the
  // button is locked rather than dangled.
  if (state !== 'ready') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/35 bg-white/[0.04] border border-white/10">
        <Lock size={11} /> {state === 'premium_required' ? 'Premium only' : 'Unavailable'}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={busy || !hasIsrc}
      title={hasIsrc ? 'Play this track on your own Spotify, in sync' : 'This track cannot be matched on Spotify'}
      className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-black font-black text-[10px] tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: SPOTIFY_GREEN, boxShadow: `0 0 15px ${SPOTIFY_GREEN}4D` }}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <SpotifyGlyph />}
      {busy ? 'Syncing' : 'Listen Along'}
    </button>
  );
}
