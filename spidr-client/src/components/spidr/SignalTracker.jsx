import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, MessageSquare, Users, Hash, X, Loader2 } from 'lucide-react';
import { searchMessages } from '@/api/apiClient';

export default function SignalTracker({ placeholder = "Trace signals...", messages = [], users = [], channels = [], onResultClick, serverId, channelId }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  // Server-wide message results from the backend $text search (beyond the
  // ~50 messages currently loaded in the channel). Debounced.
  const [serverMsgs, setServerMsgs] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!serverId || q.length < 2 || (activeFilter !== 'all' && activeFilter !== 'messages')) {
      setServerMsgs([]); setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const rows = await searchMessages({ serverId, q, limit: 40 });
        setServerMsgs(Array.isArray(rows) ? rows : []);
      } catch {
        setServerMsgs([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, serverId, activeFilter]);

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const out = [];

    if (activeFilter === 'all' || activeFilter === 'messages') {
      // Merge locally-loaded messages with server-wide search results, keyed by
      // id so the same message isn't listed twice. Local first (already on
      // screen), then server results that weren't in the local set.
      const seen = new Set();
      const localMatches = messages.filter(m => m.content?.toLowerCase().includes(q));
      localMatches.slice(0, 8).forEach(m => {
        seen.add(m.id);
        out.push({ id: m.id, type: 'message', author: m.author_name || m.sender_name || m.user_name || 'Unknown', text: m.content, time: m.created_date, raw: m });
      });
      serverMsgs.forEach(m => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        out.push({ id: m.id, type: 'message', author: m.author_name || m.user_name || 'Unknown', text: m.content, time: m.created_date, raw: m });
      });
    }
    if (activeFilter === 'all' || activeFilter === 'users') {
      users.filter(u => (u.name || u.user_name || '').toLowerCase().includes(q)).slice(0, 5).forEach(u => {
        out.push({ id: u.id || u.user_id, type: 'user', name: u.name || u.user_name, avatar: u.avatar || u.user_avatar, raw: u });
      });
    }
    if (activeFilter === 'all' || activeFilter === 'channels') {
      channels.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 5).forEach(c => {
        out.push({ id: c.id, type: 'channel', name: c.name, channelType: c.type, raw: c });
      });
    }
    return out.slice(0, 25);
  }, [query, activeFilter, messages, users, channels, serverMsgs]);

  const timeAgo = (d) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="relative z-50">
      <div className={`relative flex items-center transition-all duration-300 ${isFocused ? 'w-72' : 'w-44'}`}>
        <div className={`absolute inset-0 rounded-xl transition-all ${isFocused ? 'bg-[#FF3333]/10 shadow-[0_0_15px_rgba(255,51,51,0.15)]' : 'bg-[#111]'}`} />
        <Search size={14} className={`absolute left-3 transition-colors z-10 ${isFocused ? 'text-[#FF3333]' : 'text-gray-500'}`} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          className="w-full bg-transparent border border-white/10 focus:border-[#FF3333]/50 rounded-xl py-1.5 pl-9 pr-8 text-xs text-white outline-none font-mono placeholder-gray-600 relative z-10 transition-colors"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-2 z-10 text-gray-500 hover:text-white"><X size={12} /></button>
        )}
      </div>

      <AnimatePresence>
        {isFocused && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
            className="absolute top-full right-0 mt-2 w-96 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
          >
            <div className="flex items-center gap-2 p-2 border-b border-white/5 bg-[#111]/50 overflow-x-auto">
              <span className="text-[9px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-1"><Filter size={10} /> Filters:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'messages', label: 'Messages', icon: MessageSquare },
                { id: 'users', label: 'Users', icon: Users },
                { id: 'channels', label: 'Channels', icon: Hash },
              ].map(f => (
                <button key={f.id} onClick={() => setActiveFilter(f.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap transition-colors ${activeFilter === f.id ? 'bg-[#FF3333]/20 text-[#FF3333] border border-[#FF3333]/30' : 'bg-black border border-white/10 text-gray-400 hover:text-white hover:border-white/30'}`}>
                  {f.icon && <f.icon size={10} />} {f.label}
                </button>
              ))}
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {searching && results.length === 0 && (
                <div className="p-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                  <Loader2 size={12} className="animate-spin" /> Searching the web…
                </div>
              )}
              {!searching && results.length === 0 && (
                <div className="p-4 text-center text-xs text-gray-500">No results found for "{query}"</div>
              )}
              {results.map((result) => (
                <div key={`${result.type}-${result.id}`}
                  onClick={() => onResultClick?.(result)}
                  className="p-3 bg-[#111] hover:bg-white/5 border border-white/5 rounded-xl cursor-pointer transition-colors group">
                  {result.type === 'message' && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={12} className="text-[#FF3333]" />
                        <span className="text-[10px] font-bold text-white">{result.author}</span>
                        <span className="text-[9px] text-gray-500 font-mono">{timeAgo(result.time)}</span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">"{result.text}"</p>
                    </>
                  )}
                  {result.type === 'user' && (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden">
                        {result.avatar ? <img src={result.avatar} className="w-full h-full object-cover" /> : <Users size={14} className="text-gray-500 m-auto mt-1.5" />}
                      </div>
                      <span className="text-xs font-bold text-white">{result.name}</span>
                    </div>
                  )}
                  {result.type === 'channel' && (
                    <div className="flex items-center gap-2">
                      <Hash size={14} className="text-gray-500 group-hover:text-white" />
                      <span className="text-xs font-bold text-white">{result.name}</span>
                      <span className="text-[9px] text-gray-500 uppercase">{result.channelType}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}