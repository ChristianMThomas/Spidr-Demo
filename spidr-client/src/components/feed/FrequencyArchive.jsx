import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { Play, Pause, Bookmark, Radio, Activity, ArrowLeft, X, Music } from 'lucide-react';
import { toast } from 'sonner';

export default function FrequencyArchive({ audioTrack, onClose, currentUser, onClipClick, onUseSound }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: clipsUsingAudio = [] } = useQuery({
    queryKey: ['clips-by-audio', audioTrack?.id],
    queryFn: () => entities.Clip.filter({ audio_id: audioTrack?.id }),
    enabled: !!audioTrack?.id,
    staleTime: 30000,
  });

  const { data: savedAudios = [] } = useQuery({
    queryKey: ['saved-audios', currentUser?.id],
    queryFn: () => entities.SavedAudio.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
    staleTime: 30000,
  });

  const isSaved = savedAudios.some(s => s.audio_id === audioTrack?.id);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        const existing = savedAudios.find(s => s.audio_id === audioTrack?.id);
        if (existing) await entities.SavedAudio.delete(existing.id);
      } else {
        await entities.SavedAudio.create({ user_id: currentUser?.id, audio_id: audioTrack?.id });
        await entities.AudioTrack.update(audioTrack.id, { save_count: (audioTrack.save_count || 0) + 1 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-audios'] });
      queryClient.invalidateQueries({ queryKey: ['audio-tracks'] });
      toast.success(isSaved ? 'Removed from database' : 'Extracted to your database!');
    }
  });

  const togglePlay = () => {
    if (!audioTrack?.audio_url) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioTrack.audio_url);
        audioRef.current.onended = () => setIsPlaying(false);
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatUses = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  if (!audioTrack) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 z-[200] bg-[#050505] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="relative p-6 border-b border-white/5 bg-[#0a0a0a] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF3333]/10 to-transparent pointer-events-none" />

        {/* Close / Back button */}
        <button
          onClick={() => { audioRef.current?.pause(); onClose(); }}
          className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="relative z-10 flex gap-6 items-center max-w-4xl mx-auto pl-12">
          {/* Play button / Cover */}
          <button
            onClick={togglePlay}
            className="w-28 h-28 flex-shrink-0 bg-[#111] rounded-2xl border border-white/10 flex items-center justify-center relative group shadow-[0_0_30px_rgba(255,51,51,0.1)] hover:border-[#FF3333]/50 transition-all"
          >
            {audioTrack.cover_url ? (
              <img src={audioTrack.cover_url} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-60" alt="" />
            ) : (
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 rounded-2xl" />
            )}
            <div className={`w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/20 transition-transform z-10 ${isPlaying ? 'scale-110 border-[#FF3333]' : 'group-hover:scale-110'}`}>
              {isPlaying ? <Pause size={24} className="text-[#FF3333]" fill="currentColor" /> : <Play size={24} className="text-white ml-1" fill="currentColor" />}
            </div>
          </button>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white italic tracking-tighter mb-1">
              {audioTrack.title}
            </h1>
            <div className="text-sm text-gray-400 font-mono mb-3 flex items-center gap-2">
              <Radio size={14} className="text-[#FF3333]" /> {audioTrack.artist || 'Unknown'}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                {formatUses(audioTrack.use_count)} SIGNALS INJECTED
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                {formatUses(audioTrack.save_count)} EXTRACTED
              </div>
              <button
                onClick={() => saveMutation.mutate()}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isSaved ? 'bg-white text-black' : 'bg-[#111] text-white border border-white/10 hover:border-[#FF3333] hover:text-[#FF3333]'}`}
              >
                <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? 'Saved' : 'Save Sound'}
              </button>
              {onUseSound && (
                <button
                  onClick={() => onUseSound(audioTrack)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-[#FF3333] hover:bg-red-600 text-white transition-all shadow-[0_0_20px_rgba(255,51,51,0.3)]"
                >
                  🎵 Use This Sound
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Audio visualizer */}
        <div className="absolute bottom-0 left-0 w-full h-10 flex items-end justify-center gap-1 opacity-20 pointer-events-none">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="w-2 bg-[#FF3333] rounded-t-sm transition-all duration-200"
              style={{ height: isPlaying ? `${Math.random() * 100}%` : '10%' }}
            />
          ))}
        </div>
      </div>

      {/* Resonance Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity size={16} className="text-[#FF3333]" /> Resonance Grid — {clipsUsingAudio.length} clip{clipsUsingAudio.length !== 1 ? 's' : ''}
          </div>

          {clipsUsingAudio.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Music size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No clips using this frequency yet</p>
              <p className="text-xs text-zinc-600 mt-1">Be the first to inject it into a strand!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {clipsUsingAudio.map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => onClipClick?.(clip)}
                  className="aspect-[9/16] bg-[#111] rounded-xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-[#FF3333]/50 transition-colors"
                >
                  {clip.thumbnail_url ? (
                    <img src={clip.thumbnail_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <Play size={24} className="text-zinc-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={32} className="text-white drop-shadow-lg" fill="currentColor" />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-[10px] text-white font-bold drop-shadow-md line-clamp-1">{clip.author_name}</p>
                    <div className="flex items-center gap-1 text-[9px] text-white/60">
                      <Play size={8} /> {clip.views || 0}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
