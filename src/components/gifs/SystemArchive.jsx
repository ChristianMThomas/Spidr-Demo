import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Copy, Sparkles, Heart, Laugh, Star, Music, Cat, Pizza, Flame, Search, Loader2, Zap, Ghost, Gamepad2, Trophy, PartyPopper } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GIF_CATEGORIES = [
  { id: 'all', label: 'ALL', icon: Sparkles },
  { id: 'reactions', label: 'REACTIONS', icon: Laugh },
  { id: 'hype', label: 'HYPE', icon: Flame },
  { id: 'aesthetic', label: 'AESTHETIC', icon: Heart },
  { id: 'music', label: 'MUSIC', icon: Music },
  { id: 'gaming', label: 'GAMING', icon: Gamepad2 },
  { id: 'memes', label: 'MEMES', icon: Star },
  { id: 'animals', label: 'CREATURES', icon: Cat },
  { id: 'food', label: 'FOOD', icon: Pizza },
  { id: 'sports', label: 'SPORTS', icon: Trophy },
  { id: 'spooky', label: 'SPOOKY', icon: Ghost },
  { id: 'celebration', label: 'PARTY', icon: PartyPopper },
];

// Massive built-in GIF library
const SYSTEM_GIFS = [
  // Reactions
  { id: 1, url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif', cat: 'reactions' },
  { id: 3, url: 'https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif', cat: 'reactions' },
  { id: 8, url: 'https://media.giphy.com/media/26n6Gx9moCgs1pUuk/giphy.gif', cat: 'reactions' },
  { id: 15, url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', cat: 'reactions' },
  { id: 17, url: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif', cat: 'reactions' },
  { id: 18, url: 'https://media.giphy.com/media/xT0xeJpnrWC3XWblEk/giphy.gif', cat: 'reactions' },
  { id: 19, url: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif', cat: 'reactions' },
  { id: 20, url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', cat: 'reactions' },
  { id: 80, url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', cat: 'reactions' },
  { id: 81, url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', cat: 'reactions' },
  // Hype
  { id: 13, url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', cat: 'hype' },
  { id: 14, url: 'https://media.giphy.com/media/l4FGGafcOHBRc1r2g/giphy.gif', cat: 'hype' },
  { id: 21, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'hype' },
  { id: 22, url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', cat: 'hype' },
  { id: 23, url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', cat: 'hype' },
  { id: 24, url: 'https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif', cat: 'hype' },
  { id: 82, url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', cat: 'hype' },
  { id: 83, url: 'https://media.giphy.com/media/kyLYXonQYYfwYDIeZl/giphy.gif', cat: 'hype' },
  // Aesthetic
  { id: 2, url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyg/giphy.gif', cat: 'aesthetic' },
  { id: 9, url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', cat: 'aesthetic' },
  { id: 25, url: 'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif', cat: 'aesthetic' },
  { id: 26, url: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif', cat: 'aesthetic' },
  { id: 27, url: 'https://media.giphy.com/media/26BROrSHlmyzzHf2g/giphy.gif', cat: 'aesthetic' },
  { id: 28, url: 'https://media.giphy.com/media/3oKIPsx2VAYAgEHC12/giphy.gif', cat: 'aesthetic' },
  { id: 84, url: 'https://media.giphy.com/media/l0ExheuNUNGkQ8y0o/giphy.gif', cat: 'aesthetic' },
  { id: 85, url: 'https://media.giphy.com/media/3o7TKUM3IgJBX2as9O/giphy.gif', cat: 'aesthetic' },
  // Music
  { id: 4, url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', cat: 'music' },
  { id: 11, url: 'https://media.giphy.com/media/l0HlQoXCkFTldy7zG/giphy.gif', cat: 'music' },
  { id: 29, url: 'https://media.giphy.com/media/4oMoIbIQrvCjm/giphy.gif', cat: 'music' },
  { id: 30, url: 'https://media.giphy.com/media/l378p60yRSCeVoyAM/giphy.gif', cat: 'music' },
  { id: 31, url: 'https://media.giphy.com/media/l0HlPystfePnAI3G8/giphy.gif', cat: 'music' },
  { id: 86, url: 'https://media.giphy.com/media/tqfS3mgQU28ko/giphy.gif', cat: 'music' },
  // Gaming
  { id: 32, url: 'https://media.giphy.com/media/3oKIPu8oWtzLCqxWwg/giphy.gif', cat: 'gaming' },
  { id: 33, url: 'https://media.giphy.com/media/11BAxHG7paxJcI/giphy.gif', cat: 'gaming' },
  { id: 34, url: 'https://media.giphy.com/media/26tPoyDhjiJ2g7rEs/giphy.gif', cat: 'gaming' },
  { id: 35, url: 'https://media.giphy.com/media/l41YqKTI3pFKuI9CE/giphy.gif', cat: 'gaming' },
  { id: 87, url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif', cat: 'gaming' },
  { id: 88, url: 'https://media.giphy.com/media/du3J3cXyzhj75IOgvA/giphy.gif', cat: 'gaming' },
  // Memes
  { id: 5, url: 'https://media.giphy.com/media/26tPqTOGf1x8VzCAg/giphy.gif', cat: 'memes' },
  { id: 10, url: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif', cat: 'memes' },
  { id: 16, url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', cat: 'memes' },
  { id: 36, url: 'https://media.giphy.com/media/xT9IgDEI1iZyb2wqo8/giphy.gif', cat: 'memes' },
  { id: 37, url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', cat: 'memes' },
  { id: 38, url: 'https://media.giphy.com/media/l0HlvtIPdijkIVCrC/giphy.gif', cat: 'memes' },
  { id: 89, url: 'https://media.giphy.com/media/3o7aCRloybJlXpNjSU/giphy.gif', cat: 'memes' },
  { id: 90, url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', cat: 'memes' },
  // Animals
  { id: 6, url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif', cat: 'animals' },
  { id: 12, url: 'https://media.giphy.com/media/3oz8xLlw6GHVfokaNW/giphy.gif', cat: 'animals' },
  { id: 39, url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif', cat: 'animals' },
  { id: 40, url: 'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif', cat: 'animals' },
  { id: 41, url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', cat: 'animals' },
  { id: 42, url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', cat: 'animals' },
  { id: 91, url: 'https://media.giphy.com/media/cfuL5gqFDreXxkWQ4o/giphy.gif', cat: 'animals' },
  { id: 92, url: 'https://media.giphy.com/media/nR4L10XlJcSeQ/giphy.gif', cat: 'animals' },
  // Food
  { id: 7, url: 'https://media.giphy.com/media/3og0INAY5MLmEBubyU/giphy.gif', cat: 'food' },
  { id: 43, url: 'https://media.giphy.com/media/xT0xeMA62E1XIlqYb6/giphy.gif', cat: 'food' },
  { id: 44, url: 'https://media.giphy.com/media/l0Exk8EUzSLsGtH1e/giphy.gif', cat: 'food' },
  { id: 45, url: 'https://media.giphy.com/media/IgOEWPOgK6kVa/giphy.gif', cat: 'food' },
  { id: 93, url: 'https://media.giphy.com/media/xTiTnMjBKwMH2rY4fu/giphy.gif', cat: 'food' },
  { id: 94, url: 'https://media.giphy.com/media/RMkX4jGnnf5Re/giphy.gif', cat: 'food' },
  // Sports
  { id: 46, url: 'https://media.giphy.com/media/3o7TKMeCOV3oXSb5bq/giphy.gif', cat: 'sports' },
  { id: 47, url: 'https://media.giphy.com/media/26n6WywJyh39n9pBu/giphy.gif', cat: 'sports' },
  { id: 48, url: 'https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy.gif', cat: 'sports' },
  { id: 49, url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', cat: 'sports' },
  { id: 95, url: 'https://media.giphy.com/media/l0HlHSB8v5yRtBlHW/giphy.gif', cat: 'sports' },
  { id: 96, url: 'https://media.giphy.com/media/3og0IExSrnfW2kUaaI/giphy.gif', cat: 'sports' },
  // Spooky
  { id: 50, url: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif', cat: 'spooky' },
  { id: 51, url: 'https://media.giphy.com/media/xT9IgFLBcm3Wi6l6qA/giphy.gif', cat: 'spooky' },
  { id: 52, url: 'https://media.giphy.com/media/l2JeiAyDGST19bO6c/giphy.gif', cat: 'spooky' },
  { id: 53, url: 'https://media.giphy.com/media/3otPoJhe5AZrhllEBy/giphy.gif', cat: 'spooky' },
  { id: 97, url: 'https://media.giphy.com/media/l378BzHA5FwWFXVSg/giphy.gif', cat: 'spooky' },
  // Celebration
  { id: 54, url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', cat: 'celebration' },
  { id: 55, url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', cat: 'celebration' },
  { id: 56, url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', cat: 'celebration' },
  { id: 57, url: 'https://media.giphy.com/media/26tOZ42Mg6r8qiB7a/giphy.gif', cat: 'celebration' },
  { id: 98, url: 'https://media.giphy.com/media/s2qXK8wKkNmmQ/giphy.gif', cat: 'celebration' },
  { id: 99, url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', cat: 'celebration' },
];

const EMOJI_SECTIONS = {
  'TRENDING SIGNALS': ['😭', '💀', '🔥', '✨', '💅', '🤌', '💯', '🤝', '💪', '🫶', '🤙', '😈', '👀', '🥺', '🤡', '🙄', '😩', '🤪', '😳', '😤'],
  'AESTHETIC CORE': ['🌸', '🦋', '✨', '🌙', '⭐', '💫', '🌈', '🍓', '🧚‍♀️', '🎀', '💖', '🫧', '🪷', '🌺', '💎', '🔮', '🕯️', '🌿', '☁️', '🦢'],
  'DARK ENERGY': ['💀', '🖤', '⛓️', '🕷️', '🩸', '👁️', '🦇', '🌑', '⚰️', '🔪', '👻', '💣', '🫀', '☠️', '🐍', '🪦', '⚡', '🌪️', '🥀', '🔮'],
  'CREATURE LAB': ['🐈', '🐕', '🦋', '🐸', '🦆', '🦊', '🐰', '🦥', '🐌', '🦇', '🐝', '🦖', '🐙', '🦑', '🪼', '🐺', '🦈', '🐊', '🦅', '🦎'],
  'FUEL STATION': ['🍕', '☕', '🍔', '🌮', '🍜', '🍰', '🍪', '🍩', '🧃', '🧋', '🍓', '🥑', '🍣', '🌶️', '🫕', '🍿', '🥡', '🍱', '🥟', '🫘'],
  'POWER GLYPHS': ['⚡', '❤️‍🔥', '🧿', '🪬', '💝', '🔱', '♾️', '🏴‍☠️', '🎯', '🛡️', '⚔️', '🪩', '🎪', '🎭', '🎲', '🀄', '🃏', '♟️', '🧩', '🎮'],
  'HAND SIGNALS': ['👋', '✌️', '🤞', '🫰', '🤟', '🤘', '🫵', '👆', '👇', '👈', '👉', '👍', '👎', '👊', '✊', '🤜', '🤛', '👏', '🙌', '🫶'],
  'FACE MATRIX': ['😀', '😂', '🥲', '😊', '😎', '🤓', '🥳', '😏', '😑', '😶‍🌫️', '🫠', '🤥', '😬', '🫡', '🤫', '🫢', '😵‍💫', '🤑', '🥴', '😇'],
  'LOVE & HEARTS': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '❤️‍🔥', '❤️‍🩹'],
  'NATURE SIGNALS': ['🌍', '🌎', '🌏', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '⭐', '🌟', '💫', '✨', '☀️', '🌤️', '⛅', '🌈'],
  'FLAG CODES': ['🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🚩', '🏁', '🏴', '🏳️', '🎌', '🇺🇸', '🇬🇧', '🇯🇵', '🇰🇷', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇧🇷', '🇨🇦', '🇦🇺', '🇲🇽'],
  'ACTIVITY NODES': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳'],
  'TRANSPORT WEB': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '✈️', '🚀'],
};

export default function SystemArchive({ activeSubTab, search }) {
  const [gifCat, setGifCat] = useState('all');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const debounceTimerRef = useRef(null);

  const handleGifSearch = (val) => {
    setGifSearch(val);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      if (!val.trim()) { setSearchResults(null); return; }
      setSearching(true);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Find me 12 popular GIF URLs from giphy.com for the search term: "${val}". Return direct giphy media URLs (https://media.giphy.com/media/XXXX/giphy.gif format). Focus on the most popular, recognizable GIFs. Return JSON.`,
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
    }, 600);
  };

  const copyEmoji = (emoji) => {
    navigator.clipboard.writeText(emoji);
    toast.success(`Copied ${emoji}`);
  };

  const copyGif = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('GIF link copied');
  };

  const filteredGifs = SYSTEM_GIFS.filter(g => {
    if (gifCat !== 'all' && g.cat !== gifCat) return false;
    return true;
  });

  if (activeSubTab === 'emojis') {
    return (
      <div className="space-y-6">
        {Object.entries(EMOJI_SECTIONS).map(([title, emojis]) => (
          <div key={title}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 bg-[#FF3333] rounded-full" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{title}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-2">
              {emojis.map((emoji, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.3, y: -4 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => copyEmoji(emoji)}
                  className="aspect-square bg-white/[0.03] rounded-xl flex items-center justify-center text-2xl hover:bg-[#FF3333]/10 border border-white/5 hover:border-[#FF3333]/30 transition-all cursor-pointer"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* GIF Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
        <input
          type="text"
          placeholder="Search millions of GIFs..."
          value={gifSearch}
          onChange={(e) => handleGifSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-[#FF3333]/50 outline-none font-mono"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF3333] animate-spin" />}
      </div>

      {/* Search results */}
      {searchResults ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
              <Zap size={10} className="inline mr-1 text-[#FF3333]" />
              AI Search Results for "{gifSearch}"
            </span>
            <button onClick={() => { setSearchResults(null); setGifSearch(''); }} className="text-[9px] text-zinc-600 hover:text-white">Clear</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {searchResults.map((gif, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.03 }}
                className="relative group aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-[#FF3333]/30 transition-all cursor-pointer"
                onClick={() => copyGif(gif.url)}
              >
                <img src={gif.url} alt={gif.label} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                  <div className="px-3 py-1.5 bg-[#FF3333] rounded-lg text-[10px] font-bold text-white flex items-center gap-1">
                    <Copy size={10} /> COPY
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* GIF Category bar */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
            {GIF_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setGifCat(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                  gifCat === cat.id
                    ? 'bg-[#FF3333]/20 text-[#FF3333] border border-[#FF3333]/40'
                    : 'bg-white/5 text-zinc-500 border border-white/5 hover:text-white hover:border-white/20'
                }`}
              >
                <cat.icon size={12} />
                {cat.label}
              </button>
            ))}
          </div>

          {/* GIF Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredGifs.map((gif) => (
              <motion.div
                key={gif.id}
                whileHover={{ scale: 1.03 }}
                className="relative group aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-[#FF3333]/30 transition-all cursor-pointer"
                onClick={() => copyGif(gif.url)}
              >
                <img src={gif.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                  <div className="px-3 py-1.5 bg-[#FF3333] rounded-lg text-[10px] font-bold text-white flex items-center gap-1">
                    <Copy size={10} /> COPY
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}