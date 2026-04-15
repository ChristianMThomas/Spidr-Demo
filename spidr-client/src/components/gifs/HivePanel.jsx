import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Copy, Download, Loader2, Filter } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

export default function HivePanel({ currentUser, search }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['community-assets'],
    queryFn: () => entities.CommunityAsset.list('-created_date', 100),
  });

  const likeMutation = useMutation({
    mutationFn: async (asset) => {
      const likes = asset.likes || [];
      const hasLiked = likes.includes(currentUser?.id);
      const newLikes = hasLiked ? likes.filter(id => id !== currentUser?.id) : [...likes, currentUser?.id];
      return entities.CommunityAsset.update(asset.id, { likes: newLikes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-assets'] }),
  });

  const filtered = assets.filter(a => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (search && !a.name?.toLowerCase().includes(search.toLowerCase()) && !(a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'popular') return (b.likes?.length || 0) - (a.likes?.length || 0);
    return 0; // default is already sorted by -created_date
  });

  const copyAsset = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#FF3333] animate-spin" />
        <span className="ml-2 text-zinc-500 text-xs font-mono">LOADING_HIVE_DATA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {[{ id: 'all', label: 'ALL' }, { id: 'gif', label: 'GIFS' }, { id: 'emoji', label: 'EMOJIS' }, { id: 'sticker', label: 'STICKERS' }].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                typeFilter === f.id
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  : 'bg-white/5 text-zinc-500 border-white/5 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[{ id: 'recent', label: 'LATEST' }, { id: 'popular', label: 'TOP' }].map(s => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                sortBy === s.id
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-zinc-600 border-white/5 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <span className="text-2xl">🕸️</span>
          </div>
          <div className="text-sm font-bold text-zinc-400 mb-1">The Hive is empty</div>
          <div className="text-xs text-zinc-600">Be the first to transmit a signal</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((asset) => {
            const hasLiked = (asset.likes || []).includes(currentUser?.id);
            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className="group relative rounded-xl overflow-hidden bg-[#0a0a0a] border border-white/5 hover:border-[#FF3333]/30 transition-all"
              >
                {/* Asset */}
                <div className="aspect-square relative overflow-hidden cursor-pointer" onClick={() => copyAsset(asset.url)}>
                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
                  
                  {/* Type badge */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur rounded text-[7px] font-black text-zinc-400 uppercase">
                    {asset.type}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                    <div className="flex gap-1.5 w-full">
                      <button onClick={(e) => { e.stopPropagation(); copyAsset(asset.url); }}
                        className="flex-1 py-1.5 bg-[#FF3333] rounded-lg text-[9px] font-bold text-white flex items-center justify-center gap-1">
                        <Copy size={10} /> COPY
                      </button>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-white truncate">:{asset.name}:</span>
                    <button
                      onClick={() => likeMutation.mutate(asset)}
                      className={`flex items-center gap-1 text-[9px] font-bold transition-colors ${hasLiked ? 'text-[#FF3333]' : 'text-zinc-600 hover:text-[#FF3333]'}`}
                    >
                      <Heart size={10} fill={hasLiked ? 'currentColor' : 'none'} />
                      {(asset.likes || []).length}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={asset.author_avatar} />
                      <AvatarFallback className="bg-zinc-800 text-[6px]">{asset.author_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-[9px] text-zinc-500 truncate">{asset.author_name}</span>
                  </div>
                  {asset.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {asset.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-white/5 rounded text-[7px] text-zinc-500 font-mono">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
