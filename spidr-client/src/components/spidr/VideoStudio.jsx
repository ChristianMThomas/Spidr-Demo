import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, Scissors, Zap, Play, Type,
  Volume2, VolumeX, Hash, Sparkles, Loader2, RotateCcw,
  Camera, Image, Check, ArrowLeft, Music, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { entities, integrations } from '@/api/apiClient';
import { Textarea } from '@/components/ui/textarea';
import { scanContent } from './ContentScanner';
import ContentBlockedModal from './ContentBlockedModal';
import SpidrCropper from './SpidrCropper';
import { Crop, Move } from 'lucide-react';
import AudioDatabase from '../feed/AudioDatabase';
import VideoScrubber from './VideoScrubber';
import AudioUplinkInput from './AudioUplinkInput';

// ── Visual filters ────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'none',      label: 'RAW',       color: '#555',    css: {} },
  // Patch 2.11 — Spidr-named signature filters (The Weaver).
  { id: 'dormant',   label: 'DORMANT',   color: '#9ca3af', css: { filter: 'grayscale(1) contrast(1.1) brightness(0.95)' } },
  { id: 'glitch',    label: 'GLITCH',    color: '#FF3333', css: { filter: 'contrast(1.6) saturate(2) hue-rotate(15deg)' } },
  { id: 'neon-tear', label: 'NEON TEAR', color: '#f43f5e', css: { filter: 'contrast(1.35) saturate(1.9) brightness(1.05)' } },
  { id: 'venom',    label: 'TOXIN',   color: '#10B981', css: { filter: 'hue-rotate(90deg) contrast(1.2) saturate(1.5)' } },
  { id: 'noir',     label: 'VOID',    color: '#fff',    css: { filter: 'grayscale(1) contrast(1.3) brightness(0.85)' } },
  { id: 'neon',     label: 'CYBER',   color: '#8B5CF6', css: { filter: 'hue-rotate(280deg) saturate(1.6) contrast(1.1)' } },
  { id: 'heat',     label: 'HEAT',    color: '#F97316', css: { filter: 'sepia(0.6) saturate(2) hue-rotate(-20deg) contrast(1.2)' } },
  { id: 'ice',      label: 'ICE',     color: '#22D3EE', css: { filter: 'hue-rotate(180deg) saturate(0.8) brightness(1.1) contrast(1.1)' } },
  { id: 'symbiote', label: 'SYMB',    color: '#7C3AED', css: { filter: 'grayscale(0.5) contrast(1.4) saturate(1.8) brightness(0.9)' } },
];

const RATIOS = [
  { id: '9:16', label: 'FULL',  css: '9/16' },
  { id: '1:1',  label: 'BOX',   css: '1/1'  },
  { id: '16:9', label: 'WIDE',  css: '16/9' },
  { id: '4:5',  label: 'PORT',  css: '4/5'  },
];

