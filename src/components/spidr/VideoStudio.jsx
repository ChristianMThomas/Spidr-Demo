import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, Scissors, Crop, Play, Type,
  Volume2, VolumeX, Hash, Sparkles, Loader2, RotateCcw, Camera, Image, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { scanContent } from './ContentScanner';
import ContentBlockedModal from './ContentBlockedModal';
import AudioDatabase from '../feed/AudioDatabase';

// --- FILTERS ---
const INJECTIONS = [
  { id: 'none',   label: 'RAW',   color: '#666',    style: {} },
  { id: 'venom',  label: 'TOXIN', color: '#10B981', style: { filter: 'hue-rotate(90deg) contrast(1.2) saturate(1.5)' } },
  { id: 'glitch', label: 'ERROR', color: '#FF3333', style: { filter: 'contrast(1.6) saturate(2) hue-rotate(15deg)' } },
  { id: 'noir',   label: 'VOID',  color: '#fff',    style: { filter: 'grayscale(1) contrast(1.3) brightness(0.85)' } },
  { id: 'neon',   label: 'CYBER', color: '#8B5CF6', style: { filter: 'hue-rotate(280deg) saturate(1.6) contrast(1.1)' } },
  { id: 'heat',   label: 'HEAT',  color: '#F97316', style: { filter: 'sepia(0.6) saturate(2) hue-rotate(-20deg) contrast(1.2)' } },
  { id: 'ice',    label: 'ICE',   color: '#22D3EE', style: { filter: 'hue-rotate(180deg) saturate(0.8) brightness(1.1) contrast(1.1)' } },
];

const RATIOS = [
  { id: '9:16', label: 'FULL',  css: '9/16' },
  { id: '1:1',  label: 'BOX',   css: '1/1' },
  { id: '16:9', label: 'WIDE',  css: '16/9' },
  { id: '4:5',  label: 'PORT',  css: '4/5' },
];

function getFilterStyle(filterId) {
  return INJECTIONS.find(f => f.id === filterId)?.style || {};
}

