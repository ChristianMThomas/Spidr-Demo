import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gamepad2, Twitch, Check, X, ExternalLink, Unlink } from 'lucide-react';
import { entities } from '@/api/apiClient';
import { toast } from 'sonner';
import useMusicKit from './useMusicKit';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function authFetch(path, options = {}) {
  const token = localStorage.getItem('spidr_token');
  return fetch(BASE_URL + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}

/**
 * NeuralConfig — the Connections panel (Spotify, Apple Music, Twitch, etc).
 *
 * Portable by design: rendered permanently inside the Settings > Connections
 * tab, AND inside a floating modal launched from the profile card. Passing
 * `onClose` is what distinguishes the two — with it the panel draws its own
 * dismiss button and sizes itself for a modal; without it, it fills the
 * settings pane as before. One component, two entry points, so adding a new
 * integration appears in both places automatically.
 */
export default function NeuralConfig({ currentUser, onClose }) {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', currentUser?.id],
    queryFn:  async () => {
      const res = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return res?.[0] ?? null;
    },
    enabled: !!currentUser?.id,
  });

  const profileId   = profile?.id;
  const neuralLinks = profile?.neural_links || {};

  // Simple boolean toggle for Steam / Twitch
  const toggleLink = async (key) => {
    const newVal  = !neuralLinks[key];
    const updated = { ...neuralLinks, [key]: newVal };
    try {
      if (profileId) {
        await entities.UserProfile.update(profileId, { neural_links: updated });
      } else {
        await entities.UserProfile.create({ user_id: currentUser?.id, neural_links: updated });
      }
      queryClient.invalidateQueries({ queryKey: ['user-profile', currentUser?.id] });
      toast.success(newVal ? 'Neural link established' : 'Link severed');
    } catch {
      toast.error('Failed to update neural link');
    }
  };

  // Apple Music (MusicKit) — configured=false hides the card entirely so
  // servers without Apple credentials never show a dead button.
  const musicKit = useMusicKit();
  const appleConnected = musicKit.authorized || !!neuralLinks.apple_music_connected;
  const handleAppleConnect = async () => {
    try {
      await musicKit.authorize();
      queryClient.invalidateQueries({ queryKey: ['neural-config'] });
      toast.success('Apple Music connected');
    } catch (err) {
      toast.error(err?.message === 'Not authorized' ? 'Authorization was cancelled' : (err?.message || 'Could not connect Apple Music'));
    }
  };
  const handleAppleDisconnect = async () => {
    try {
      await musicKit.unauthorize();
      queryClient.invalidateQueries({ queryKey: ['neural-config'] });
      toast.success('Apple Music disconnected');
    } catch {
      toast.error('Failed to disconnect Apple Music');
    }
  };

  // The browser hop carries no Authorization header, so identity used to ride
  // along as a bare ?userId= — which meant a link minted for someone else's id
  // would attach THEIR Spotify tokens to whoever's account was in the URL.
  // We now exchange the session for a short-lived signed link token first.
  const handleSpotifyConnect = async () => {
    try {
      const res = await authFetch('/spotify/auth/link-token');
      const { token } = await res.json();
      if (!token) throw new Error('no link token');
      window.open(`${BASE_URL}/spotify/auth/start?token=${encodeURIComponent(token)}`, '_blank');
      // TanStack Query refetches on window focus, which picks up spotify_connected=true automatically
    } catch {
      toast.error('Could not start Spotify connect');
    }
  };

  const handleSpotifyDisconnect = async () => {
    try {
      await authFetch('/spotify/auth/disconnect', { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['user-profile', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['spotify-now-playing', currentUser?.id] });
      toast.success('Spotify disconnected');
    } catch {
      toast.error('Failed to disconnect Spotify');
    }
  };

  const inModal = typeof onClose === 'function';

  return (
    <div
      className={inModal
        ? 'relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 spidr-scroll'
        : 'flex-1 bg-[#050505] p-8 overflow-y-auto'}
      style={inModal ? {
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
      } : undefined}
      onClick={inModal ? (e) => e.stopPropagation() : undefined}
    >
      {inModal && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors z-10"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <h1 className={`text-2xl font-black text-white mb-2 uppercase tracking-widest flex items-center gap-3 ${inModal ? 'pr-8' : ''}`}>
        <span className="text-[#FF3333]">///</span> Neural Links
      </h1>
      <p className="text-gray-500 mb-8 text-sm">Jack external data streams into your Spidr profile.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">

        {/* ── Spotify — real OAuth ──────────────────────────────────────────── */}
        <SpotifyCard
          connected={!!neuralLinks.spotify_connected}
          onConnect={handleSpotifyConnect}
          onDisconnect={handleSpotifyDisconnect}
        />

        {/* ── Apple Music — MusicKit (hidden when server lacks credentials) ─── */}
        {musicKit.configured !== false && (
          <AppleMusicCard
            connected={appleConnected}
            ready={musicKit.ready}
            onConnect={handleAppleConnect}
            onDisconnect={handleAppleDisconnect}
          />
        )}

        {/* ── Steam — simple toggle ─────────────────────────────────────────── */}
        <ToggleCard
          label="Steam Game Protocol"
          icon={Gamepad2}
          description="Link Steam to display your library activity and recently played games on your profile."
          connected={!!neuralLinks.steam}
          onToggle={() => toggleLink('steam')}
          color="#66c0f4"
        />

        {/* ── Twitch — simple toggle ────────────────────────────────────────── */}
        <ToggleCard
          label="Twitch Live Feed"
          icon={Twitch}
          description="Connect Twitch to show when you're live and let friends tune in directly from your profile."
          connected={!!neuralLinks.twitch}
          onToggle={() => toggleLink('twitch')}
          color="#9146FF"
        />

      </div>
    </div>
  );
}

// ── Spotify OAuth card ───────────────────────────────────────────────────────

function SpotifyLogo({ size = 20, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function AppleMusicCard({ connected, ready, onConnect, onDisconnect }) {
  return (
    <div className="relative group overflow-hidden bg-[#111] border border-white/5 rounded-xl p-6 transition-all hover:border-white/10 col-span-1 md:col-span-2">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500"
        style={{ background: 'linear-gradient(135deg, #fa243c, #a250fa)' }}
      />
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex items-center gap-4 flex-shrink-0">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              background: connected ? 'linear-gradient(135deg, #fa243c, #a250fa)' : '#1a1a1a',
              boxShadow: connected ? '0 0 28px rgba(250,36,60,0.35)' : 'none',
            }}
          >
            {/* Apple Music glyph — simple note mark */}
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"
              className={connected ? 'text-white' : 'text-gray-600'}>
              <path d="M9 3v10.55A4 4 0 1 0 11 17V7h8V3H9z" />
            </svg>
          </div>
          <div>
            <h3 className="font-black text-white text-sm tracking-wide">Apple Music</h3>
            <span className={`text-[10px] font-mono uppercase tracking-widest ${connected ? 'text-[#fa5c6e]' : 'text-gray-600'}`}>
              {connected ? '● Connected' : '○ Not connected'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed flex-1">
          {connected
            ? 'Apple Music is linked. DJ sessions can spin from the Apple catalog — and as a subscriber you hear FULL tracks in the booth, not 30-second previews. Playback through Spidr shows on your profile in real time.'
            : 'Connect Apple Music to DJ from the Apple catalog and unlock full-track listening in DJ sessions (subscription required for full tracks). Something Discord simply does not have.'}
        </p>
        <div className="flex-shrink-0">
          {connected ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap"
            >
              <Unlink size={11} /> Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={!ready}
              className="flex items-center gap-2 px-5 py-2.5 text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #fa243c, #a250fa)' }}
            >
              {ready ? 'Connect Apple Music' : 'Loading…'} <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpotifyCard({ connected, onConnect, onDisconnect }) {
  return (
    <div className="relative group overflow-hidden bg-[#111] border border-white/5 rounded-xl p-6 transition-all hover:border-white/10 col-span-1 md:col-span-2">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 bg-[#1DB954]" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Icon + name */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              backgroundColor: connected ? '#1DB954' : '#1a1a1a',
              boxShadow: connected ? '0 0 28px rgba(29,185,84,0.35)' : 'none',
            }}
          >
            <SpotifyLogo size={28} className={connected ? 'text-white' : 'text-gray-600'} />
          </div>
          <div>
            <h3 className="font-black text-white text-sm tracking-wide">Spotify</h3>
            <span className={`text-[10px] font-mono uppercase tracking-widest ${connected ? 'text-[#1DB954]' : 'text-gray-600'}`}>
              {connected ? '● Connected' : '○ Not connected'}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[11px] text-gray-500 leading-relaxed flex-1">
          {connected
            ? 'Your Spotify account is linked. The Now Playing module on your profile will show your current track in real time.'
            : 'Connect your Spotify account to display your currently playing track on your profile. Each person connects their own account — your data stays yours.'}
        </p>

        {/* Action */}
        <div className="flex-shrink-0">
          {connected ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap"
            >
              <Unlink size={11} /> Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1DB954] hover:bg-[#1ed760] text-black text-[11px] font-black uppercase tracking-widest rounded-lg transition-colors whitespace-nowrap"
            >
              Connect Spotify <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>

      {connected && (
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] w-full"
          style={{ backgroundColor: '#1DB954', boxShadow: '0 0 12px #1DB954' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </div>
  );
}

// ── Simple boolean toggle card (Steam, Twitch) ───────────────────────────────

function ToggleCard({ label, icon: Icon, description, connected, onToggle, color }) {
  return (
    <div className="relative group overflow-hidden bg-[#111] border border-white/5 rounded-xl p-6 transition-all hover:border-white/10">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500"
        style={{ backgroundColor: color }}
      />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
              style={{
                backgroundColor: connected ? `${color}22` : '#1a1a1a',
                color:           connected ? color : '#555',
                boxShadow:       connected ? `0 0 20px ${color}33` : 'none',
              }}
            >
              <Icon size={22} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{label}</h3>
              <span className={`text-[10px] font-mono uppercase tracking-widest ${connected ? 'text-green-500' : 'text-gray-600'}`}>
                {connected ? 'LINK ESTABLISHED' : 'NO SIGNAL'}
              </span>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            onClick={onToggle}
            className="relative w-14 h-8 rounded-full bg-[#0a0a0a] border border-white/10 flex-shrink-0"
          >
            <motion.div
              className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
              animate={{ x: connected ? 24 : 0 }}
              style={{ backgroundColor: connected ? color : '#333' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              {connected
                ? <Check size={12} strokeWidth={4} className="text-white" />
                : <X size={12} strokeWidth={4} className="text-gray-500" />}
            </motion.div>
          </button>
        </div>

        <p className="text-[11px] text-gray-600 leading-relaxed">{description}</p>
      </div>

      {connected && (
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] w-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </div>
  );
}