export default function VideoStudio({ open, onClose, videoFile, onPublish, currentUser, initialClip }) {
  const [step, setStep] = useState('loom');
  const [filter, setFilter] = useState('none');
  const [previewFilter, setPreviewFilter] = useState(null);
  const [ratio, setRatio] = useState('9:16');
  // Pro cropper (Part 6): pan/zoom + aspect-locked crop. cropData holds the
  // extracted croppedAreaPixels {x,y,width,height} in natural pixels.
  const [cropMode, setCropMode] = useState(false);
  const [cropXY, setCropXY] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropData, setCropData] = useState(initialClip?.crop_data || null);
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
  const [graftedAudio, setGraftedAudio] = useState(null);
  const [showAudioDB, setShowAudioDB] = useState(false);
  const [caption, setCaption] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [aiHashtags, setAiHashtags] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [selectedThumb, setSelectedThumb] = useState(0);
  const [blockedCategory, setBlockedCategory] = useState(null);
  const [scrubTime, setScrubTime] = useState(0);
  // Optional server to promote with this clip (Join Server CTA in the feed).
  const [myServers, setMyServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(initialClip?.server_id || '');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ratioRef = useRef('9:16');
  const thumbInputRef = useRef(null);

  const activeFilter = previewFilter || filter;
  const currentRatio = RATIOS.find(r => r.id === ratio);

  // Reset on new file
  useEffect(() => {
    if (!open) return;
    setStep('loom'); setFilter('none'); setRatio('9:16');
    setActiveTool(null); setCaption(''); setHashtags([]); setAiHashtags([]);
    setTrimStart(0); setTrimEnd(100); setIsPlaying(true);
    setThumbnails([]); setSelectedThumb(0); setTextOverlay('');
    setGraftedAudio(null);
    setSelectedAudio(null);
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (initialClip?.video_url) {
      setVideoUrl(initialClip.video_url);
      setFilter(initialClip.style?.filter || 'none');
      setRatio(initialClip.aspect_ratio || '9:16');
      ratioRef.current = initialClip.aspect_ratio || '9:16';
      setCaption(initialClip.caption || '');
      setHashtags(initialClip.hashtags || []);
      if (initialClip.thumbnail_url) setThumbnails([{ time: 0, dataUrl: initialClip.thumbnail_url }]);
    }
  }, [open, videoFile, initialClip]);

  // Load the servers the current user belongs to, for the optional
  // "promote a server" picker. Best-effort; failures just hide the picker.
  useEffect(() => {
    if (!open || !currentUser?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const servers = await entities.Server.list('-created_date', 100);
        const mine = (servers || []).filter(s =>
          s.owner_id === currentUser.id ||
          (Array.isArray(s.members) && s.members.some(m => (m.user_id || m) === currentUser.id))
        );
        if (!cancelled) setMyServers(mine);
      } catch { if (!cancelled) setMyServers([]); }
    })();
    return () => { cancelled = true; };
  }, [open, currentUser?.id]);

  // Video time tracking
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => setCurrentTime((vid.currentTime / (vid.duration || 1)) * 100 || 0);
    const onMeta = () => { setDuration(vid.duration); setTrimEnd(100); };
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('loadedmetadata', onMeta);
    return () => { vid.removeEventListener('timeupdate', onTime); vid.removeEventListener('loadedmetadata', onMeta); };
  }, [videoUrl]);

  // Enforce trim bounds
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    const s = (trimStart / 100) * duration, e = (trimEnd / 100) * duration;
    if (vid.currentTime < s) vid.currentTime = s;
    if (vid.currentTime >= e) vid.currentTime = s;
  }, [currentTime, trimStart, trimEnd, duration]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) vid.pause(); else { const s = (trimStart / 100) * duration; if (vid.currentTime < s || vid.currentTime >= (trimEnd / 100) * duration) vid.currentTime = s; vid.play(); }
    setIsPlaying(!isPlaying);
  };

  const captureFrame = (seekTo) => new Promise((resolve) => {
    const vid = videoRef.current;
    if (!vid) return resolve(null);
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = vid.videoWidth || 640; canvas.height = vid.videoHeight || 360;
    const doCapture = () => {
      const ctx = canvas.getContext('2d');
      const filt = FILTERS.find(f => f.id === activeFilter);
      ctx.filter = filt?.css?.filter || 'none';
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      resolve({ time: vid.currentTime, dataUrl: canvas.toDataURL('image/jpeg', 0.88) });
    };
    if (seekTo !== undefined) { const onSeeked = () => { vid.removeEventListener('seeked', onSeeked); doCapture(); }; vid.addEventListener('seeked', onSeeked); vid.currentTime = seekTo; }
    else doCapture();
  });

  const generateThumbs = async () => {
    const vid = videoRef.current;
    if (!vid) { toast.error('No video loaded'); return; }
    // Wait for video metadata if not ready
    if (!vid.duration || vid.readyState < 2) {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('Video load timeout')), 5000);
        vid.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, { once: true });
        vid.load();
      }).catch(() => { toast.error('Video not ready — try again in a moment'); return; });
      if (!vid.duration) return;
    }
    const dur = vid.duration;
    const saved = vid.currentTime;
    const frames = [];
    for (let i = 0; i < 6; i++) {
      const f = await captureFrame((dur / 7) * (i + 1));
      if (f) frames.push(f);
    }
    vid.currentTime = saved;
    setThumbnails(frames);
    setSelectedThumb(0);
    toast.success('6 frames captured — pick your cover!');
  };

  const cycleRatio = () => {
    const idx = RATIOS.findIndex(r => r.id === ratio);
    const next = RATIOS[(idx + 1) % RATIOS.length];
    setRatio(next.id); ratioRef.current = next.id;
  };

  const addHashtag = (tag) => {
    const clean = tag.replace(/^#/, '').trim();
    if (clean && !hashtags.includes(clean)) { setHashtags(p => [...p, clean]); setHashtagInput(''); }
  };

  const generateAIHashtags = async () => {
    if (!caption.trim()) { toast.error('Add a caption first'); return; }
    setLoadingAI(true);
    try {
      const result = await integrations.Core.InvokeLLM({
        prompt: `Generate 8 highly relevant trending hashtags for this social media video caption: "${caption}". Return JSON: { "hashtags": ["tag1","tag2",...] } — no # symbols, lowercase only.`,
        response_json_schema: { type: 'object', properties: { hashtags: { type: 'array', items: { type: 'string' } } } }
      });
      setAiHashtags(result?.hashtags || []);
    } catch { toast.error('AI suggestions failed'); }
    setLoadingAI(false);
  };

  const handlePublish = async () => {
    if (!caption.trim()) { toast.error('Add a caption first'); return; }
    setPublishing(true);
    const finalRatio = ratioRef.current;

    try {
      // Upload video
      let uploadedVideoUrl = initialClip?.video_url || '';
      if (videoFile) {
        const res = await integrations.Core.UploadFile({ file: videoFile });
        if (!res?.url) { toast.error('Video upload failed'); setPublishing(false); return; }
        uploadedVideoUrl = res.url;

        // Content scan (non-blocking failure)
        const thumb = thumbnails[selectedThumb];
        if (thumb?.dataUrl) {
          try {
            const blob = await fetch(thumb.dataUrl).then(r => r.blob());
            const scanFile = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
            const scanUp = await integrations.Core.UploadFile({ file: scanFile });
            if (scanUp?.url) {
              const scan = await scanContent(scanUp.url);
              if (scan && !scan.safe) { setBlockedCategory(scan.category); setPublishing(false); return; }
            }
          } catch { /* non-blocking */ }
        }
      }

      // Upload thumbnail
      let thumbUrl = '';
      const thumb = thumbnails[selectedThumb];
      if (thumb?.dataUrl) {
        try {
          const blob = await fetch(thumb.dataUrl).then(r => r.blob());
          const thumbFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          const thumbRes = await integrations.Core.UploadFile({ file: thumbFile });
          thumbUrl = thumbRes?.url || '';
        } catch { /* non-blocking */ }
      }

      // Increment audio use count
      if (selectedAudio?.id && !initialClip) {
        try { await entities.AudioTrack.update(selectedAudio.id, { use_count: (selectedAudio.use_count || 0) + 1 }); } catch {}
      }

      await onPublish({
        video_url:     uploadedVideoUrl,
        thumbnail_url: thumbUrl || initialClip?.thumbnail_url || '',
        caption:       caption.trim(),
        hashtags,
        author_id:     initialClip?.author_id || currentUser?.id,
        author_name:   initialClip?.author_name || currentUser?.full_name || currentUser?.username,
        author_avatar: initialClip?.author_avatar || currentUser?.avatar_url || '',
        duration:      duration ? Math.round((trimEnd - trimStart) / 100 * duration) : initialClip?.duration || 0,
        aspect_ratio:  finalRatio,
        crop_data:     cropData || null,
        style:         { ratio: finalRatio, filter },
        likes:         initialClip?.likes || [],
        comments_count: initialClip?.comments_count || 0,
        shares_count:  initialClip?.shares_count || 0,
        views:         initialClip?.views || 0,
        audio_id:      selectedAudio?.id || initialClip?.audio_id || '',
        grafted_audio: graftedAudio ? {
          provider:  graftedAudio.provider,
          title:     graftedAudio.title,
          author:    graftedAudio.author,
          thumbnail: graftedAudio.thumbnail,
          sourceUrl: graftedAudio.sourceUrl,
          previewUrl: graftedAudio.previewUrl || '',
        } : (initialClip?.grafted_audio || null),
        ...(selectedServerId ? (() => {
          const srv = myServers.find(s => s.id === selectedServerId);
          return {
            server_id:   selectedServerId,
            server_name: srv?.name || initialClip?.server_name || '',
            server_icon: srv?.icon_url || srv?.icon || initialClip?.server_icon || '',
          };
        })() : { server_id: '', server_name: '', server_icon: '' }),
      });
      toast.success('🕷️ Strand deployed to The Web!');
      setPublishing(false); onClose();
    } catch (err) {
      toast.error('Publish failed: ' + err.message);
      setPublishing(false);
    }
  };

  if (!open || (!videoFile && !initialClip)) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col overflow-hidden">
      <ContentBlockedModal open={!!blockedCategory} onClose={() => setBlockedCategory(null)} category={blockedCategory} />
      <canvas ref={canvasRef} className="hidden" />

      {/* ════ STEP 1: LOOM ════════════════════════════════════════════════════ */}
      {step === 'loom' && (
        <>
          {/* Header */}
          <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/95 to-transparent">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
              <X size={18} />
            </button>
            <div className="text-center">
              <p className="text-[11px] font-black italic text-white tracking-tight">SPIDR <span className="text-[#FF3333]">LOOM</span></p>
              <p className="text-[8px] font-mono text-zinc-500 tracking-widest">WEAVE_PROTOCOL</p>
            </div>
            <div className="w-9" />
          </div>

          {/* Video Viewport */}
          <div className="flex-1 flex items-center justify-center bg-[#050505] relative overflow-hidden">
            <motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black"
              style={{ aspectRatio: currentRatio.css, maxWidth: '92vw', maxHeight: 'calc(100vh - 210px)', width: ratio === '16:9' ? '80%' : ratio === '1:1' ? '55%' : '46%' }}>
              <video ref={videoRef} src={videoUrl}
                className="w-full h-full object-cover cursor-pointer"
                style={FILTERS.find(f => f.id === activeFilter)?.css || {}}
                loop muted={isMuted} playsInline autoPlay onClick={togglePlay}
              />
              {/* Pro cropper overlay (Part 6) — pan/zoom + aspect-locked crop
                  with dimmed surround and neon grid. Sits over the video while
                  in crop mode and reports croppedAreaPixels. */}
              {cropMode && (
                <div className="absolute inset-0 z-30">
                  <SpidrCropper
                    videoSrc={videoUrl}
                    aspect={ratio === '16:9' ? 16/9 : ratio === '1:1' ? 1 : ratio === '4:5' ? 4/5 : 9/16}
                    crop={cropXY}
                    zoom={cropZoom}
                    onCropChange={setCropXY}
                    onZoomChange={setCropZoom}
                    onCropComplete={(_area, px) => setCropData(px)}
                    gridColor="#3b82f6"
                  />
                </div>
              )}
              {/* Paused overlay */}
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                      <Play size={26} fill="white" className="text-white ml-1" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Badges */}
              {activeFilter !== 'none' && (
                <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/70 rounded-full text-[9px] font-black text-[#FF3333] uppercase tracking-widest border border-[#FF3333]/30">
                  {FILTERS.find(f => f.id === activeFilter)?.label}
                </div>
              )}
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/70 rounded-full text-[9px] font-bold text-white border border-white/10">{ratio}</div>
              {textOverlay && !isTyping && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] text-center pointer-events-none z-20 uppercase">{textOverlay}</div>
              )}
              <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-20">
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </motion.div>

            {/* Text input overlay */}
            <AnimatePresence>
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 z-60 flex items-center justify-center p-8">
                  <div className="relative w-full max-w-md">
                    <input autoFocus value={textOverlay} onChange={e => setTextOverlay(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && setIsTyping(false)}
                      placeholder="TYPE SIGNAL…"
                      className="bg-transparent text-center text-4xl font-black text-white placeholder-white/20 outline-none w-full uppercase" />
                    <button onClick={() => setIsTyping(false)} className="absolute -right-12 top-1/2 -translate-y-1/2 text-[#FF3333] hover:scale-110 transition-transform">
                      <Check size={28} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trim panel */}
          <AnimatePresence>
            {activeTool === 'trim' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-[#0a0a0a] border-t border-white/5 p-3">
                <VideoScrubber duration={duration} trimStart={trimStart} trimEnd={trimEnd} currentTime={currentTime}
                  thumbnails={thumbnails} apexColor="#FF3333"
                  onStart={setTrimStart} onEnd={setTrimEnd}
                  onSeek={(pct) => { const v = videoRef.current; if (v && duration) { v.currentTime = (pct / 100) * duration; } }} />

                {/* Synced grafted-audio track (Patch 2.12 Part 3) */}
                {graftedAudio && (
                  <div className="mt-2 flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg h-12 px-2 overflow-hidden">
                    {graftedAudio.thumbnail
                      ? <img src={graftedAudio.thumbnail} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded-md bg-zinc-800 shrink-0" />}
                    {/* synthetic waveform */}
                    <div className="flex items-center gap-[2px] flex-1 h-full overflow-hidden">
                      {Array.from({ length: 48 }).map((_, i) => (
                        <div key={i} className="flex-1 rounded-full" style={{ height: `${20 + Math.abs(Math.sin(i * 0.9)) * 60}%`, background: '#FF3333', opacity: 0.45, minWidth: 1 }} />
                      ))}
                    </div>
                    <div className="font-mono text-[9px] text-zinc-500 shrink-0 max-w-[40%] truncate">
                      &gt; {graftedAudio.title} // {String(graftedAudio.provider || '').replace('_', ' ')}_API
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Control Dock ── */}
          <div className="bg-[#0a0a0a] border-t border-white/5 px-4 py-3 flex-shrink-0">
            <div className="max-w-xl mx-auto space-y-3">
              {/* Tool row */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <ToolBtn icon={Type}     label="Text"   active={isTyping}              onClick={() => setIsTyping(true)} />
                  <ToolBtn icon={Scissors} label="Splice" active={activeTool === 'trim'} onClick={() => setActiveTool(activeTool === 'trim' ? null : 'trim')} />
                  <ToolBtn icon={Crop}     label="Crop"   active={cropMode} onClick={() => { setCropMode(!cropMode); if (!cropMode) { setCropXY({ x: 0, y: 0 }); setCropZoom(1); } }} accent />
                  <ToolBtn icon={Zap}      label={currentRatio.label} active={false} onClick={cycleRatio} accent />
                  <ToolBtn icon={Music}    label={selectedAudio ? 'Audio ✓' : 'Audio'} active={showAudioDB} onClick={() => setShowAudioDB(!showAudioDB)} />
                  <ToolBtn icon={RotateCcw} label="Reset" active={false}
                    onClick={() => { setFilter('none'); setTrimStart(0); setTrimEnd(100); setRatio('9:16'); ratioRef.current='9:16'; setActiveTool(null); setTextOverlay(''); setSelectedAudio(null); toast('Reset to raw'); }} />
                </div>
                <div className="w-px h-8 bg-white/10" />
                {/* Filter swatches */}
                <div className="flex items-center gap-1.5">
                  {FILTERS.map(fx => (
                    <button key={fx.id}
                      onClick={() => setFilter(fx.id)}
                      onMouseEnter={() => setPreviewFilter(fx.id)}
                      onMouseLeave={() => setPreviewFilter(null)}
                      title={`${fx.label} — hover to preview`}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all group relative
                        ${filter === fx.id ? 'ring-2 ring-[#FF3333] bg-[#FF3333]/20 scale-110' : 'bg-white/5 border border-white/10 hover:border-white/30'}`}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fx.color, boxShadow: filter === fx.id ? `0 0 8px ${fx.color}` : 'none' }} />
                      <span className="absolute -top-7 text-[7px] font-black bg-black/90 px-1.5 py-0.5 rounded text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">{fx.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Crop mode: aspect-ratio suite (Part 6) + zoom. The 9:16
                  "Phone/Web" option is the FYP default. */}
              {cropMode && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {[
                    { id: '9:16', label: 'Phone/Web' },
                    { id: '16:9', label: 'Desktop/Landscape' },
                    { id: '1:1',  label: 'Square/Profile' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setRatio(opt.id); ratioRef.current = opt.id; setCropXY({ x: 0, y: 0 }); setCropZoom(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        ratio === opt.id ? 'bg-blue-500/20 border-blue-500/60 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {opt.id} · {opt.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-auto">
                    <Move size={13} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Zoom</span>
                    <input
                      type="range" min="1" max="3" step="0.01" value={cropZoom}
                      onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                      className="w-28 accent-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Audio badge */}
              {selectedAudio && !showAudioDB && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded-xl">
                  <Music size={11} className="text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-300 truncate flex-1">{selectedAudio.title}</span>
                  <button onClick={() => setSelectedAudio(null)} className="text-purple-400 hover:text-white text-xs">✕</button>
                </div>
              )}

              {/* NEXT button */}
              <button onClick={() => setStep('deploy')}
                className="w-full py-3 bg-[#FF3333] rounded-xl text-white font-black text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(255,51,51,0.3)]">
                NEXT <ArrowRight size={14} />
              </button>
            </div>

            <AudioDatabase open={showAudioDB} onClose={() => setShowAudioDB(false)} currentUser={currentUser}
              onSelectAudio={a => { setSelectedAudio(a); setShowAudioDB(false); }} />
          </div>
        </>
      )}

      {/* ════ STEP 2: DEPLOY ══════════════════════════════════════════════════ */}
      {step === 'deploy' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-13 border-b border-white/5 bg-black/90 backdrop-blur flex-shrink-0 py-3">
            <button onClick={() => setStep('loom')} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full transition-colors">
              <ArrowLeft size={13} className="rotate-180" /> BACK
            </button>
            <div className="text-center">
              <p className="text-[11px] font-black italic text-white">SPIDR <span className="text-[#FF3333]">LOOM</span></p>
              <p className="text-[8px] font-mono text-zinc-500 tracking-widest">DEPLOY_PROTOCOL</p>
            </div>
            <div className="w-16" />
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Preview strip */}
            <div className="w-[120px] bg-[#050505] flex-shrink-0 flex flex-col items-center justify-start gap-3 border-r border-white/5 p-3 pt-4">
              <div className="relative overflow-hidden rounded-xl border border-white/10 w-full" style={{ aspectRatio: currentRatio.css }}>
                <video src={videoUrl} className="w-full h-full object-cover" style={FILTERS.find(f => f.id === filter)?.css || {}} muted playsInline autoPlay loop />
                {textOverlay && (
                  <div className="absolute inset-0 flex items-center justify-center text-white font-black text-[9px] uppercase drop-shadow pointer-events-none">{textOverlay}</div>
                )}
              </div>
              <div className="px-2 py-0.5 rounded-full bg-[#FF3333]/20 border border-[#FF3333]/40 text-[8px] font-black text-[#FF3333] uppercase">{ratio}</div>
              {filter !== 'none' && <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] font-bold text-zinc-400 uppercase">{filter}</div>}
            </div>

            {/* Details form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-24">
              {/* Caption — terminal/command-line styled (Patch 2.11) */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">&gt; INJECT_DATA</label>
                <div className="bg-black/70 border border-[#FF3333]/30 rounded-lg p-3 font-mono focus-within:border-[#FF3333]/60 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-[#FF3333] text-sm select-none mt-0.5">&gt;</span>
                    <Textarea value={caption} onChange={e => setCaption(e.target.value)}
                      placeholder="INJECT_DATA: _" className="bg-transparent border-0 text-green-300 resize-none h-20 text-sm font-mono p-0 focus-visible:ring-0 placeholder:text-green-300/30" maxLength={500} />
                  </div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-zinc-600 text-[10px]">{caption.length}/500</span>
                  <button onClick={generateAIHashtags} disabled={!caption.trim() || loadingAI}
                    className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 transition-colors">
                    {loadingAI ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} AI Hashtags
                  </button>
                </div>
              </div>

              {/* Audio Uplink — graft external Spotify/YouTube/Apple Music (Patch 2.12) */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">&gt; Audio Uplink</label>
                <AudioUplinkInput grafted={graftedAudio} onGraft={setGraftedAudio} onClear={() => setGraftedAudio(null)} />
              </div>

              {/* Hashtags */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Hashtags</label>
                <div className="flex gap-2">
                  <input value={hashtagInput} onChange={e => setHashtagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addHashtag(hashtagInput)}
                    placeholder="#tag" className="flex-1 bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF3333]" />
                  <button onClick={() => addHashtag(hashtagInput)} className="px-3 py-2 bg-[#FF3333] text-white rounded-lg text-sm font-bold hover:bg-red-500 transition-colors">
                    <Hash size={14} />
                  </button>
                </div>
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {hashtags.map((t, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-[#FF3333]/15 text-[#FF3333] border border-[#FF3333]/30 rounded-full text-xs">
                        #{t} <button onClick={() => setHashtags(p => p.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">×</button>
                      </span>
                    ))}
                  </div>
                )}
                {aiHashtags.length > 0 && (
                  <div className="mt-2 p-3 bg-purple-950/30 border border-purple-800/30 rounded-xl">
                    <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1"><Sparkles size={9} /> AI Suggestions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiHashtags.map((t, i) => (
                        <button key={i} onClick={() => addHashtag(t)}
                          className="px-2 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-700/30 rounded-full text-xs hover:bg-purple-800/40 transition-colors">
                          #{t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Promote a Server — adds a Join Server CTA to the clip */}
              {myServers.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                    <Users size={10} /> Promote a Server <span className="text-zinc-600 normal-case tracking-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedServerId('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${!selectedServerId ? 'bg-zinc-700 border-white/30 text-white' : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-white'}`}
                    >
                      None
                    </button>
                    {myServers.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedServerId(s.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedServerId === s.id ? 'bg-[#FF3333]/20 border-[#FF3333]/60 text-white' : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'}`}
                      >
                        {(s.icon_url || s.icon)
                          ? <img src={s.icon_url || s.icon} alt="" className="w-4 h-4 rounded object-cover" />
                          : <Users size={11} />}
                        <span className="truncate max-w-[120px]">{s.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1.5">Viewers see a one-tap “Join Server” button on your clip.</p>
                </div>
              )}

              {/* Thumbnail Picker */}
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Cover Frame</label>

                {/* Scrubber for custom thumbnail */}
                <div className="mb-3 p-3 bg-zinc-900 border border-white/5 rounded-xl">
                  <div className="flex justify-between text-[9px] text-zinc-500 mb-2">
                    <span>Scrub to pick a frame</span>
                    <span>{scrubTime.toFixed(1)}s / {duration.toFixed(1)}s</span>
                  </div>
                  <input type="range" min={0} max={duration || 0} step={0.1} value={scrubTime}
                    onChange={async e => {
                      const t = parseFloat(e.target.value);
                      setScrubTime(t);
                      if (videoRef.current) videoRef.current.currentTime = t;
                    }}
                    onMouseUp={async () => {
                      const frame = await captureFrame(scrubTime);
                      if (frame) { setThumbnails(p => [frame, ...p]); setSelectedThumb(0); }
                    }}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #FF3333 0%, #FF3333 ${(scrubTime/(duration||1))*100}%, #3f3f46 ${(scrubTime/(duration||1))*100}%, #3f3f46 100%)` }} />
                </div>

                <div className="flex gap-2 mb-3 flex-wrap">
                  <button onClick={async () => { const f = await captureFrame(); if (f) { setThumbnails(p => [f, ...p]); setSelectedThumb(0); toast.success('Frame captured!'); }}}
                    className="flex-1 min-w-[100px] py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors">
                    <Camera size={12} /> Capture Now
                  </button>
                  <button onClick={generateThumbs}
                    className="flex-1 min-w-[100px] py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors">
                    <Image size={12} /> Auto 6 Frames
                  </button>
                  <button onClick={() => thumbInputRef.current?.click()}
                    className="flex-1 min-w-[100px] py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors">
                    <Image size={12} /> Upload Custom
                  </button>
                  <input ref={thumbInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { setThumbnails(p => [{ time: 0, dataUrl: r.result }, ...p]); setSelectedThumb(0); toast.success('Custom thumbnail added!'); }; r.readAsDataURL(f); e.target.value = null; }} />
                </div>

                {thumbnails.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {thumbnails.map((t, i) => (
                      <button key={i} onClick={() => setSelectedThumb(i)}
                        className={`flex-shrink-0 relative rounded-xl overflow-hidden border-2 transition-all ${i === selectedThumb ? 'border-[#FF3333] scale-105 shadow-[0_0_10px_rgba(255,51,51,0.4)]' : 'border-zinc-700 opacity-60 hover:opacity-100'}`}
                        style={{ width: 72, height: 72 }}>
                        <img src={t.dataUrl} alt="" className="w-full h-full object-cover" />
                        {i === selectedThumb && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#FF3333]/20">
                            <div className="w-5 h-5 rounded-full bg-[#FF3333] flex items-center justify-center">
                              <span className="text-white text-[8px] font-black">✓</span>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 text-[8px] bg-black/70 px-1 rounded font-mono text-white">
                          {t.time?.toFixed(1)}s
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-16 border border-dashed border-zinc-700 rounded-xl text-zinc-600 text-xs">
                    No thumbnail yet — scrub, capture, or generate
                  </div>
                )}
              </div>

              {/* Config summary */}
              <div className="p-3 bg-zinc-900/50 border border-white/5 rounded-xl space-y-1.5">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Strand Config</p>
                {[['Ratio', ratio], ['Filter', filter], ...(textOverlay ? [['Text', textOverlay]] : []), ...(duration ? [['Duration', `${Math.round((trimEnd-trimStart)/100*duration)}s`]] : []), ...(selectedAudio ? [['Audio', selectedAudio.title]] : [])].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-zinc-500">{k}</span>
                    <span className={`font-bold ${k === 'Filter' && filter !== 'none' ? 'text-[#FF3333]' : 'text-white'}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fixed deploy bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur border-t border-white/5">
              <button onClick={handlePublish} disabled={publishing || !caption.trim()}
                className="w-full py-4 bg-[#FF3333] hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-[0_0_24px_rgba(255,51,51,0.35)] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider">
                {publishing ? <><Loader2 size={16} className="animate-spin" /> Rendering Strand…</> : <><ArrowRight size={16} /> Deploy Strand</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub components ────────────────────────────────────────────────────────────
function ToolBtn({ icon: Icon, label, active, onClick, accent }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 transition-all ${active ? 'text-[#FF3333] scale-110' : accent ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
        ${active ? 'bg-[#FF3333]/20 border border-[#FF3333]/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
        <Icon size={17} />
      </div>
      <span className={`text-[7px] font-black uppercase tracking-wider ${accent ? 'text-[#FF3333]' : ''}`}>{label}</span>
    </button>
  );
}

function TrimPanel({ duration, trimStart, trimEnd, currentTime, onStart, onEnd }) {
  const fmt = p => { if (!duration) return '0s'; const s = Math.round((p/100)*duration); return s < 60 ? `${s}s` : `${Math.floor(s/60)}m${s%60}s`; };
  return (
    <div className="px-5 py-4 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Time Splicer</span>
        <div className="flex gap-3 text-[9px] text-zinc-400 font-mono">
          <span className="text-[#FF3333]">▶ {fmt(trimStart)}</span>
          <span>⏹ {fmt(trimEnd)}</span>
          {duration > 0 && <span className="text-zinc-600">{Math.round((trimEnd-trimStart)/100*duration)}s total</span>}
        </div>
      </div>
      <div className="relative w-full h-12 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 select-none">
        <div className="absolute inset-0 flex items-center gap-px px-1 opacity-25">
          {Array.from({length: 60}).map((_, i) => (
            <div key={i} className="flex-1 bg-[#FF3333] rounded-full" style={{ height: `${20 + Math.sin(i*0.4)*30 + (i%3)*10}%` }} />
          ))}
        </div>
        <div className="absolute top-0 bottom-0 bg-[#FF3333]/15 border-x-2 border-[#FF3333]" style={{ left: `${trimStart}%`, width: `${trimEnd-trimStart}%` }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/50" style={{ left: `${currentTime}%` }} />
      </div>
      <div className="flex gap-4 mt-3">
        <div className="flex-1">
          <p className="text-[8px] text-zinc-600 mb-1 uppercase">Start</p>
          <input type="range" min={0} max={trimEnd-1} value={trimStart} onChange={e => onStart(+e.target.value)} className="w-full accent-red-500" />
        </div>
        <div className="flex-1">
          <p className="text-[8px] text-zinc-600 mb-1 uppercase">End</p>
          <input type="range" min={trimStart+1} max={100} value={trimEnd} onChange={e => onEnd(+e.target.value)} className="w-full accent-red-500" />
        </div>
      </div>
    </div>
  );
}
