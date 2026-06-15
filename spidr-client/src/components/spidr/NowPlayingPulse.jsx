import React from 'react';
import useNowPlaying from '@/hooks/useNowPlaying';

/**
 * NowPlayingPulse — the tiny "Listening to Spotify" indicator that
 * surfaces in member rosters / sidebars / mini avatar tooltips. Pure
 * visual: a 3-bar pulsing equalizer in Spotify green + optional track
 * name. Renders NOTHING when the user isn't currently playing, so
 * it's safe to drop in anywhere member rows render — empty state is
 * literally zero space.
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
  const np = useNowPlaying(userId);
  if (!np || !np.is_playing) return null;

  // Dot-only variant: a 6px green pulse with a halo. Best for tucking
  // into the bottom-right of a member avatar circle.
  if (dotOnly) {
    return (
      <span
        aria-label={`Listening to ${np.track_name}`}
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
      title={`${np.track_name} — ${np.artist}`}
      className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#1DB954]"
    >
      <Equalizer />
      {!compact && (
        <span className="truncate max-w-[140px] normal-case tracking-normal text-[10px] font-medium text-[#1DB954]/85">
          {np.track_name}
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