export default function VideoStudio({ open, onClose, videoFile, onPublish, currentUser, initialClip }) {
  const [step, setStep] = useState('loom'); // 'loom' | 'deploy'
  const [filter, setFilter] = useState('none');
  const [holdFilter, setHoldFilter] = useState(null); // for hold-to-preview
  const [ratio, setRatio] = useState('9:16');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [textOverlay, setTextOverlay] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [showAudioInjector, setShowAudioInjector] = useState(false);

  // Deploy step state
  const [caption, setCaption] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [suggestedHashtags, setSuggestedHashtags] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);
  const [blockedCategory, setBlockedCategory] = useState(null);

  const videoRef = useRef(null);
  const ratioRef = useRef('9:16');
  const prevFileRef = useRef(null);
  const thumbFileInputRef = useRef(null);

  const setRatioAndRef = (val) => { ratioRef.current = val; setRatio(val); };
  const activeFilter = holdFilter || filter;
  const currentRatio = RATIOS.find(r => r.id === ratio);

  // Reset on new file
  useEffect(() => {
    if (videoFile && videoFile !== prevFileRef.current) {
      prevFileRef.current = videoFile;
      setStep('loom'); setFilter('none'); setRatioAndRef('9:16');
      setActiveTool(null); setCaption(''); setHashtags([]);
      setHashtagInput(''); setSuggestedHashtags([]);
      setTrimStart(0); setTrimEnd(100); setIsPlaying(true);
      setThumbnails([]); setSelectedThumbIndex(0); setTextOverlay('');
    }
  }, [videoFile]);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (initialClip?.video_url) {
      setVideoUrl(initialClip.video_url);
      setFilter(initialClip.style?.filter || 'none');
      setRatioAndRef(initialClip.aspect_ratio || '9:16');
      setCaption(initialClip.caption || '');
      setHashtags(initialClip.hashtags || []);
      setThumbnails(initialClip.thumbnail_url ? [{ time: 0, dataUrl: initialClip.thumbnail_url }] : []);
    }
  }, [videoFile, initialClip]);

  // Sync time
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => setCurrentTime((vid.currentTime / vid.duration) * 100 || 0);
    const onMeta = () => { setDuration(vid.duration); setTrimEnd(100); };
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('loadedmetadata', onMeta);
    return () => { vid.removeEventListener('timeupdate', onTime); vid.removeEventListener('loadedmetadata', onMeta); };
  }, [videoUrl]);

  // Enforce trim
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    const startSec = (trimStart / 100) * duration;
    const endSec = (trimEnd / 100) * duration;
    if (vid.currentTime < startSec) vid.currentTime = startSec;
    if (vid.currentTime >= endSec) vid.currentTime = startSec;
  }, [currentTime, trimStart, trimEnd, duration]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) { vid.pause(); } else {
      const startSec = (trimStart / 100) * duration;
      if (vid.currentTime < startSec || vid.currentTime >= (trimEnd / 100) * duration) vid.currentTime = startSec;
      vid.play();
    }
    setIsPlaying(!isPlaying);
  };

  const captureFrame = (seekTime) => {
    return new Promise((resolve) => {
      const vid = videoRef.current;
      if (!vid) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 640;
      canvas.height = vid.videoHeight || 360;
      const doCapture = () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        resolve({ time: vid.currentTime, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
      };
      if (seekTime !== undefined) {
        const onSeeked = () => { vid.removeEventListener('seeked', onSeeked); doCapture(); };
        vid.addEventListener('seeked', onSeeked);
        vid.currentTime = seekTime;
      } else { doCapture(); }
    });
  };

  const generateThumbnails = async () => {
    const vid = videoRef.current;
    if (!vid || !duration) { toast.error('Video not loaded yet'); return; }
    const savedTime = vid.currentTime;
    const frames = [];
    for (let i = 0; i < 5; i++) {
      const seekTo = (duration / 6) * (i + 1);
      const frame = await captureFrame(seekTo);
      if (frame) frames.push(frame);
    }
    vid.currentTime = savedTime;
    setThumbnails(frames); setSelectedThumbIndex(0);
    toast.success('5 frames captured');
  };

  const cycleRatio = () => {
    const idx = RATIOS.findIndex(r => r.id === ratio);
    const next = RATIOS[(idx + 1) % RATIOS.length];
    setRatioAndRef(next.id);
  };

  const addHashtag = (tag) => {
    const clean = tag.replace(/^#/, '').trim();
    if (clean && !hashtags.includes(clean)) { setHashtags(prev => [...prev, clean]); setHashtagInput(''); }
  };

  const generateSuggestions = async () => {
    if (!caption.trim()) return;
    setLoadingSuggestions(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Based on this video caption: "${caption}", suggest 6 trending hashtags. Return JSON with a hashtags array of strings (no # symbol).`,
      response_json_schema: { type: 'object', properties: { hashtags: { type: 'array', items: { type: 'string' } } } }
    });
    setSuggestedHashtags(result.hashtags || []);
    setLoadingSuggestions(false);
  };

  const handlePublish = async () => {
    if (!caption.trim()) { toast.error('Add a caption first'); return; }
    const finalRatio = ratioRef.current;
    setPublishing(true);

    let uploadedVideoUrl = initialClip?.video_url || '';
    if (videoFile) {
      const uploadResult = await base44.integrations.Core.UploadFile({ file: videoFile });
      if (!uploadResult?.file_url) { toast.error('Upload failed'); setPublishing(false); return; }
      uploadedVideoUrl = uploadResult.file_url;

      // Content scan - skip if no thumbnail captured, don't block on scan errors
      const selectedThumbForScan = thumbnails[selectedThumbIndex];
      if (selectedThumbForScan?.dataUrl) {
        try {
          const scanBlob = await fetch(selectedThumbForScan.dataUrl).then(r => r.blob());
          const scanFile = new File([scanBlob], 'scan.jpg', { type: 'image/jpeg' });
          const scanUpload = await base44.integrations.Core.UploadFile({ file: scanFile });
          if (scanUpload?.file_url) {
            const scan = await scanContent(scanUpload.file_url);
            if (scan && !scan.safe) {
              setBlockedCategory(scan.category);
              setPublishing(false);
              return;
            }
          }
        } catch (scanErr) {
          console.warn('Content scan skipped:', scanErr);
          // Don't block publishing if scan fails
        }
      }
    }

    let thumbnailUploadUrl = '';
    const selectedThumb = thumbnails[selectedThumbIndex];
    if (selectedThumb?.dataUrl) {
      try {
        const blob = await fetch(selectedThumb.dataUrl).then(r => r.blob());
        const thumbFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
        const thumbResult = await base44.integrations.Core.UploadFile({ file: thumbFile });
        thumbnailUploadUrl = thumbResult?.file_url || '';
      } catch (thumbErr) {
        console.warn('Thumbnail upload skipped:', thumbErr);
      }
    }

    // If an audio track was selected, increment its use_count
    if (selectedAudio?.id && !initialClip) {
      try {
        await base44.entities.AudioTrack.update(selectedAudio.id, {
          use_count: (selectedAudio.use_count || 0) + 1
        });
      } catch (e) {
        console.warn('Audio count update skipped:', e);
      }
    }

    await onPublish({
      video_url: uploadedVideoUrl,
      thumbnail_url: thumbnailUploadUrl || initialClip?.thumbnail_url || '',
      caption: caption.trim(),
      hashtags,
      author_id: initialClip?.author_id || currentUser?.id,
      author_name: initialClip?.author_name || currentUser?.full_name || currentUser?.email,
      author_avatar: initialClip?.author_avatar || currentUser?.avatar_url || '',
      duration: duration ? Math.round((trimEnd - trimStart) / 100 * duration) : initialClip?.duration || 0,
      aspect_ratio: finalRatio,
      style: { ratio: finalRatio, filter },
      likes: initialClip?.likes || [],
      comments_count: initialClip?.comments_count || 0,
      shares_count: initialClip?.shares_count || 0,
      views: initialClip?.views || 0,
      audio_id: selectedAudio?.id || initialClip?.audio_id || '',
    });
    toast.success('Strand deployed!');
    setPublishing(false);
    onClose();
  };

  if (!open || (!videoFile && !initialClip)) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col overflow-hidden">
      <ContentBlockedModal
        open={!!blockedCategory}
        onClose={() => setBlockedCategory(null)}
        category={blockedCategory}
      />

      {/* =================== STEP 1: THE LOOM =================== */}
      {step === 'loom' && (
        <>
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent">
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
            <div className="text-center">
              <div className="text-[10px] font-black italic tracking-tight text-white">SPIDR <span className="text-[#FF3333]">LOOM</span></div>
              <div className="text-[8px] font-mono text-zinc-600 tracking-widest">WEAVE_PROTOCOL</div>
            </div>
            <div className="w-10" />
          </div>

          {/* The Viewport */}
          <div className="flex-1 flex items-center justify-center bg-[#050505] relative overflow-hidden">
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black"
              style={{ aspectRatio: currentRatio.css, maxWidth: '90vw', maxHeight: 'calc(100vh - 200px)', width: ratio === '16:9' ? '80%' : ratio === '1:1' ? '55%' : '45%' }}
            >
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-cover cursor-pointer"
                style={getFilterStyle(activeFilter)}
                loop muted={isMuted} playsInline autoPlay
                onClick={togglePlay}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Play overlay */}
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                      <Play size={28} fill="white" className="text-white ml-1" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Filter badge */}
              {activeFilter !== 'none' && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 backdrop-blur rounded-full text-[9px] font-black text-[#FF3333] uppercase tracking-widest border border-[#FF3333]/30">
                  {INJECTIONS.find(f => f.id === activeFilter)?.label}
                </div>
              )}

              {/* Ratio badge */}
              <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur rounded-full text-[9px] font-bold text-white border border-white/10">
                {ratio}
              </div>

              {/* Text overlay */}
              {textOverlay && !isTyping && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] text-center pointer-events-none z-20 uppercase">
                  {textOverlay}
                </div>
              )}

              {/* Volume toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-20"
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </motion.div>

            {/* Typing overlay */}
            <AnimatePresence>
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-8">
                  <div className="relative w-full max-w-md">
                    <input
                      autoFocus
                      value={textOverlay}
                      onChange={(e) => setTextOverlay(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsTyping(false)}
                      placeholder="TYPE SIGNAL..."
                      className="bg-transparent text-center text-4xl font-black text-white placeholder-white/20 outline-none w-full uppercase"
                    />
                    <button onClick={() => setIsTyping(false)}
                      className="absolute -right-12 top-1/2 -translate-y-1/2 text-[#FF3333] hover:scale-110 transition-transform">
                      <Check size={28} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trim panel (inline) */}
          <AnimatePresence>
            {activeTool === 'trim' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-[#0a0a0a] border-t border-white/5">
                <TrimPanel duration={duration} trimStart={trimStart} trimEnd={trimEnd} currentTime={currentTime}
                  onTrimStartChange={setTrimStart} onTrimEndChange={setTrimEnd} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ===== CONTROL DOCK ===== */}
          <div className="bg-[#0a0a0a] border-t border-white/5 px-4 py-3 flex-shrink-0">
            <div className="max-w-xl mx-auto flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                {/* Tools (left) */}
                <div className="flex items-center gap-3">
                  <LoomBtn icon={Type} label="Signal" active={isTyping} onClick={() => setIsTyping(true)} />
                  <LoomBtn icon={Scissors} label="Splice" active={activeTool === 'trim'} onClick={() => setActiveTool(activeTool === 'trim' ? null : 'trim')} />
                  <LoomBtn icon={Crop} label={currentRatio.label} active={false} onClick={cycleRatio} accent />
                  <LoomBtn icon={Volume2} label={selectedAudio ? 'Audio ✓' : 'Audio'} active={showAudioInjector} onClick={() => setShowAudioInjector(!showAudioInjector)} />
                  <LoomBtn icon={RotateCcw} label="Reset" active={false}
                    onClick={() => { setFilter('none'); setTrimStart(0); setTrimEnd(100); setRatioAndRef('9:16'); setActiveTool(null); setTextOverlay(''); setSelectedAudio(null); toast('Reset to raw'); }} />
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-white/10" />

                {/* Injection nodes (right) — hold to preview, click to set */}
                <div className="flex items-center gap-2">
                  {INJECTIONS.map((fx) => (
                    <button
                      key={fx.id}
                      onClick={() => setFilter(fx.id)}
                      onMouseDown={() => setHoldFilter(fx.id)}
                      onMouseUp={() => setHoldFilter(null)}
                      onMouseLeave={() => setHoldFilter(null)}
                      onTouchStart={() => setHoldFilter(fx.id)}
                      onTouchEnd={() => setHoldFilter(null)}
                      className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-100 group
                        ${filter === fx.id ? 'ring-2 ring-[#FF3333] bg-[#FF3333]/20 scale-110' : 'bg-white/5 border border-white/10 hover:border-white/30'}
                        ${holdFilter === fx.id ? 'scale-90 brightness-125' : ''}
                      `}
                      title={`${fx.label} — hold to preview, click to set`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fx.color, boxShadow: filter === fx.id ? `0 0 10px ${fx.color}` : 'none' }} />
                      <span className="absolute -top-7 text-[7px] font-black bg-black/90 px-1.5 py-0.5 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {fx.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Database Modal */}
              <AudioDatabase
                open={showAudioInjector}
                onClose={() => setShowAudioInjector(false)}
                currentUser={currentUser}
                onSelectAudio={(a) => { setSelectedAudio(a); setShowAudioInjector(false); }}
              />

              {/* Selected audio badge */}
              {selectedAudio && !showAudioInjector && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded-xl">
                  <Volume2 size={12} className="text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-300 truncate flex-1">{selectedAudio.title}</span>
                  <button onClick={() => setSelectedAudio(null)} className="text-purple-400 hover:text-white text-xs">✕</button>
                </div>
              )}

              {/* NEXT Button */}
              <button
                onClick={() => setStep('deploy')}
                className="group relative w-full py-3 bg-[#FF3333] rounded-xl text-white font-black text-xs tracking-widest flex items-center justify-center gap-2 overflow-hidden hover:bg-red-600 transition-colors"
              >
                <span className="relative z-10 flex items-center gap-1.5">NEXT <ArrowRight size={14} /></span>
                <div className="absolute inset-0 rounded-xl shadow-[0_0_25px_#FF3333] opacity-30 animate-pulse" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* =================== STEP 2: DEPLOY =================== */}
      {step === 'deploy' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 bg-black/90 backdrop-blur-sm flex-shrink-0">
            <button onClick={() => setStep('loom')} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full transition-colors">
              <ArrowRight size={13} className="rotate-180" /> BACK
            </button>
            <div className="text-center">
              <div className="text-[10px] font-black italic tracking-tight text-white">SPIDR <span className="text-[#FF3333]">LOOM</span></div>
              <div className="text-[8px] font-mono text-zinc-600 tracking-widest">DEPLOY_PROTOCOL</div>
            </div>
            <div className="w-16" />
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Preview strip */}
            <div className="w-[130px] bg-[#050505] flex-shrink-0 flex flex-col items-center justify-center gap-3 border-r border-white/5 p-3">
              <div className="relative overflow-hidden rounded-xl border border-white/10 w-full" style={{ aspectRatio: currentRatio.css }}>
                <video src={videoUrl} className="w-full h-full object-cover" style={getFilterStyle(filter)} muted playsInline autoPlay loop />
                {textOverlay && (
                  <div className="absolute inset-0 flex items-center justify-center text-white font-black text-[10px] uppercase drop-shadow pointer-events-none">
                    {textOverlay}
                  </div>
                )}
              </div>
              <div className="px-2 py-1 rounded-full bg-[#FF3333]/20 border border-[#FF3333]/40 text-[9px] font-black text-[#FF3333] uppercase">{ratio}</div>
              {filter !== 'none' && (
                <div className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-zinc-400 uppercase">{filter}</div>
              )}
            </div>

            {/* Details form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-24">
              {/* Caption */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Caption</label>
                <Textarea value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe your strand..." className="bg-zinc-900 border-zinc-700 text-white resize-none h-24 text-sm" maxLength={500} />
                <div className="flex justify-between mt-1">
                  <span className="text-zinc-600 text-[10px]">{caption.length}/500</span>
                  <button onClick={generateSuggestions} disabled={!caption.trim() || loadingSuggestions}
                    className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 transition-colors">
                    {loadingSuggestions ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} AI Hashtags
                  </button>
                </div>
              </div>

              {/* Hashtags */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Hashtags</label>
                <div className="flex gap-2">
                  <Input value={hashtagInput} onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addHashtag(hashtagInput)}
                    placeholder="#tag" className="bg-zinc-900 border-zinc-700 text-white text-sm flex-1" />
                  <Button onClick={() => addHashtag(hashtagInput)} className="bg-[#FF3333] hover:bg-red-700 px-3"><Hash size={14} /></Button>
                </div>
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {hashtags.map((tag, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 bg-[#FF3333]/15 text-[#FF3333] border border-[#FF3333]/30 rounded-full text-xs font-medium">
                        #{tag}
                        <button onClick={() => setHashtags(prev => prev.filter((_, idx) => idx !== i))} className="text-[#FF3333]/60 hover:text-[#FF3333]">×</button>
                      </span>
                    ))}
                  </div>
                )}
                {suggestedHashtags.length > 0 && (
                  <div className="mt-3 p-3 bg-purple-950/30 border border-purple-800/30 rounded-xl">
                    <div className="flex items-center gap-1 mb-2">
                      <Sparkles size={10} className="text-purple-400" />
                      <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">AI Suggestions</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestedHashtags.map((tag, i) => (
                        <button key={i} onClick={() => addHashtag(tag)}
                          className="px-2 py-1 bg-purple-900/40 text-purple-300 border border-purple-700/30 rounded-full text-xs hover:bg-purple-800/40 transition-colors">
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnail */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Cover Frame</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button onClick={async () => { const f = await captureFrame(); if (f) { setThumbnails(p => [f,...p]); setSelectedThumbIndex(0); toast.success('Frame captured'); }}}
                    className="flex-1 min-w-[120px] py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1">
                    <Camera size={12} /> Current
                  </button>
                  <button onClick={generateThumbnails}
                    className="flex-1 min-w-[120px] py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1">
                    <Image size={12} /> Auto 5
                  </button>
                  <button onClick={() => thumbFileInputRef.current?.click()}
                    className="flex-1 min-w-[120px] py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1">
                    <Image size={12} /> Upload
                  </button>
                  <input ref={thumbFileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setThumbnails(p => [{ time: 0, dataUrl: reader.result }, ...p]); setSelectedThumbIndex(0); toast.success('Custom thumbnail added'); }; reader.readAsDataURL(file); e.target.value = null; }} />
                </div>
                {thumbnails.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {thumbnails.map((thumb, i) => (
                      <button key={i} onClick={() => setSelectedThumbIndex(i)}
                        className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-all ${i === selectedThumbIndex ? 'border-[#FF3333] scale-105' : 'border-zinc-700 opacity-60 hover:opacity-100'}`}
                        style={{ width: 64, height: 64 }}>
                        <img src={thumb.dataUrl} alt="" className="w-full h-full object-cover" />
                        {i === selectedThumbIndex && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#FF3333]/20">
                            <div className="w-5 h-5 rounded-full bg-[#FF3333] flex items-center justify-center">
                              <span className="text-white text-[8px] font-black">✓</span>
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-16 border border-dashed border-zinc-700 rounded-xl text-zinc-600 text-xs">
                    No thumbnail yet — capture or generate
                  </div>
                )}
              </div>

              {/* Config summary */}
              <div className="p-3 bg-zinc-900/50 border border-white/5 rounded-xl space-y-2">
                <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Strand Config</div>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Ratio</span><span className="text-[#FF3333] font-black">{ratio}</span></div>
                <div className="flex justify-between text-xs"><span className="text-zinc-500">Filter</span><span className="text-white font-bold capitalize">{filter}</span></div>
                {textOverlay && <div className="flex justify-between text-xs"><span className="text-zinc-500">Text</span><span className="text-white font-bold">{textOverlay}</span></div>}
                {duration > 0 && <div className="flex justify-between text-xs"><span className="text-zinc-500">Duration</span><span className="text-white font-bold">{Math.round((trimEnd - trimStart) / 100 * duration)}s</span></div>}
              </div>
            </div>

            {/* Fixed deploy bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur border-t border-white/5">
              <button onClick={handlePublish} disabled={publishing || !caption.trim()}
                className="w-full py-4 bg-[#FF3333] hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-[0_0_24px_rgba(255,51,51,0.35)] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider">
                {publishing ? <><Loader2 size={16} className="animate-spin" /> Rendering Strand...</> : <><ArrowRight size={16} /> Deploy Strand</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- SUB COMPONENTS ---

function LoomBtn({ icon: Icon, label, active, onClick, accent }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 transition-all ${active ? 'text-[#FF3333] scale-110' : accent ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
        ${active ? 'bg-[#FF3333]/20 border border-[#FF3333]/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
        <Icon size={18} />
      </div>
      <span className={`text-[7px] font-black uppercase tracking-wider ${accent ? 'text-[#FF3333]' : ''}`}>{label}</span>
    </button>
  );
}

function TrimPanel({ duration, trimStart, trimEnd, currentTime, onTrimStartChange, onTrimEndChange }) {
  const fmt = (pct) => {
    if (!duration) return '0s';
    const s = Math.round((pct / 100) * duration);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
  };
  return (
    <div className="px-5 py-4 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Time Splicer</span>
        <div className="flex gap-3 text-[9px] text-zinc-400 font-mono">
          <span className="text-[#FF3333]">▶ {fmt(trimStart)}</span>
          <span>⏹ {fmt(trimEnd)}</span>
          {duration > 0 && <span className="text-zinc-600">{Math.round((trimEnd - trimStart) / 100 * duration)}s</span>}
        </div>
      </div>
      <div className="relative w-full h-12 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 select-none">
        <div className="absolute inset-0 flex items-center gap-px px-1 opacity-30">
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} className="flex-1 bg-[#FF3333] rounded-full" style={{ height: `${20 + Math.sin(i * 0.4) * 30 + (i % 3) * 10}%` }} />
          ))}
        </div>
        <div className="absolute top-0 bottom-0 bg-[#FF3333]/20 border-x-2 border-[#FF3333]" style={{ left: `${trimStart}%`, width: `${trimEnd - trimStart}%` }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/60" style={{ left: `${currentTime}%` }} />
      </div>
      <div className="flex gap-3 mt-3">
        <div className="flex-1">
          <div className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">Start</div>
          <input type="range" min={0} max={trimEnd - 1} value={trimStart} onChange={(e) => onTrimStartChange(+e.target.value)} className="w-full accent-red-500 cursor-pointer" />
        </div>
        <div className="flex-1">
          <div className="text-[8px] text-zinc-600 mb-1 uppercase tracking-widest">End</div>
          <input type="range" min={trimStart + 1} max={100} value={trimEnd} onChange={(e) => onTrimEndChange(+e.target.value)} className="w-full accent-red-500 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}