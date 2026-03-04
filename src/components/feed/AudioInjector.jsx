import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Music, Play, Pause, Search, Radio, X, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const PRESET_TRACKS = [
  { id: 'phonk1', title: 'PHONK_DRIFT_BASS', artist: 'Kordhell', duration: '0:30', isTrending: true },
  { id: 'cyber1', title: 'CYBERPUNK_OST_V2', artist: 'Neon Synth', duration: '0:45', isTrending: true },
  { id: 'lofi1', title: 'LoFi_Spidr_Webs', artist: 'Chill Beats', duration: '1:00', isTrending: false },
  { id: 'trap1', title: 'DARK_TRAP_808', artist: 'Shadow Producer', duration: '0:30', isTrending: true },
  { id: 'edm1', title: 'NEON_DROP_BASS', artist: 'Glitch Machine', duration: '0:15', isTrending: false },
  { id: 'ambient1', title: 'VOID_AMBIENT_01', artist: 'DeepNode', duration: '1:30', isTrending: false },
];

export default function AudioInjector({ open, onClose, onSelectAudio, selectedAudio }) {
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const filtered = PRESET_TRACKS.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) || t.artist.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Audio files only'); return; }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const custom = {
      id: `custom-${Date.now()}`,
      title: file.name.replace(/\.[^.]+$/, '').toUpperCase().replace(/[_-]/g, ' '),
      artist: 'Custom Upload',
      duration: '—',
      url: file_url,
      isCustom: true,
    };
    onSelectAudio(custom);
    setUploading(false);
    toast.success('Audio injected!');
  };

  if (!open) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="w-full max-w-sm bg-[#050505] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[500px]">

      <div className="p-4 border-b border-white/5 bg-[#0a0a0a]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-white uppercase italic flex items-center gap-2">
            <Radio size={16} className="text-purple-500" /> Audio Injection
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search frequencies..."
            className="w-full bg-[#111] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-purple-500 outline-none transition-colors" />
        </div>
      </div>

      {selectedAudio && (
        <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music size={12} className="text-purple-400" />
            <span className="text-[10px] font-bold text-purple-300 truncate">{selectedAudio.title}</span>
          </div>
          <button onClick={() => onSelectAudio(null)} className="text-purple-400 hover:text-white text-[10px] font-bold">REMOVE</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Upload option */}
        <button onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 p-3 border border-dashed border-white/10 hover:border-purple-500/50 rounded-xl transition-colors group">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20">
            <Upload size={16} />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-white">Upload Custom Audio</div>
            <div className="text-[10px] text-gray-500">{uploading ? 'Uploading...' : 'MP3, WAV, OGG'}</div>
          </div>
        </button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />

        {filtered.map((track) => (
          <div key={track.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl group transition-colors">
            <div className="flex items-center gap-3">
              <button onClick={() => setPlayingId(playingId === track.id ? null : track.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${playingId === track.id ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-[#111] text-gray-400 group-hover:text-white border border-white/5'}`}>
                {playingId === track.id ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
              </button>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  {track.title}
                  {track.isTrending && <span className="text-[8px] bg-red-500/20 text-red-500 px-1 rounded uppercase">Hot</span>}
                </div>
                <div className="text-[10px] text-gray-500">{track.artist} • {track.duration}</div>
              </div>
            </div>
            <button onClick={() => { onSelectAudio(track); toast.success('Audio selected!'); }}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${selectedAudio?.id === track.id ? 'bg-purple-500 text-white' : 'opacity-0 group-hover:opacity-100 bg-white text-black hover:bg-purple-400'}`}>
              {selectedAudio?.id === track.id ? '✓' : 'Inject'}
            </button>
          </div>
        ))}
      </div>

      {playingId && (
        <div className="h-10 bg-purple-900/20 border-t border-purple-500/30 flex items-center justify-center gap-0.5 shrink-0">
          {[...Array(20)].map((_, i) => (
            <motion.div key={i} animate={{ height: ['20%', '100%', '20%'] }}
              transition={{ repeat: Infinity, duration: Math.random() * 0.5 + 0.5 }}
              className="w-1 bg-purple-500 rounded-full" />
          ))}
        </div>
      )}
    </motion.div>
  );
}