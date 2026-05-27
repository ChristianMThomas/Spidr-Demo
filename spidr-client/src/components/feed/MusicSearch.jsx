import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Music, Loader2, TrendingUp, X, Youtube, ExternalLink } from 'lucide-react';
import { entities, auth, integrations } from '@/api/apiClient';
import { toast } from 'sonner';

export default function MusicSearch({ onSelectTrack, currentUser }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trending, setTrending] = useState(null);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [previewSong, setPreviewSong] = useState(null);
  const searchTimeout = useRef(null);

  const searchMusic = async (searchQuery) => {
    if (!searchQuery.trim()) { setResults([]); return; }
    setSearching(true);
    const res = await integrations.Core.InvokeLLM({
      prompt: `You are a music database. The user is searching for: "${searchQuery}"
      
Return the top 8 most relevant and popular songs that match this search. Include songs from Spotify, YouTube, TikTok trending sounds, etc. 
For each song provide the title, artist, and approximate duration. Include a mix of popular hits and trending sounds.
If the search mentions a specific artist, prioritize their songs. If it mentions a genre or mood, return songs matching that vibe.`,
      response_json_schema: {
        type: "object",
        properties: {
          songs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                artist: { type: "string" },
                duration: { type: "string", description: "e.g. 3:24" },
                genre: { type: "string" },
                trending: { type: "boolean", description: "Is this currently trending on TikTok/Reels" },
                platform: { type: "string", description: "Where it's popular: spotify, tiktok, youtube, etc" }
              }
            }
          }
        }
      },
      add_context_from_internet: true
    });
    setResults(res.songs || []);
    setSearching(false);
  };

  const loadTrending = async () => {
    if (trending) return;
    setLoadingTrending(true);
    const res = await integrations.Core.InvokeLLM({
      prompt: `What are the current top 10 most trending songs on TikTok and Instagram Reels right now in 2025/2026? Include the most viral sounds people are using for their videos. For each song, provide the title, artist, duration, and which platform it's trending on.`,
      response_json_schema: {
        type: "object",
        properties: {
          songs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                artist: { type: "string" },
                duration: { type: "string" },
                genre: { type: "string" },
                trending: { type: "boolean" },
                platform: { type: "string" }
              }
            }
          }
        }
      },
      add_context_from_internet: true
    });
    setTrending(res.songs || []);
    setLoadingTrending(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (val.trim().length >= 2) {
      searchTimeout.current = setTimeout(() => searchMusic(val), 600);
    } else {
      setResults([]);
    }
  };

  const handleSelectSong = async (song) => {
    // Create an AudioTrack entity for this song so it can be referenced
    const track = await entities.AudioTrack.create({
      title: song.title,
      artist: song.artist,
      uploader_id: currentUser?.id,
      is_original: false,
      use_count: 0,
      save_count: 0,
      tags: [song.genre, song.platform].filter(Boolean),
    });
    onSelectTrack(track);
    toast.success(`Selected: ${song.title} — ${song.artist}`);
  };

  const displaySongs = query.trim() ? results : (trending || []);
  const showTrendingPrompt = !query.trim() && !trending && !loadingTrending;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative group">
        <Search size={16} className="absolute left-4 top-3 text-gray-500 group-focus-within:text-[#FF3333] transition-colors" />
        <input
          type="text"
          placeholder="Search songs, artists, sounds..."
          value={query}
          onChange={handleInputChange}
          className="w-full bg-[#050505] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-[#FF3333] outline-none font-mono transition-colors"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setPreviewSong(null); }} className="absolute right-3 top-3 text-gray-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* YouTube Preview Embed */}
      <AnimatePresence>
        {previewSong && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-[#FF3333]/30 bg-[#0a0a0a]"
          >
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#FF3333] animate-pulse" />
                <span className="text-[11px] font-bold text-white truncate max-w-[200px]">{previewSong.title} — {previewSong.artist}</span>
              </div>
              <button onClick={() => setPreviewSong(null)} className="text-gray-500 hover:text-white ml-2">
                <X size={12} />
              </button>
            </div>
            <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/?listType=search&list=${encodeURIComponent(previewSong.title + ' ' + previewSong.artist + ' official')}&autoplay=1`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Preview"
              />
            </div>
            <div className="p-3 flex gap-2">
              <button
                onClick={() => { handleSelectSong(previewSong); setPreviewSong(null); }}
                className="flex-1 py-2 bg-[#FF3333] hover:bg-red-600 text-white text-[10px] font-black uppercase rounded-lg transition-colors"
              >
                Use This Sound
              </button>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(previewSong.title + ' ' + previewSong.artist)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-2 bg-[#111] border border-white/10 hover:border-white/30 text-gray-400 hover:text-white text-[10px] font-bold rounded-lg transition-colors"
              >
                <ExternalLink size={10} /> YouTube
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {(searching || loadingTrending) && (
        <div className="flex items-center justify-center py-8 text-zinc-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          {searching ? 'Searching music...' : 'Loading trending sounds...'}
        </div>
      )}

      {/* Trending prompt */}
      {showTrendingPrompt && !previewSong && (
        <button
          onClick={loadTrending}
          className="w-full py-6 border border-dashed border-white/10 hover:border-[#FF3333]/50 rounded-xl text-center transition-colors group"
        >
          <TrendingUp size={24} className="mx-auto mb-2 text-zinc-600 group-hover:text-[#FF3333] transition-colors" />
          <div className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors">Load Trending Sounds</div>
          <div className="text-[10px] text-zinc-600 mt-1">See what's viral on TikTok & Reels right now</div>
        </button>
      )}

      {/* Results */}
      {!searching && !loadingTrending && displaySongs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-2">
            {query.trim() ? `Results (${displaySongs.length})` : '🔥 Trending Now'}
          </div>
          {displaySongs.map((song, idx) => (
            <SongItem
              key={idx}
              song={song}
              isPreviewing={previewSong?.title === song.title && previewSong?.artist === song.artist}
              onPreview={() => setPreviewSong(song)}
              onSelect={() => handleSelectSong(song)}
            />
          ))}
        </div>
      )}

      {/* No results */}
      {!searching && query.trim() && results.length === 0 && (
        <div className="text-center py-8 text-zinc-500 text-sm">
          No songs found. Try a different search.
        </div>
      )}
    </div>
  );
}

function SongItem({ song, onSelect, onPreview, isPreviewing }) {
  const platformColors = {
    tiktok: 'bg-pink-500/20 text-pink-400',
    spotify: 'bg-green-500/20 text-green-400',
    youtube: 'bg-red-500/20 text-red-400',
    instagram: 'bg-purple-500/20 text-purple-400',
  };

  const platformClass = platformColors[song.platform?.toLowerCase()] || 'bg-zinc-500/20 text-zinc-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-between p-3 border rounded-xl group transition-colors ${isPreviewing ? 'bg-[#FF3333]/10 border-[#FF3333]/40' : 'bg-[#111] hover:bg-white/5 border-white/5'}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onPreview}
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isPreviewing ? 'bg-[#FF3333] shadow-[0_0_15px_rgba(255,51,51,0.4)]' : 'bg-gradient-to-br from-[#FF3333]/20 to-purple-600/20 border border-white/10 hover:border-[#FF3333]/50'}`}
        >
          {isPreviewing ? (
            <div className="flex gap-0.5 items-end h-4">
              {[...Array(4)].map((_, i) => (
                <motion.div key={i} animate={{ height: ['30%', '100%', '30%'] }} transition={{ repeat: Infinity, duration: 0.4 + i * 0.1 }}
                  className="w-0.5 bg-white rounded-full" />
              ))}
            </div>
          ) : (
            <Music size={16} className="text-white" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white flex items-center gap-2 truncate">
            {song.title}
            {song.trending && <span className="text-[8px] bg-red-500/20 text-red-500 px-1 rounded uppercase flex-shrink-0">Viral</span>}
          </div>
          <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2 truncate">
            {song.artist} • {song.duration || '—'}
            {song.platform && (
              <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase ${platformClass}`}>
                {song.platform}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={onPreview}
          className={`px-2 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all border ${isPreviewing ? 'bg-[#FF3333]/20 border-[#FF3333]/50 text-[#FF3333]' : 'opacity-0 group-hover:opacity-100 bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
        >
          Preview
        </button>
        <button
          onClick={onSelect}
          className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-white text-black text-[9px] font-black uppercase rounded-lg transition-all hover:bg-[#FF3333] hover:text-white"
        >
          Use
        </button>
      </div>
    </motion.div>
  );
}