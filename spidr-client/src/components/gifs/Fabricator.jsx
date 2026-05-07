import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, X, Hash, Image } from 'lucide-react';
import { entities, auth, integrations } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { scanContent } from '@/components/spidr/ContentScanner';
import ContentBlockedModal from '@/components/spidr/ContentBlockedModal';

export default function Fabricator({ currentUser }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('gif');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [blockedCategory, setBlockedCategory] = useState(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const handleFile = (f) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    if (!name) {
      setName(f.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
    }
  };

  const addTag = () => {
    const clean = tagInput.replace(/^#/, '').trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags(prev => [...prev, clean]);
      setTagInput('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && (f.type.startsWith('image/') || f.type === 'image/gif')) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) {
      toast.error('Need a file and a name');
      return;
    }
    setPublishing(true);
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      const scan = await scanContent(url);
      if (!scan.safe) {
        setBlockedCategory(scan.category);
        setFile(null);
        setPreview(null);
        return;
      }
      await entities.CommunityAsset.create({
        name: name.trim(),
        type,
        url,
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username,
        author_avatar: currentUser?.avatar_url || '',
        likes: [],
        tags,
        is_public: isPublic,
      });
      queryClient.invalidateQueries({ queryKey: ['community-assets'] });
      toast.success('Signal transmitted to the Hive!');
      setFile(null);
      setPreview(null);
      setName('');
      setTags([]);
    } catch (err) {
      toast.error('Upload failed — ' + (err?.message || 'try again'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Drop zone */}
      <motion.div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !file && fileRef.current?.click()}
        whileHover={{ borderColor: 'rgba(255,51,51,0.5)' }}
        className={`relative border-2 border-dashed rounded-2xl overflow-hidden transition-all cursor-pointer ${
          file ? 'border-[#FF3333]/30 bg-[#FF3333]/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
        }`}
        style={{ minHeight: file ? 'auto' : '200px' }}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt="" className="w-full max-h-[300px] object-contain bg-black" />
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
              className="absolute top-3 right-3 w-8 h-8 bg-black/70 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
              <Upload size={22} className="text-zinc-500" />
            </div>
            <div className="text-sm font-bold text-white">Inject Signal</div>
            <div className="text-[10px] text-zinc-500">Drop a GIF, PNG, or WEBP — or click to browse</div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.gif"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = null; }}
        />
      </motion.div>

      {/* Name */}
      <div>
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">Signal Name</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">:</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            placeholder="cyber_hype"
            className="bg-[#0a0a0a] border-white/10 text-white pl-6 pr-6 font-mono text-sm"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">:</span>
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">Signal Type</label>
        <div className="flex gap-2">
          {['gif', 'emoji', 'sticker'].map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                type === t
                  ? 'bg-[#FF3333]/20 text-[#FF3333] border-[#FF3333]/40'
                  : 'bg-white/5 text-zinc-500 border-white/5 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] mb-1.5 block">Tags</label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="#reaction"
            className="bg-[#0a0a0a] border-white/10 text-white text-sm flex-1"
          />
          <button onClick={addTag} className="px-3 bg-white/10 border border-white/10 rounded-lg text-white hover:bg-white/20 transition-colors">
            <Hash size={14} />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] text-zinc-400 font-mono">
                #{tag}
                <button onClick={() => setTags(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-white">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Public toggle + Submit */}
      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-[#FF3333] w-3.5 h-3.5" />
          <span className="text-[10px] text-zinc-400 font-bold">Publicly visible in Hive</span>
        </label>
        <button
          onClick={handleSubmit}
          disabled={publishing || !file || !name.trim()}
          className="px-6 py-2.5 bg-[#FF3333] hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,51,51,0.2)]"
        >
          {publishing ? <><Loader2 size={12} className="animate-spin" /> TRANSMITTING...</> : 'TRANSMIT'}
        </button>
      </div>

      <ContentBlockedModal
        open={!!blockedCategory}
        onClose={() => setBlockedCategory(null)}
        category={blockedCategory}
      />
    </div>
  );
}
