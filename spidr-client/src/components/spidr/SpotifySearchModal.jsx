import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Music, Play, Pause, Loader2, ExternalLink, Check } from 'lucide-react';
import { spotify, appleMusic } from '@/api/apiClient';

/**
 * SpotifySearchModal — Instagram-Story-style search for picking a profile
 * anthem from Spotify's catalog.
 *
 *   • Debounced search (320ms) hits /api/spotify/search via the spotify
 *     helper. Backend handles the Client Credentials token + secret.
 *   • Results render as a vertical list of {album art, track name, artist},
 *     each row has its own micro-player so the user can audition the 30s
 *     preview before committing. Only one preview plays at a time.
 *   • Selecting a row calls onSelect(track) with the normalized payload
 *     ready to stamp on UserProfile.anthem_* fields.
 *   • Tracks without `preview_url` are NOT excluded — they show an "Open
 *     in Spotify" affordance instead of the play button so the user knows
 *     the track exists but can't be auditioned in-app.
 */
export default function SpotifySearchModal({
  open, onClose, onSelect, currentSelectedId,
  // Optional copy overrides so the same modal can serve Profile Anthem,
  // DJ Booth, and any future "pick a Spotify track" flow.
  title = 'Set Profile Anthem',
  subtitle = 'Spotify',
  emptyHint = 'Pick any track on Spotify. A 30-second preview plays when visitors open your profile.',
  actionLabel = 'Set',
  // DJ booth mode: only PLAYABLE tracks (with a 30s preview) are shown, so
  // the host can never spin a silent track. Spotify ships no preview for a
  // huge slice of the catalog (major labels especially), so we also say how
  // many results were hidden instead of quietly shrinking the list.
  requirePreview = false,
  // DJ booth: offer both catalogs. Apple still ships previews for virtually
  // its whole catalog (unlike Spotify post-2024), and Apple tracks unlock
  // FULL-length playback for connected subscribers in the booth.
  allowAppleMusic = false,
  // Pin the modal to one catalog and hide the provider tabs entirely.
  // The DJ booth passes 'apple': the booth hosts from Apple Music only, so
  // offering a Spotify tab there would just be a way to pick a track the
  // session cannot legally or technically broadcast.
  forceProvider = null,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [pickedProvider, setPickedProvider] = useState('spotify'); // 'spotify' | 'apple'
  const provider = forceProvider || pickedProvider;
  const setProvider = setPickedProvider;
  const [appleAvailable, setAppleAvailable] = useState(true); // hides tab on 503
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null); // which preview is auditioning
  const audioRef = useRef(null);
  const debounceRef = useRef(null);

  // Reset on close so re-opening doesn't show stale results.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setQuery('');
        setResults([]);
        setPlayingId(null);
        if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced search — wait 320ms after the user stops typing before
  // firing. Cancels any pending search if a new keystroke lands first.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = provider === 'apple'
          ? await appleMusic.search(q, requirePreview ? 24 : 12).catch((err) => {
              if (err?.status === 503) setAppleAvailable(false);
              throw err;
            })
          : await spotify.search(q, requirePreview ? 24 : 12);
        let tracks = Array.isArray(res?.tracks) ? res.tracks : [];
        if (requirePreview) {
          const playable = tracks.filter(t => !!t.preview_url);
          setHiddenCount(tracks.length - playable.length);
          tracks = playable.slice(0, 12);
        } else {
          setHiddenCount(0);
        }
        setResults(tracks);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, provider]);

  // Stop the audition when the modal closes.
  useEffect(() => {
    if (!open && audioRef.current) {
      try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch {}
    }
  }, [open]);

  const handlePreview = useCallback((track) => {
    if (!track?.preview_url) return;
    const el = audioRef.current;
    if (!el) return;
    if (playingId === track.id) {
      el.pause();
      setPlayingId(null);
    } else {
      el.src = track.preview_url;
      el.play().then(() => setPlayingId(track.id)).catch(() => setPlayingId(null));
    }
  }, [playingId]);

  if (!open) return null;

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9992] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
            style={{
              maxHeight: 'min(640px, 80vh)',
              background: 'rgba(12, 12, 14, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              boxShadow: '0 0 40px rgba(239, 68, 68, 0.15), 0 24px 60px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Hidden audio element shared across all preview buttons.
                Single instance enforces "one preview at a time". */}
            <audio
              ref={audioRef}
              preload="none"
              onEnded={() => setPlayingId(null)}
              onPause={() => setPlayingId(null)}
            />

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)' }}
                >
                  <Music size={15} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 leading-none">{subtitle}</p>
                  <h2 className="text-white font-bold text-sm leading-tight">{title}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
                aria-label="Close"
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search input */}
            <div className="p-4 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search songs, artists…"
                  autoFocus
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-9 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-red-500/40 focus:shadow-[0_0_12px_rgba(239,68,68,0.18)]"
                />
                {loading && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
                )}
              </div>
            </div>

            {/* Results */}
            {allowAppleMusic && appleAvailable && !forceProvider && (
          <div className="flex items-center gap-1 px-4 pb-2">
            {[['spotify', 'SPOTIFY'], ['apple', 'APPLE MUSIC']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setProvider(id)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                  provider === id
                    ? id === 'apple'
                      ? 'text-white border-transparent'
                      : 'bg-[#1DB954] text-black border-[#1DB954]'
                    : 'bg-white/5 text-zinc-500 border-white/10 hover:text-white'
                }`}
                style={provider === id && id === 'apple' ? { background: 'linear-gradient(135deg, #fa243c, #a250fa)' } : undefined}
              >
                {label}
              </button>
            ))}
            {provider === 'apple' && (
              <span className="ml-2 text-[8px] font-mono uppercase tracking-widest text-zinc-600">
                Full tracks for connected subscribers
              </span>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0">
              {query.trim().length < 2 ? (
                <EmptyHint copy={emptyHint} />
              ) : loading && results.length === 0 ? (
                <LoadingHint />
              ) : results.length === 0 ? (
                <NoMatchHint q={query} filtered={requirePreview && hiddenCount > 0} />
              ) : (
                <div className="space-y-1">
                  {requirePreview && hiddenCount > 0 && (
                    <p className="px-2 pb-1 text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                      {hiddenCount} track{hiddenCount === 1 ? '' : 's'} hidden — no playable preview from Spotify
                    </p>
                  )}
                  {results.map((t) => (
                    <ResultRow
                      key={t.id}
                      track={t}
                      isPlaying={playingId === t.id}
                      isSelected={currentSelectedId === t.id}
                      actionLabel={actionLabel}
                      onPreviewToggle={() => handlePreview(t)}
                      onSelect={() => {
                        try { audioRef.current?.pause?.(); } catch {}
                        onSelect?.(t);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') return createPortal(modal, document.body);
  return modal;
}

// ── Subcomponents ──────────────────────────────────────────────────────

function ResultRow({ track, isPlaying, isSelected, onPreviewToggle, onSelect, actionLabel = 'Set' }) {
  const hasPreview = !!track.preview_url;
  const externalUrl = track.external_url || `https://open.spotify.com/track/${track.id}`;

  // The ENTIRE row selects the track. Selection must NOT depend on preview
  // availability — Spotify stopped returning `preview_url` for most tracks in
  // late 2024, so the old design (Select button only when hasPreview, else just
  // an external-link icon) left nearly every result unselectable. That was the
  // "search works but you can't choose a song" bug. Now every track is
  // selectable; the 30s preview and "open in Spotify" are secondary niceties.
  const handleRowKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleRowKey}
      aria-pressed={isSelected}
      title={`Select "${track.name}"`}
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
        isSelected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-white/5 border border-transparent'
      }`}
    >
      {/* Album art. When a 30s preview exists it's a button that auditions
          (stopPropagation so it doesn't select). With no preview it's a plain
          div, so clicking the cover bubbles up and selects the row instead of
          being a dead zone (a disabled <button> would swallow the click). */}
      {hasPreview ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreviewToggle(); }}
          className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 group/art"
          title={isPlaying ? 'Stop preview' : 'Preview 30s'}
        >
          {track.album_art_url ? (
            <img src={track.album_art_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <Music size={14} className="text-zinc-600" />
            </div>
          )}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity ${
              isPlaying ? 'opacity-100' : 'opacity-0 group-hover/art:opacity-100'
            }`}
            style={{ background: 'rgba(0, 0, 0, 0.55)' }}
          >
            {isPlaying
              ? <Pause size={14} className="text-white" />
              : <Play size={14} className="text-white ml-0.5" />}
          </div>
        </button>
      ) : (
        <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
          {track.album_art_url ? (
            <img src={track.album_art_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <Music size={14} className="text-zinc-600" />
            </div>
          )}
        </div>
      )}

      {/* Track meta */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${isPlaying ? 'text-emerald-300' : 'text-white'}`}>
          {track.name}
        </p>
        <p className="text-[11px] text-zinc-500 truncate">{track.artist}</p>
      </div>

      {/* Secondary: open on Spotify (kept as a small affordance, no longer the
          only action). stopPropagation so it doesn't also select the row. */}
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        title="Open on Spotify"
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <ExternalLink size={12} />
      </a>

      {/* Primary action — always present so every track is selectable. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
          isSelected
            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
            : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.30)]'
        }`}
      >
        {isSelected ? <Check size={11} /> : actionLabel}
      </button>
    </div>
  );
}

function EmptyHint({ copy }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.20)' }}>
        <Search size={16} className="text-emerald-500" />
      </div>
      <p className="text-zinc-400 text-xs font-bold">Search for a song</p>
      <p className="text-zinc-600 text-[10px] max-w-[260px] leading-relaxed">
        {copy}
      </p>
    </div>
  );
}

function LoadingHint() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 size={16} className="text-zinc-600 animate-spin" />
    </div>
  );
}

function NoMatchHint({ q, filtered = false }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-1 text-center">
      <p className="text-zinc-400 text-xs">No {filtered ? 'playable ' : ''}matches for "<span className="text-white">{q}</span>"</p>
      <p className="text-zinc-600 text-[10px]">
        {filtered
          ? 'Spotify has no audio preview for these results — try another song or artist.'
          : 'Try a different spelling or artist name.'}
      </p>
    </div>
  );
}
