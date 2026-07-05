import React from 'react';
import useNowPlaying from '@/hooks/useNowPlaying';
import { useNowPlaying as useNowPlayingPresence } from '@/context/NowPlayingContext';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';

/**
 * Nameplate badges — the "Spidr way" of rich presence. Two razor-thin
 * components that attach to a nameplate WITHOUT the bulky Discord-style
 * activity rectangles:
 *
 *   <SonicUplink userId />    A glowing 4-bar equalizer pill that sits
 *                             opposite the username. Visual heartbeat when
 *                             the user is broadcasting music. GPU-only
 *                             animation (scaleY) so 20 of these in a member
 *                             list won't dent the Electron frame rate.
 *
 *   <ActivityBlade userId />  A frosted-glass tag that slides under the
 *                             username with game/activity context. One line,
 *                             truncates, never stretches the row.
 *
 * Both render NOTHING when there's no data — zero layout cost when idle.
 */

// One shared <style> injection for the waveform keyframes.
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = `
@keyframes spidr-waveform {
  0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
  50%      { transform: scaleY(1);   opacity: 1; }
}
@keyframes spidr-subtle-pulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}
.spidr-wave-bar {
  width: 3px;
  background-color: #1DB954;
  border-radius: 4px;
  transform-origin: bottom;
  box-shadow: 0 0 8px rgba(29, 185, 84, 0.6);
}
.spidr-wave-1 { animation: spidr-waveform 1.1s ease-in-out infinite; }
.spidr-wave-2 { animation: spidr-waveform 0.9s ease-in-out infinite 0.2s; }
.spidr-wave-3 { animation: spidr-waveform 1.2s ease-in-out infinite 0.4s; }
.spidr-wave-4 { animation: spidr-waveform 0.8s ease-in-out infinite 0.1s; }
.spidr-blade-dot { animation: spidr-subtle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
`;
  document.head.appendChild(el);
}

// Resolve a user's current track from either presence source (Spotify poller
// or the generic OS-media presence stream). Same merge logic as
// NowPlayingPulse — richer Spotify data wins.
function useMergedTrack(userId) {
  const spotifyNp = useNowPlaying(userId);
  const { peersNowPlaying } = useNowPlayingPresence();
  const peerNp = peersNowPlaying?.get?.(userId) || null;
  if (spotifyNp && spotifyNp.is_playing && spotifyNp.track_name) {
    return { name: spotifyNp.track_name, artist: spotifyNp.artist || '' };
  }
  if (peerNp && peerNp.isPlaying && peerNp.trackName) {
    return {
      name: peerNp.trackName,
      artist: Array.isArray(peerNp.artists) ? peerNp.artists.join(', ') : (peerNp.artist || ''),
    };
  }
  return null;
}

/** The Sonic Uplink — glowing 4-bar equalizer pill. Right-align it in the
 *  nameplate row (`ml-auto` works well). */
export function SonicUplink({ userId, className = '' }) {
  ensureStyles();
  const track = useMergedTrack(userId);
  if (!track) return null;

  return (
    <span
      title={`${track.name}${track.artist ? ` — ${track.artist}` : ''}`}
      className={`inline-flex items-center gap-2 bg-[#1DB954]/5 border border-[#1DB954]/20 rounded-full px-2.5 py-1 backdrop-blur-sm hover:bg-[#1DB954]/10 transition-colors min-w-0 ${className}`}
    >
      <span className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden>
        <span className="spidr-wave-bar spidr-wave-1 h-full" />
        <span className="spidr-wave-bar spidr-wave-2 h-full" />
        <span className="spidr-wave-bar spidr-wave-3 h-full" />
        <span className="spidr-wave-bar spidr-wave-4 h-full" />
      </span>
      <span className="text-[9px] font-bold text-[#1DB954] uppercase tracking-widest max-w-[80px] truncate">
        {track.name}
      </span>
    </span>
  );
}

// Activity data comes from the profile's Gaming Uplink (Electron process
// scanner) or the manual "Vibe Check" activity field. Cheap shared query.
function useActivity(userId) {
  const { data: profile } = useQuery({
    queryKey: ['nameplate-activity', userId],
    queryFn: () => entities.UserProfile.filter({ user_id: userId }).then(p => p[0] || null),
    enabled: !!userId,
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
  if (!profile) return null;
  const gaming = profile.gaming_status || profile.gaming_uplink;
  if (gaming?.active && gaming?.game) {
    return { label: gaming.game, detail: gaming.character ? `Playing ${gaming.character}` : null, tone: 'game' };
  }
  const act = profile.activity;
  if (act && typeof act === 'object' && (act.name || act.text)) {
    return { label: act.name || act.text, detail: act.detail || null, tone: 'custom' };
  }
  if (typeof act === 'string' && act.trim()) {
    return { label: act.trim(), detail: null, tone: 'custom' };
  }
  return null;
}

/** The Activity Blade — razor-thin frosted-glass tag beneath the username. */
export function ActivityBlade({ userId, className = '' }) {
  ensureStyles();
  const activity = useActivity(userId);
  if (!activity) return null;

  const dotColor = activity.tone === 'game'
    ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.6)]'
    : 'bg-red-400 shadow-[0_0_5px_rgba(248,113,113,0.6)]';

  return (
    <span className={`inline-flex items-center max-w-full ${className}`}>
      <span className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-md px-2 py-0.5 backdrop-blur-md min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 spidr-blade-dot ${dotColor}`} aria-hidden />
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/60 min-w-0">
          <span className="text-white/90 truncate">{activity.label}</span>
          {activity.detail && (
            <>
              <span className="text-white/30 shrink-0">•</span>
              <span className="truncate">{activity.detail}</span>
            </>
          )}
        </span>
      </span>
    </span>
  );
}

export default { SonicUplink, ActivityBlade };
