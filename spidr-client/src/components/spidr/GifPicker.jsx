import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Flame, Laugh, Heart, Music, Gamepad2, Star, Cat, Pizza, Ghost, PartyPopper, Sparkles, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

const GIF_CATEGORIES = [
  { id: 'all', label: 'ALL', icon: Sparkles },
  { id: 'reactions', label: 'REACT', icon: Laugh },
  { id: 'hype', label: 'HYPE', icon: Flame },
  { id: 'aesthetic', label: 'VIBE', icon: Heart },
  { id: 'gaming', label: 'GAME', icon: Gamepad2 },
  { id: 'memes', label: 'MEME', icon: Star },
  { id: 'animals', label: 'PETS', icon: Cat },
  { id: 'celebration', label: 'PARTY', icon: PartyPopper },
];

const SYSTEM_GIFS = [
  { id: 1, url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif', cat: 'reactions' },
  { id: 3, url: 'https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif', cat: 'reactions' },
  { id: 8, url: 'https://media.giphy.com/media/26n6Gx9moCgs1pUuk/giphy.gif', cat: 'reactions' },
  { id: 15, url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', cat: 'reactions' },
  { id: 17, url: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif', cat: 'reactions' },
  { id: 18, url: 'https://media.giphy.com/media/xT0xeJpnrWC3XWblEk/giphy.gif', cat: 'reactions' },
  { id: 80, url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', cat: 'reactions' },
  { id: 81, url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', cat: 'reactions' },
  { id: 13, url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', cat: 'hype' },
  { id: 14, url: 'https://media.giphy.com/media/l4FGGafcOHBRc1r2g/giphy.gif', cat: 'hype' },
  { id: 21, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'hype' },
  { id: 82, url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', cat: 'hype' },
  { id: 83, url: 'https://media.giphy.com/media/kyLYXonQYYfwYDIeZl/giphy.gif', cat: 'hype' },
  { id: 2, url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyg/giphy.gif', cat: 'aesthetic' },
  { id: 9, url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', cat: 'aesthetic' },
  { id: 25, url: 'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif', cat: 'aesthetic' },
  { id: 84, url: 'https://media.giphy.com/media/l0ExheuNUNGkQ8y0o/giphy.gif', cat: 'aesthetic' },
  { id: 32, url: 'https://media.giphy.com/media/3oKIPu8oWtzLCqxWwg/giphy.gif', cat: 'gaming' },
  { id: 33, url: 'https://media.giphy.com/media/11BAxHG7paxJcI/giphy.gif', cat: 'gaming' },
  { id: 87, url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif', cat: 'gaming' },
  { id: 88, url: 'https://media.giphy.com/media/du3J3cXyzhj75IOgvA/giphy.gif', cat: 'gaming' },
  { id: 5, url: 'https://media.giphy.com/media/26tPqTOGf1x8VzCAg/giphy.gif', cat: 'memes' },
  { id: 10, url: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif', cat: 'memes' },
  { id: 89, url: 'https://media.giphy.com/media/3o7aCRloybJlXpNjSU/giphy.gif', cat: 'memes' },
  { id: 90, url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', cat: 'memes' },
  { id: 6, url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif', cat: 'animals' },
  { id: 12, url: 'https://media.giphy.com/media/3oz8xLlw6GHVfokaNW/giphy.gif', cat: 'animals' },
  { id: 39, url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif', cat: 'animals' },
  { id: 91, url: 'https://media.giphy.com/media/cfuL5gqFDreXxkWQ4o/giphy.gif', cat: 'animals' },
  { id: 54, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'celebration' },
  { id: 56, url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', cat: 'celebration' },
  { id: 98, url: 'https://media.giphy.com/media/s2qXK8wKkNmmQ/giphy.gif', cat: 'celebration' },
  { id: 99, url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', cat: 'celebration' },
];

export default function GifPicker({ onGifSelect }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Community GIFs from Hive
  const { data: communityGifs = [] } = useQuery({
    queryKey: ['community-gifs-picker'],
    queryFn: () => entities.CommunityAsset.filter({ type: 'gif', is_public: true }, '-created_date', 50),
    staleTime: 60000,
  });

  const _searchDebounce = useRef(null);
  const searchGifs = useCallback(async (query) => {
    clearTimeout(_searchDebounce.current);
    _searchDebounce.current = setTimeout(async () => {
      if (!query.trim()) { setSearchResults(null); return; }
      setSearching(true);
      const result = await integrations.Core.InvokeLLM({
        prompt: `Find 8 popular GIF URLs from giphy.com for: "${query}". Return direct giphy media URLs (https://media.giphy.com/media/XXXX/giphy.gif format).`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            gifs: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, label: { type: 'string' } } } }
          }
        }
      });
      setSearchResults(result.gifs || []);
      setSearching(false);
    }, 700);
  }, []);

  const handleSearch = (val) => {
    setSearch(val);
    searchGifs(val);
  };

  const filteredGifs = useMemo(() => {
    if (category === 'all') return SYSTEM_GIFS;
    return SYSTEM_GIFS.filter(g => g.cat === category);
  }, [category]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#FF3333]/50"
          />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#FF3333] animate-spin" />}
        </div>
      </div>

      {/* Categories */}
      {!searchResults && (
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {GIF_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase whitespace-nowrap transition-all ${
                category === cat.id
                  ? 'bg-[#FF3333]/20 text-[#FF3333]'
                  : 'bg-white/5 text-zinc-500 hover:text-white'
              }`}
            >
              <cat.icon size={10} />
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="px-3 pb-3">
          {/* Community GIFs section — always visible when GIFs exist, regardless of category */}
          {!searchResults && communityGifs.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Globe size={10} className="text-blue-400" />
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Community Hive</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {communityGifs.map(gif => (
                  <motion.button
                    key={gif.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onGifSelect(gif.url)}
                    className="aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-white/5 hover:border-[#FF3333]/30"
                  >
                    <img src={gif.url} alt={gif.name} className="w-full h-full object-cover" loading="lazy" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {searchResults ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-zinc-500 uppercase">Results for "{search}"</span>
                <button onClick={() => { setSearchResults(null); setSearch(''); }} className="text-[8px] text-zinc-600 hover:text-white">Clear</button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {searchResults.map((gif, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onGifSelect(gif.url)}
                    className="aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-white/5 hover:border-[#FF3333]/30"
                  >
                    <img src={gif.url} alt={gif.label} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={10} className="text-[#FF3333]" />
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                  {category === 'all' ? 'System GIFs' : GIF_CATEGORIES.find(c => c.id === category)?.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {filteredGifs.map(gif => (
                  <motion.button
                    key={gif.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onGifSelect(gif.url)}
                    className="aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-white/5 hover:border-[#FF3333]/30"
                  >
                    <img src={gif.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}