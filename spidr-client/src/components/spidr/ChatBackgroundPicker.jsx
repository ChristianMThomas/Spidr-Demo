import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, Ban } from 'lucide-react';
import { integrations } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * ChatBackgroundPicker — choose a wallpaper for a DM or group chat.
 *
 * Deliberately supports both an upload and a small set of built-in gradients.
 * The gradients are CSS gradient strings rendered as data-URI SVGs, so they
 * cost zero network requests and can never 404 the way a hosted image can —
 * and they're on-brand rather than generic stock photos.
 *
 * Calls onSelect(url) with the chosen value, or onSelect('') to clear.
 */

// Brand-adjacent gradients, encoded inline so they need no hosting.
const PRESETS = [
  { id: 'symbiote', label: 'Symbiote',  stops: ['#1a0505', '#3b0a0a', '#050505'] },
  { id: 'venom',    label: 'Venom',     stops: ['#0a0118', '#2d0a3b', '#050505'] },
  { id: 'ember',    label: 'Ember',     stops: ['#1a0a02', '#4a1c05', '#0a0505'] },
  { id: 'abyss',    label: 'Abyss',     stops: ['#02060f', '#0a1a2e', '#050505'] },
  { id: 'moss',     label: 'Moss',      stops: ['#04120a', '#0f3220', '#050505'] },
  { id: 'ash',      label: 'Ash',       stops: ['#0e0e10', '#1e1e22', '#050505'] },
];

function presetUrl(stops) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${stops[0]}"/>
      <stop offset="55%" stop-color="${stops[1]}"/>
      <stop offset="100%" stop-color="${stops[2]}"/>
    </linearGradient></defs>
    <rect width="800" height="1200" fill="url(#g)"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export default function ChatBackgroundPicker({ current, onSelect, onClose, title = 'Chat Background' }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file');
      return;
    }
    setUploading(true);
    try {
      const res = await integrations.Core.UploadFile({ file });
      const url = res?.file_url || res?.url;
      if (!url) throw new Error('Upload returned no URL');
      onSelect(url);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,10,10,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const url = presetUrl(p.stops);
              const isActive = current === url;
              return (
                <button
                  key={p.id}
                  onClick={() => { onSelect(url); onClose?.(); }}
                  className={`group relative h-20 rounded-xl overflow-hidden border transition-all ${
                    isActive ? 'border-red-500 ring-2 ring-red-500/40' : 'border-white/10 hover:border-white/30'
                  }`}
                  style={{ backgroundImage: `url(${url})`, backgroundSize: 'cover' }}
                  title={p.label}
                >
                  <span className="absolute bottom-1 left-0 right-0 text-[9px] font-black uppercase tracking-widest text-white/70">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            <button
              onClick={() => { onSelect(''); onClose?.(); }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/40 text-white/60 hover:text-red-300 text-xs font-bold uppercase tracking-widest transition-colors"
              title="Remove background"
            >
              <Ban size={13} />
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </motion.div>
    </div>
  );
}
