import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Music2, ExternalLink } from 'lucide-react';
import { entities, appleMusic } from '@/api/apiClient';
import { useNowPlaying as useNowPlayingPresence } from '@/context/NowPlayingContext';
import useMusicKit from '@/components/spidr/useMusicKit';
import { toast } from 'sonner';

// Apple Music note glyph in the brand red→purple wash.
const AppleMusicIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M9 3v10.55A4 4 0 1 0 11 17V7h8V3H9z" />
  </svg>
);

/**
 * AppleMusicNowPlaying — Module Nexus widget.
 *
 * Own profile:
 *   • not connected → Connect button (MusicKit's own Apple popup)
 *   • connected     → live track when playing through Spidr, otherwise the
 *                     last played track from Apple's recently-played API
 *                     (labeled honestly — Apple has NO live now-playing
 *                     endpoint, so "LAST PLAYED" is the truthful fallback)
 *
 * Visitor view:
 *   • the profile OWNER's presence when their source is Apple Music (live
 *     via the same presence stream every widget uses) — never the viewer's.
 */
export default function AppleMusicNowPlaying({ userId, isOwnProfile }) {
  const queryClient = useQueryClient();
  const musicKit = useMusicKit();
  const { peersNowPlaying, ownNowPlaying } = useNowPlayingPresence();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const res = await entities.UserProfile.filter({ user_id: userId });
      return res?.[0] ?? null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
  const connected = isOwnProfile ? musicKit.connected : !!profile?.neural_links?.apple_music_connected;

  // Recently played (own, connected) — the honest fallback signal.
  const { data: recent } = useQuery({
    queryKey: ['apple-recent', userId],
    queryFn: async () => {
      try { return (await appleMusic.recentlyPlayed())?.track || null; }
      catch {
        await musicKit.refresh().catch(() => {});
        queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
        return null;
      }
    },
    enabled: !!isOwnProfile && connected,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  // Resolve what to show. Live presence (provider apple_music) wins.
  const presence = isOwnProfile
    ? ownNowPlaying
    : peersNowPlaying?.get?.(userId) || null;
  const liveApple = presence?.isPlaying && (presence.provider === 'apple_music' || presence.source === 'apple')
    ? presence
    : null;

  const handleConnect = async () => {
    try {
      const result = await musicKit.authorize();
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      if (result?.pending) toast('Waiting for Apple Music authorization');
      else toast.success('Apple Music connected');
    } catch (err) {
      toast.error(err?.message || 'Could not connect Apple Music');
    }
  };
  const handleDisconnect = async () => {
    try {
      await musicKit.unauthorize();
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      toast.success('Apple Music disconnected');
    } catch { toast.error('Failed to disconnect'); }
  };

  // Server not configured for Apple Music → say so plainly on own profile,
  // render nothing on visitors' views.
  if (musicKit.configured === false) {
    if (!isOwnProfile) return null;
    return (
      <WidgetShell>
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 text-center py-4">
          Apple Music isn't configured on this server yet
        </p>
      </WidgetShell>
    );
  }

  // Own profile, not connected → connect CTA.
  if (isOwnProfile && !connected) {
    return (
      <WidgetShell>
        <div className="flex flex-col items-center gap-3 py-3">
          <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
            Connect Apple Music to show your spins here and unlock full-track DJ sessions.
          </p>
          <button
            onClick={handleConnect}
            disabled={!musicKit.ready || musicKit.busy}
            className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40 transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #fa243c, #a250fa)' }}
          >
            {musicKit.pending ? 'Awaiting authorization' : musicKit.busy ? 'Connecting...' : musicKit.ready ? 'Connect Apple Music' : 'Loading...'}
          </button>
        </div>
      </WidgetShell>
    );
  }

  const track = liveApple
    ? {
        name: liveApple.trackName,
        artist: Array.isArray(liveApple.artists) ? liveApple.artists.join(', ') : (liveApple.artist || ''),
        art: liveApple.albumArt || null,
        live: true,
      }
    : (isOwnProfile && recent)
      ? { name: recent.name, artist: recent.artist, art: recent.album_art_url, url: recent.external_url, live: false }
      : null;

  if (!track) {
    if (!isOwnProfile) return null; // visitors see nothing when the owner is idle
    return (
      <WidgetShell onDisconnect={handleDisconnect}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 text-center py-3">
          Nothing spinning right now
        </p>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell onDisconnect={isOwnProfile ? handleDisconnect : null}>
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
          {track.art
            ? <img src={track.art} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Music2 size={16} className="text-zinc-600" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{track.name}</p>
          <p className="text-[11px] text-zinc-500 truncate">{track.artist}</p>
          <p className="text-[8px] font-mono uppercase tracking-[0.2em] mt-0.5"
            style={{ color: track.live ? '#fa5c6e' : '#71717a' }}>
            {track.live ? '● Live · Apple Music' : 'Last played · Apple Music'}
          </p>
        </div>
        {track.url && (
          <a href={track.url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-zinc-600 hover:text-white transition-colors" title="Open in Apple Music">
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </WidgetShell>
  );
}

function WidgetShell({ children, onDisconnect = null }) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-[#0d0d0d] p-3 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ background: 'linear-gradient(135deg, #fa243c, #a250fa)' }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em]"
            style={{ color: '#fa5c6e' }}>
            <AppleMusicIcon className="w-3 h-3" /> Apple Music
          </span>
          {onDisconnect && (
            <button onClick={onDisconnect}
              className="text-[8px] font-mono uppercase tracking-widest text-zinc-600 hover:text-red-400 transition-colors">
              Disconnect
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
