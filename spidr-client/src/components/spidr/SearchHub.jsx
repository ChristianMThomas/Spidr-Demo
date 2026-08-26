import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Image as ImageIcon, Link2, X, Loader2, User as UserIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchHub } from '@/api/apiClient';

/**
 * SearchHub — keyword search + image gallery + link list for a chat surface.
 *
 * One component serves DMs, group chats, and server channels; the parent just
 * supplies `scope` ('dm' | 'group' | 'server') and the id. Results open in a
 * panel anchored under the header rather than replacing the message list, so
 * the conversation stays visible behind them — closing search shouldn't feel
 * like navigating back from somewhere.
 *
 * Supports `from:name` prefixes in the query (Discord-style). The token is
 * parsed out client-side and resolved against `members` into a user id, so
 * the server does an indexed author lookup rather than a text scan.
 */

const VIEWS = {
  search: { label: 'Messages', Icon: Search,    accent: '#ef4444' },
  images: { label: 'Images',   Icon: ImageIcon, accent: '#ef4444' },
  links:  { label: 'Links',    Icon: Link2,     accent: '#60a5fa' },
};

export default function SearchHub({ scope, id, channelId, members = [], onJump, compact = false, mediaOnly = false }) {
  const [open, setOpen] = useState(mediaOnly);
  const [view, setView] = useState('search');
  const [raw, setRaw] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(raw), 300);
    return () => clearTimeout(t);
  }, [raw]);

  // Parse `from:someone` out of the query and resolve it to a user id.
  const { term, fromId, fromLabel } = useMemo(() => {
    const m = /(?:^|\s)from:(\S+)/i.exec(debounced || '');
    if (!m) return { term: (debounced || '').trim(), fromId: null, fromLabel: null };
    const needle = m[1].toLowerCase();
    const hit = members.find((u) => {
      const name = (u?.name || u?.user_name || u?.display_name || u?.username || '').toLowerCase();
      return name === needle || name.startsWith(needle);
    });
    return {
      term: (debounced.replace(m[0], ' ') || '').trim(),
      fromId: hit?.id || hit?.user_id || null,
      fromLabel: hit ? (hit.name || hit.user_name || hit.display_name || hit.username) : m[1],
    };
  }, [debounced, members]);

  const enabled = open && !!id && (view !== 'search' || !!term || !!fromId);

  const { data: results = [], isFetching, error } = useQuery({
    queryKey: ['search-hub', scope, id, channelId, view, term, fromId],
    queryFn: () => searchHub({ scope, id, channel_id: channelId, view, q: term, from: fromId }),
    enabled,
    staleTime: 15_000,
  });

  const close = () => { setOpen(false); setRaw(''); setDebounced(''); setView('search'); };

  if (!open && !mediaOnly) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
        title="Search & media"
      >
        <Search size={17} />
      </button>
    );
  }

  return (
    <>
      {/* Control strip */}
      <div className="flex items-center gap-2 bg-[#050505]/80 backdrop-blur-md p-1.5 rounded-xl border border-white/5">
        {!mediaOnly && (
        <div className="relative group flex items-center">
          <Search
            size={14}
            className="absolute left-3 text-white/30 group-focus-within:text-red-500 transition-colors pointer-events-none"
          />
          <input
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
            placeholder="Search messages, from:user…"
            className={`${compact ? 'w-36 focus:w-48' : 'w-48 focus:w-64'} transition-all duration-300 bg-white/[0.02] hover:bg-white/[0.04] focus:bg-[#0a0a0a] border border-transparent focus:border-red-500/50 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium text-white placeholder-white/30 outline-none focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]`}
          />
        </div>
        )}

        {!mediaOnly && <div className="w-px h-5 bg-white/10" />}

        {Object.entries(VIEWS).filter(([k]) => k !== 'search').map(([key, cfg]) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => setView(active ? 'search' : key)}
              title={`View ${cfg.label}`}
              className="p-1.5 rounded-lg border transition-all flex items-center justify-center"
              style={active
                ? { background: `${cfg.accent}22`, color: cfg.accent, borderColor: `${cfg.accent}55` }
                : { color: 'rgba(255,255,255,0.4)', borderColor: 'transparent' }}
            >
              <cfg.Icon size={15} />
            </button>
          );
        })}

        {!mediaOnly && (
          <button onClick={close} className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors" title="Close">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Results panel */}
      <AnimatePresence>
        {open && (!mediaOnly || view !== 'search') && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-2 top-full mt-2 w-[380px] max-w-[calc(100vw-24px)] max-h-[60vh] rounded-2xl overflow-hidden z-50 flex flex-col"
            style={{
              background: 'rgba(8,8,8,0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                {VIEWS[view].label}
                {fromLabel && <span className="text-red-400"> · from {fromLabel}</span>}
              </span>
              {isFetching && <Loader2 size={12} className="animate-spin text-white/40" />}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto spidr-scroll p-2">
              {error && (
                <p className="text-[11px] text-red-400 p-3">{error.message || 'Search failed'}</p>
              )}

              {!error && !enabled && (
                <p className="text-[11px] text-zinc-500 p-3 text-center">
                  Type to search, or pick Images / Links above.
                </p>
              )}

              {!error && enabled && !isFetching && results.length === 0 && (
                <p className="text-[11px] text-zinc-500 p-3 text-center">No results</p>
              )}

              {/* IMAGES — grid of thumbnails */}
              {view === 'images' && results.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {results.flatMap((m) =>
                    (m.media_urls || []).map((url, i) => (
                      <button
                        key={`${m.id}-${i}`}
                        onClick={() => onJump?.(m)}
                        className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-red-500/60 transition-colors"
                        title={m.content || 'Jump to message'}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* LINKS — stacked rows */}
              {view === 'links' && results.length > 0 && (
                <div className="space-y-1">
                  {results.flatMap((m) =>
                    (m.link_urls || []).map((url, i) => (
                      <a
                        key={`${m.id}-${i}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg hover:bg-white/[0.04] border border-transparent hover:border-white/5 transition-all"
                      >
                        <p className="text-[12px] text-blue-400 truncate">{url}</p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {m.sender_name || m.user_name || 'Someone'}
                          {m.created_date ? ` · ${new Date(m.created_date).toLocaleDateString()}` : ''}
                        </p>
                      </a>
                    ))
                  )}
                </div>
              )}

              {/* MESSAGES — text hits */}
              {view === 'search' && results.length > 0 && (
                <div className="space-y-1">
                  {results.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onJump?.(m)}
                      className="w-full text-left p-2 rounded-lg hover:bg-white/[0.04] border border-transparent hover:border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <UserIcon size={9} className="text-zinc-600 shrink-0" />
                        <span className="text-[10px] font-bold text-white/70 truncate">
                          {m.sender_name || m.user_name || 'Someone'}
                        </span>
                        {m.created_date && (
                          <span className="text-[9px] text-zinc-600 shrink-0 ml-auto">
                            {new Date(m.created_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-zinc-300 line-clamp-2">{m.content}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
