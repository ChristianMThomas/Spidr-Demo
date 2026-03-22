import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bookmark, TrendingUp, Upload, Play, Pause, Disc3, X, Music, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import MusicSearch from './MusicSearch';

export default function AudioDatabase({ open, onClose, onSelectAudio, currentUser }) {
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: allTracks = [], isLoading } = useQuery({
    queryKey: ['audio-tracks'],
    queryFn: () => entities.AudioTrack.list('-use_count', 50),
    enabled: open,
    staleTime: 30000,
  });

  const { data: savedAudios = [] } = useQuery({
    queryKey: ['saved-audios', currentUser?.id],
    queryFn: () => entities.SavedAudio.filter({ user_id: currentUser?.id }),
    enabled: open && !!currentUser?.id,
    staleTime: 30000,
  });

  const savedAudioIds = new Set(savedAudios.map(s => s.audio_id));

  const filtered = allTracks.filter(t =>
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const savedTracks = allTracks.filter(t => savedAudioIds.has(t.id));

  const togglePlay = (track) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(track.url);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => setPlayingId(null);
      setPlayingId(track.id);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Audio files only'); return; }
    setUploading(true);
    const { url: file_url } = await integrations.Core.UploadFile({ file });
    const track = await entities.AudioTrack.create({
      title: file.name.replace(/\.[^.]+$/, '').toUpperCase().replace(/[_-]/g, ' '),
      artist: currentUser?.full_name || 'Unknown',
      url: file_url,
      uploader_id: currentUser?.id,
      is_original: false,
      use_count: 0,
      save_count: 0,
      tags: [],
    });
    queryClient.invalidateQueries(['audio-tracks']);
    setUploading(false);
    toast.success('Audio uploaded to database!');
    onSelectAudio(track);
  };

  const handleSelect = (track) => {
    if (audioRef.current) audioRef.current.pause();
    setPlayingId(null);
    onSelectAudio(track);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px]"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/5 bg-[#111]/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
              <Disc3 className="text-[#FF3333]" size={20} /> Audio Database
            </h2>
            <button onClick={() => { if (audioRef.current) audioRef.current.pause(); onClose(); }} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-3 text-gray-500 group-focus-within:text-[#FF3333] transition-colors" />
            <input
              type="text"
              placeholder="Search frequencies, artists, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#050505] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-[#FF3333] outline-none font-mono transition-colors"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#050505] px-5">
          <TabBtn label="Search Music" icon={Globe} active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
          <TabBtn label="Discover" icon={TrendingUp} active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} />
          <TabBtn label="Extracted" icon={Bookmark} active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} count={savedTracks.length} />
          <TabBtn label="Inject Local" icon={Upload} active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'search' && (
              <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MusicSearch
                  currentUser={currentUser}
                  onSelectTrack={(track) => {
                    if (audioRef.current) audioRef.current.pause();
                    setPlayingId(null);
                    onSelectAudio(track);
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'discover' && (
              <motion.div key="discover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-500">
                    <Loader2 size={20} className="animate-spin mr-2" /> Loading frequencies...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-sm">
                    {searchQuery ? 'No results found' : 'No audio tracks yet. Upload the first one!'}
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-2">
                      {searchQuery ? `Results (${filtered.length})` : 'Trending Frequencies'}
                    </div>
                    {filtered.map((track) => (
                      <TrackItem
                        key={track.id}
                        track={track}
                        isPlaying={playingId === track.id}
                        isSaved={savedAudioIds.has(track.id)}
                        onTogglePlay={() => togglePlay(track)}
                        onSelect={() => handleSelect(track)}
                      />
                    ))}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'saved' && (
              <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-2">Your Extracted Frequencies</div>
                {savedTracks.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-sm">
                    <Bookmark size={32} className="mx-auto mb-3 opacity-30" />
                    No saved frequencies yet. Extract sounds from the feed!
                  </div>
                ) : (
                  savedTracks.map((track) => (
                    <TrackItem
                      key={track.id}
                      track={track}
                      isPlaying={playingId === track.id}
                      isSaved={true}
                      onTogglePlay={() => togglePlay(track)}
                      onSelect={() => handleSelect(track)}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center p-8">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-[#111] border-2 border-dashed border-white/20 flex items-center justify-center mb-4 text-gray-500 hover:text-[#FF3333] hover:border-[#FF3333] transition-colors cursor-pointer group"
                >
                  {uploading ? <Loader2 size={32} className="animate-spin" /> : <Upload size={32} className="group-hover:scale-110 transition-transform" />}
                </button>
                <h3 className="text-white font-bold mb-1">Inject Local Audio</h3>
                <p className="text-[10px] text-gray-500 font-mono text-center">
                  Upload MP3 or WAV files. Max size 10MB.<br />
                  Content will be scanned by Aegis Protocol.
                </p>
                <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Playing indicator */}
        {playingId && (
          <div className="h-10 bg-[#FF3333]/10 border-t border-[#FF3333]/30 flex items-center justify-center gap-0.5 shrink-0">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: ['20%', '100%', '20%'] }}
                transition={{ repeat: Infinity, duration: Math.random() * 0.5 + 0.5 }}
                className="w-1 bg-[#FF3333] rounded-full"
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function TabBtn({ label, icon: Icon, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-4 mr-6 text-[10px] font-black uppercase tracking-widest transition-colors relative ${active ? 'text-[#FF3333]' : 'text-gray-500 hover:text-gray-300'}`}
    >
      <Icon size={14} /> {label}
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-[#FF3333]/20 text-[#FF3333] rounded-full text-[8px]">{count}</span>
      )}
      {active && (
        <motion.div layoutId="audiodbtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF3333] shadow-[0_0_10px_#FF3333]" />
      )}
    </button>
  );
}

function TrackItem({ track, isPlaying, isSaved, onTogglePlay, onSelect }) {
  const formatUses = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-[#111] hover:bg-white/5 border border-white/5 rounded-xl group transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isPlaying ? 'bg-[#FF3333] text-white shadow-[0_0_15px_rgba(255,51,51,0.4)]' : 'bg-black border border-white/10 text-gray-400 group-hover:text-white group-hover:border-[#FF3333]/50'}`}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            {track.title}
            {track.is_original && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded uppercase">Original</span>}
            {(track.use_count || 0) > 50 && <span className="text-[8px] bg-red-500/20 text-red-500 px-1 rounded uppercase">Hot</span>}
          </div>
          <div className="text-[10px] text-gray-500 font-mono">
            {track.artist || 'Unknown'} • {formatUses(track.use_count)} uses
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSaved && <Bookmark size={12} className="text-[#FF3333]" fill="currentColor" />}
        <button
          onClick={onSelect}
          className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-white text-black text-[10px] font-black uppercase rounded-lg transition-all hover:bg-gray-200"
        >
          Inject
        </button>
      </div>
    </div>
  );
}