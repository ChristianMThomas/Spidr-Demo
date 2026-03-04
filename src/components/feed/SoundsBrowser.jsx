import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, Upload, Play, Pause, Disc3, Music, Loader2, Bookmark, X, Globe } from 'lucide-react';
import { toast } from 'sonner';
import FrequencyArchive from './FrequencyArchive';
import MusicSearch from './MusicSearch';

export default function SoundsBrowser({ currentUser }) {
  const [activeTab, setActiveTab] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: allTracks = [], isLoading } = useQuery({
    queryKey: ['audio-tracks'],
    queryFn: () => base44.entities.AudioTrack.list('-use_count', 100),
    staleTime: 30000,
  });

  const { data: savedAudios = [] } = useQuery({
    queryKey: ['saved-audios', currentUser?.id],
    queryFn: () => base44.entities.SavedAudio.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
    staleTime: 30000,
  });

  const { data: clips = [] } = useQuery({
    queryKey: ['clips'],
    queryFn: () => base44.entities.Clip.list('-created_date', 100),
    staleTime: 30000,
  });

  const savedAudioIds = new Set(savedAudios.map(s => s.audio_id));

  // Filter tracks based on search and tab
  const getDisplayTracks = () => {
    let tracks = allTracks;
    
    if (searchQuery.trim()) {
      tracks = tracks.filter(t =>
        t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artist?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    switch (activeTab) {
      case 'trending':
        return tracks.sort((a, b) => (b.use_count || 0) - (a.use_count || 0));
      case 'originals':
        return tracks.filter(t => t.is_original || t.audio_url);
      case 'saved':
        return tracks.filter(t => savedAudioIds.has(t.id));
      default:
        return tracks;
    }
  };

  const displayTracks = getDisplayTracks();

  // Count clips per audio track
  const clipCountMap = {};
  clips.forEach(c => {
    if (c.audio_id) clipCountMap[c.audio_id] = (clipCountMap[c.audio_id] || 0) + 1;
  });

  const togglePlay = (track) => {
    if (!track.audio_url) return;
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(track.audio_url);
      audioRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => setPlayingId(null);
      setPlayingId(track.id);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Audio files only'); return; }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.AudioTrack.create({
      title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
      artist: currentUser?.full_name || 'Unknown',
      audio_url: file_url,
      uploader_id: currentUser?.id,
      is_original: true,
      use_count: 0,
      save_count: 0,
      tags: ['upload', 'original'],
    });
    queryClient.invalidateQueries(['audio-tracks']);
    setUploading(false);
    toast.success('Sound uploaded!');
  };

  const formatCount = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  if (selectedAudio) {
    return (
      <FrequencyArchive
        audioTrack={selectedAudio}
        onClose={() => setSelectedAudio(null)}
        currentUser={currentUser}
        onClipClick={() => setSelectedAudio(null)}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
            <Disc3 className="text-[#FF3333]" size={22} /> Sounds
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider transition-colors"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload Sound
            </button>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        {/* Search */}
        <div className="relative group mb-3">
          <Search size={16} className="absolute left-4 top-3 text-gray-500 group-focus-within:text-[#FF3333] transition-colors" />
          <input
            type="text"
            placeholder="Search sounds, artists, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-[#FF3333] outline-none font-mono transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'trending', label: 'Trending', icon: TrendingUp },
            { id: 'discover', label: 'Discover', icon: Globe },
            { id: 'originals', label: 'Uploaded', icon: Music },
            { id: 'saved', label: 'Saved', icon: Bookmark },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-[#FF3333]/20 text-[#FF3333] border border-[#FF3333]/30'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
              {tab.id === 'saved' && savedAudios.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-[#FF3333]/20 text-[#FF3333] rounded-full text-[8px]">{savedAudios.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'discover' ? (
          <div className="p-2">
            <MusicSearch
              currentUser={currentUser}
              onSelectTrack={(track) => {
                // After creating the AudioTrack, open its page
                setSelectedAudio(track);
              }}
            />
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading sounds...
          </div>
        ) : displayTracks.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Music size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">
              {activeTab === 'saved' ? 'No saved sounds yet' : searchQuery ? 'No results found' : 'No sounds yet'}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              {activeTab === 'saved' ? 'Save sounds from clips to find them here' : 'Upload the first sound!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTracks.map((track, idx) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-3 p-3 bg-[#0a0a0a] hover:bg-white/5 border border-white/5 rounded-xl group transition-colors cursor-pointer"
                onClick={() => setSelectedAudio(track)}
              >
                {/* Play button */}
                <button
                  onClick={(e) => { e.stopPropagation(); togglePlay(track); }}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    playingId === track.id
                      ? 'bg-[#FF3333] text-white shadow-[0_0_20px_rgba(255,51,51,0.4)]'
                      : 'bg-[#111] border border-white/10 text-gray-400 group-hover:text-white group-hover:border-[#FF3333]/50'
                  }`}
                >
                  {track.cover_url ? (
                    <img src={track.cover_url} className="w-full h-full object-cover rounded-xl" alt="" />
                  ) : playingId === track.id ? (
                    <Pause size={18} fill="currentColor" />
                  ) : (
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  )}
                </button>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white flex items-center gap-2 truncate">
                    {track.title}
                    {track.is_original && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 rounded uppercase flex-shrink-0">Original</span>}
                    {(track.use_count || 0) >= 50 && <span className="text-[8px] bg-red-500/20 text-red-500 px-1.5 rounded uppercase flex-shrink-0">🔥 Hot</span>}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2 mt-0.5">
                    <span>{track.artist || 'Unknown'}</span>
                    <span>•</span>
                    <span className="text-[#FF3333]">{formatCount(clipCountMap[track.id] || track.use_count || 0)} clips</span>
                    {track.save_count > 0 && (
                      <>
                        <span>•</span>
                        <span>{formatCount(track.save_count)} saves</span>
                      </>
                    )}
                  </div>
                  {track.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {track.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-white/5 text-zinc-500 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {savedAudioIds.has(track.id) && (
                    <Bookmark size={14} className="text-[#FF3333]" fill="currentColor" />
                  )}
                  <div className="text-[10px] text-gray-500 font-mono">
                    {formatCount(clipCountMap[track.id] || track.use_count || 0)}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-white transition-colors">
                    <Play size={12} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Now playing bar */}
      <AnimatePresence>
        {playingId && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="h-12 bg-[#111] border-t border-[#FF3333]/30 flex items-center justify-between px-4 flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: ['20%', '100%', '20%'] }}
                    transition={{ repeat: Infinity, duration: Math.random() * 0.5 + 0.3 }}
                    className="w-0.5 bg-[#FF3333] rounded-full"
                    style={{ height: '20%', maxHeight: '16px' }}
                  />
                ))}
              </div>
              <span className="text-xs text-white font-bold truncate max-w-[200px]">
                {allTracks.find(t => t.id === playingId)?.title}
              </span>
            </div>
            <button
              onClick={() => { audioRef.current?.pause(); setPlayingId(null); }}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}