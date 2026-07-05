import React from 'react';
import useNowPlaying from '@/hooks/useNowPlaying';
import { useNowPlaying as useNowPlayingPresence } from '@/context/NowPlayingContext';

/**
 * NowPlayingPulse — the tiny "Listening to Spotify" indicator that
 * surfaces in member rosters / sidebars / mini avatar tooltips. Pure
 * visual: a 3-bar pulsing equalizer in Spotify green + optional track
 * name. Renders NOTHING when the user isn't currently playing, so
 * it's safe to drop in anywhere member rows render — empty state is
 * literally zero space.
 *
 * Sources (whichever has a track wins):
 *   1. Server-side Spotify poller  → hooks/useNowPlaying(userId)
 *      Works when the target user connected their Spotify account.
 *   2. Generic presence stream     → context peersNowPlaying.get(userId)
 *      Fed by `presence:nowplaying` (OS media session / SMTC on the desktop
 *      app, now broadcast to friends server-side). This is what makes a
 *      friend's listening visible even when they aren't a Spotify-connected
 *      poller target — the missing half of "can't see what others are playing".
 *
 * Drop-in callsites:
 *   Member row in CommunityPanel  → <NowPlayingPulse userId={member.user_id} />
 *   DM sidebar friend row         → <NowPlayingPulse userId={friend.id} compact />
 *   Voice tile pill below name    → <NowPlayingPulse userId={session.user_id} />
 *
 * @param {string}  userId    Whose now-playing to surface
 * @param {boolean} compact   Hide track name; show eq bars only
 * @param {boolean} dotOnly   Hide even the eq — render a tiny green dot.
 *                            Useful for very tight avatar adornments.
 */
export default function NowPlayingPulse({ userId, compact = false, dotOnly = false }) {
  const spotifyNp = useNowPlaying(userId);
  const { peersNowPlaying } = useNowPlayingPresence();
  const peerNp = peersNowPlaying?.get?.(userId) || null;

  // Normalize the two shapes into { name, artist }. Prefer the Spotify poller
  // when it reports a playing track (richer metadata), otherwise fall back to
  // the generic presence broadcast.
  let track = null;
  if (spotifyNp && spotifyNp.is_playing && spotifyNp.track_name) {
    track = { name: spotifyNp.track_name, artist: spotifyNp.artist || '' };
  } else if (peerNp && peerNp.isPlaying && peerNp.trackName) {
    track = {
      name: peerNp.trackName,
      artist: Array.isArray(peerNp.artists) ? peerNp.artists.join(', ') : (peerNp.artist || ''),
    };
  }
  if (!track) return null;

  // Dot-only variant: a 6px green pulse with a halo. Best for tucking
  // into the bottom-right of a member avatar circle.
  if (dotOnly) {
    return (
      <span
        aria-label={`Listening to ${track.name}`}
        className="relative inline-block w-2 h-2 rounded-full bg-[#1DB954]"
        style={{ boxShadow: '0 0 6px rgba(29, 185, 84, 0.65)' }}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: 'rgba(29, 185, 84, 0.45)', animationDuration: '1.6s' }}
        />
      </span>
    );
  }

  return (
    <span
      title={`${track.name}${track.artist ? ` — ${track.artist}` : ''}`}
      className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#1DB954] min-w-0"
    >
      <Equalizer />
      {!compact && (
        <span className="truncate max-w-[140px] normal-case tracking-normal text-[10px] font-medium text-[#1DB954]/85">
          {track.name}
        </span>
      )}
    </span>
  );
}

/**
 * Equalizer — 3 thin Spotify-green bars that loop a bounce animation.
 * Same component shape used in the SonicUplinkCard and DJMatrix so the
 * visual language stays consistent across the app.
 */
function Equalizer() {
  return (
    <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] rounded-sm bg-[#1DB954]"
          style={{
            animation: `spidr-eq-pulse 0.9s ease-in-out ${i * 0.13}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
      <style>{`
        @keyframes spidr-eq-pulse {
          0%, 100% { height: 30%; }
          50%      { height: 100%; }
        }
      `}</style>
    </span>
  );
}
