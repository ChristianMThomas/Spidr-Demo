import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, integrations, algorithm } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Heart, MessageCircle, Share2, Play, Volume2, VolumeX,
  Plus, ChevronUp, ChevronDown, Bookmark, Send, Sparkles, Folder,
  Globe, User, Users, Disc3, Zap
} from 'lucide-react';
import PostCard3D from '../feed/PostCard3D';
import WebProfile from '../feed/WebProfile';
import { toast } from 'sonner';
import VideoStudio from './VideoStudio';
import RichComments from './RichComments';
import EmojiPicker from './EmojiPicker';
import ShareWeb from './ShareWeb';
import DataDisc from '../feed/DataDisc';
import ScrollingAudioBanner from '../feed/ScrollingAudioBanner';
import FrequencyArchive from '../feed/FrequencyArchive';
import SoundsBrowser from '../feed/SoundsBrowser';

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Engagement tracking hook ──────────────────────────────────────────────────
function useEngagement(clip, isVisible, hasLiked, videoRef) {
  const watchStart  = useRef(null);
  const totalWatched = useRef(0);
  const loops       = useRef(0);

  useEffect(() => {
    if (isVisible) {
      watchStart.current = Date.now();
    } else if (watchStart.current) {
      totalWatched.current += (Date.now() - watchStart.current) / 1000;
      watchStart.current = null;
      if (clip?.id && totalWatched.current > 0.5) {
        algorithm.trackEngagement({
          clipId:           clip.id,
          watchTimeSeconds: Math.round(totalWatched.current),
          totalDuration:    Math.round(videoRef.current?.duration || 0),
          liked:            hasLiked,
          looped:           loops.current > 0,
          shared:           false,
          commented:        false,
        });
      }
      totalWatched.current = 0;
      loops.current = 0;
    }
  }, [isVisible]);

  const onLoop = useCallback(() => { loops.current += 1; }, []);
  return { onLoop };
}

// ── Main FeedPanel ────────────────────────────────────────────────────────────
export default function FeedPanel() {
  const { currentUser } = useOutletContext();
  const [showUpload, setShowUpload]     = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [activeTab, setActiveTab]       = useState('main');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedQ                      = useDebounce(searchQuery, 400);
  const queryClient                     = useQueryClient();
  const [editingClip, setEditingClip]   = useState(null);

  const { data: allClips = [], isLoading } = useQuery({
    queryKey: ['clips'],
    queryFn:  () => entities.Clip.list('-created_date', 200),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const { data: feedData } = useQuery({
    queryKey: ['algo-feed', currentUser?.id],
    queryFn:  () => algorithm.getFeed(100),
    enabled:  !!currentUser?.id,
    staleTime: 60000,
    retry: false,
  });

  const clips = React.useMemo(() => {
    if (!feedData?.clipIds?.length) return allClips;
    const map = Object.fromEntries(allClips.map(c => [c.id, c]));
    const ordered = feedData.clipIds.map(id => map[id]).filter(Boolean);
    const inFeed  = new Set(feedData.clipIds);
    return [...ordered, ...allClips.filter(c => !inFeed.has(c.id))];
  }, [allClips, feedData]);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-feed', currentUser?.id],
    queryFn:  () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled:  !!currentUser?.id,
    staleTime: 60000,
  });
  const friendIds   = new Set(friends.map(f => f.friend_id));
  const friendClips = clips.filter(c => friendIds.has(c.author_id));

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', currentUser?.id],
    queryFn:  () => entities.Collection.filter({ user_id: currentUser?.id }),
    enabled:  !!currentUser?.id,
    staleTime: 60000,
  });

  const filteredClips = React.useMemo(() => {
    if (!debouncedQ.trim()) return clips;
    const q = debouncedQ.toLowerCase();
    return clips.filter(c =>
      c.caption?.toLowerCase().includes(q) ||
      c.author_name?.toLowerCase().includes(q) ||
      (c.hashtags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [clips, debouncedQ]);

  const TABS = [
    { val: 'main',         Icon: Globe,  label: 'THE WEB' },
    { val: 'friends-feed', Icon: Users,  label: 'LINKED NODES' },
    { val: 'profile',      Icon: User,   label: 'MY NODE' },
    { val: 'sounds',       Icon: Disc3,  label: 'SOUNDS' },
    { val: 'collections',  Icon: Folder, label: 'COCOONS' },
  ];

  return (
    <div className="flex-1 flex bg-gradient-to-br from-zinc-950 via-black to-red-950/20">
      <div className="flex-1 flex flex-col relative overflow-hidden">

        {/* Tab bar */}
        <div className="border-b border-zinc-800 px-4 flex-shrink-0 flex items-center gap-2">
          <div className="flex flex-1 h-12 items-end gap-1">
            {TABS.map(({ val, Icon, label }) => (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                className={`flex items-center gap-1.5 px-3 h-12 text-[11px] font-bold tracking-wide border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === val ? 'border-red-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {val === 'main' && feedData?.clipIds?.length > 0 && (
                  <span className="ml-0.5 px-1 py-0.5 rounded bg-red-600/20 text-red-400 text-[8px] font-black border border-red-500/20">FYP</span>
                )}
              </button>
            ))}
          </div>
          {(activeTab === 'main' || activeTab === 'friends-feed') && (
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="w-32 bg-zinc-800/60 border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500 placeholder-zinc-600 transition-all focus:w-48"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {activeTab === 'main' && (
            isLoading
              ? <Spinner />
              : filteredClips.length === 0
                ? <EmptyFeed onUpload={() => document.getElementById('vid-upload')?.click()} />
                : <ClipViewer clips={filteredClips} currentUser={currentUser} queryClient={queryClient} onEditClip={setEditingClip} feedPersonalized={!!feedData?.personalized} />
          )}
          {activeTab === 'friends-feed' && (
            friendClips.length === 0
              ? <NoFriendClips />
              : <ClipViewer clips={friendClips} currentUser={currentUser} queryClient={queryClient} onEditClip={setEditingClip} />
          )}
          {activeTab === 'profile'     && <WebProfile currentUser={currentUser} onUploadClick={() => document.getElementById('vid-upload')?.click()} />}
          {activeTab === 'sounds'      && <SoundsBrowser currentUser={currentUser} />}
          {activeTab === 'collections' && <CollectionsView collections={collections} selectedCollection={selectedCollection} onSelectCollection={setSelectedCollection} currentUser={currentUser} queryClient={queryClient} allClips={clips} />}
        </div>

        {/* Upload FAB */}
        {(activeTab === 'main' || activeTab === 'profile') && (
          <label htmlFor="vid-upload" className="cursor-pointer">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className="absolute bottom-6 right-6 bg-red-600 hover:bg-red-700 rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.45)] z-10">
              <Plus className="w-6 h-6 text-white" />
            </motion.div>
          </label>
        )}
      </div>

      <input type="file" accept="video/*,image/*" className="hidden" id="vid-upload"
        onClick={e => { e.target.value = null; }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadedFile(f); setShowUpload(true); } }} />

      {uploadedFile && (
        <VideoStudio open={showUpload} onClose={() => { setShowUpload(false); setUploadedFile(null); }}
          videoFile={uploadedFile} currentUser={currentUser}
          onPublish={async (d) => { await entities.Clip.create(d); queryClient.invalidateQueries({ queryKey: ['clips'] }); queryClient.invalidateQueries({ queryKey: ['algo-feed'] }); toast.success('Strand deployed!'); }} />
      )}
      {editingClip && (
        <VideoStudio open={!!editingClip} onClose={() => setEditingClip(null)} videoFile={null} currentUser={currentUser} initialClip={editingClip}
          onPublish={async (d) => { await entities.Clip.update(editingClip.id, d); queryClient.invalidateQueries({ queryKey: ['clips'] }); toast.success('Updated!'); setEditingClip(null); }} />
      )}
    </div>
  );
}

// ── ClipViewer ────────────────────────────────────────────────────────────────
function ClipViewer({ clips, currentUser, queryClient, onEditClip, feedPersonalized }) {
  const [idx, setIdx]                     = useState(0);
  const [playing, setPlaying]             = useState(true);
  const [muted, setMuted]                 = useState(false);
  const [vol, setVol]                     = useState(1);
  const [comments, setComments]           = useState(false);
  const [shareMenu, setShareMenu]         = useState(false);
  const [shareWeb, setShareWeb]           = useState(false);
  const [freqAudio, setFreqAudio]         = useState(null);
  const [buffering, setBuffering]         = useState(false);
  const [progress, setProgress]           = useState(0);
  const [visible, setVisible]             = useState(true);
  const videoRef  = useRef(null);
  const wrapRef   = useRef(null);

  const clip    = clips[idx] || clips[0];
  const hasLiked = clip?.likes?.includes(currentUser?.id);

  // Intersection
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible && playing) v.play().catch(() => {});
    else if (!visible) v.pause();
  }, [visible]);

  const { onLoop } = useEngagement(clip, visible, hasLiked, videoRef);

  // Audio map
  const audioIds = [...new Set(clips.filter(c => c.audio_id).map(c => c.audio_id))];
  const { data: tracks = [] } = useQuery({
    queryKey: ['audio-clips', audioIds.join(',')],
    queryFn:  async () => { if (!audioIds.length) return []; const a = await entities.AudioTrack.list('-created_date', 100); return a.filter(t => audioIds.includes(t.id)); },
    enabled:  audioIds.length > 0,
    staleTime: 60000,
  });
  const audioMap = Object.fromEntries(tracks.map(t => [t.id, t]));

  // Reset on clip change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setProgress(0); setBuffering(true); setComments(false); setShareMenu(false);
    v.load();
    v.play().catch(() => {});
    setPlaying(true);
  }, [idx]);

  // Video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime    = () => { if (v.duration) setProgress((v.currentTime / v.duration) * 100); };
    const onWait    = () => setBuffering(true);
    const onPlay    = () => setBuffering(false);
    const onLoaded  = () => setBuffering(false);
    const onEnded   = () => { onLoop(); v.currentTime = 0; v.play().catch(() => {}); };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('waiting', onWait);
    v.addEventListener('playing', onPlay);
    v.addEventListener('loadeddata', onLoaded);
    v.addEventListener('ended', onEnded);
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('waiting', onWait); v.removeEventListener('playing', onPlay); v.removeEventListener('loadeddata', onLoaded); v.removeEventListener('ended', onEnded); };
  }, [idx, onLoop]);

  const go = useCallback((d) => setIdx(p => Math.max(0, Math.min(clips.length - 1, p + d))), [clips.length]);
  const onWheel = useCallback(e => { if (Math.abs(e.deltaY) < 25) return; go(e.deltaY > 0 ? 1 : -1); }, [go]);
  const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); setPlaying(true); } else { v.pause(); setPlaying(false); } };

  const likeMut = useMutation({
    mutationFn: async (c) => {
      const likes = c.likes || [];
      return entities.Clip.update(c.id, { likes: likes.includes(currentUser?.id) ? likes.filter(id => id !== currentUser?.id) : [...likes, currentUser?.id] });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const cols = await entities.Collection.filter({ user_id: currentUser?.id });
      let col = cols.find(c => c.name === 'Saved');
      if (!col) { await entities.Collection.create({ user_id: currentUser?.id, name: 'Saved', clip_ids: [clip.id] }); }
      else { const ids = col.clip_ids || []; await entities.Collection.update(col.id, { clip_ids: ids.includes(clip.id) ? ids.filter(id => id !== clip.id) : [...ids, clip.id] }); }
    },
    onSuccess: () => { toast.success('Saved!'); queryClient.invalidateQueries({ queryKey: ['collections'] }); },
  });

  const reactMut = useMutation({
    mutationFn: async (ed) => {
      const reactions = clip.reactions || [];
      const emoji = ed.type === 'custom' ? `:${ed.name}:` : ed.emoji;
      const ex = reactions.find(r => r.emoji === emoji);
      let nr;
      if (ex) { const had = ex.users.includes(currentUser?.id); nr = reactions.map(r => r.emoji === emoji ? { ...r, users: had ? r.users.filter(id => id !== currentUser?.id) : [...r.users, currentUser?.id] } : r).filter(r => r.users.length > 0); }
      else { nr = [...reactions, { emoji, users: [currentUser?.id] }]; }
      return entities.Clip.update(clip.id, { reactions: nr });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
  });

  const handleShare = async (method) => {
    if (method === 'link') { navigator.clipboard.writeText(`${window.location.origin}?clip=${clip.id}`); toast.success('Link copied!'); await entities.Clip.update(clip.id, { shares_count: (clip.shares_count || 0) + 1 }); queryClient.invalidateQueries({ queryKey: ['clips'] }); algorithm.trackEngagement({ clipId: clip.id, watchTimeSeconds: 0, totalDuration: 0, liked: hasLiked, shared: true }); }
    setShareMenu(false);
  };

  const userReactions = (clip?.reactions || []).filter(r => r.users.includes(currentUser?.id));
  const ratio = clip?.aspect_ratio || clip?.style?.ratio || '9:16';
  const aspectCss = ratio === '16:9' ? '16/9' : ratio === '1:1' ? '1/1' : '9/16';

  return (
    <div ref={wrapRef} className="w-full h-full flex items-center justify-center relative overflow-hidden" onWheel={onWheel}>
      {/* Top label */}
      <div className="absolute top-3 inset-x-0 text-center z-10 pointer-events-none">
        <span className="text-[10px] font-black tracking-widest text-red-600/40 uppercase">
          {feedPersonalized ? '⚡ For You' : 'THE WEB'} // {idx + 1} / {clips.length}
        </span>
      </div>

      {/* Nav buttons */}
      <button onClick={() => go(-1)} disabled={idx === 0}
        className="absolute left-3 top-1/2 -translate-y-8 z-20 w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white disabled:opacity-10 hover:bg-white/10 transition-all">
        <ChevronUp className="w-4 h-4" />
      </button>
      <button onClick={() => go(1)} disabled={idx >= clips.length - 1}
        className="absolute left-3 top-1/2 translate-y-2 z-20 w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white disabled:opacity-10 hover:bg-white/10 transition-all">
        <ChevronDown className="w-4 h-4" />
      </button>

      <AnimatePresence mode="wait">
        <motion.div key={clip?.id}
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`relative flex gap-3 ${comments ? 'max-w-4xl' : 'max-w-sm'}`}
          style={{ height: '82vh' }}
        >
          {/* Video card */}
          <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl flex-shrink-0"
            style={{ aspectRatio: aspectCss, maxHeight: '82vh' }}>
            <video ref={videoRef} src={clip?.video_url}
              className="w-full h-full object-contain bg-black cursor-pointer"
              loop autoPlay muted={muted} playsInline preload="metadata"
              onClick={togglePlay}
            />

            {/* Buffering */}
            <AnimatePresence>
              {buffering && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </motion.div>}
            </AnimatePresence>

            {/* Paused */}
            <AnimatePresence>
              {!playing && !buffering && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                <div className="w-14 h-14 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                  <Play size={24} fill="white" className="text-white ml-1" />
                </div>
              </motion.div>}
            </AnimatePresence>

            {/* Progress bar */}
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-white/10">
              <div className="h-full bg-red-500 transition-none" style={{ width: `${progress}%` }} />
            </div>

            {/* Author/caption overlay */}
            <div className="absolute bottom-2 left-0 right-12 px-3 pt-8 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
              <div className="flex items-center gap-2 mb-1">
                <Avatar className="w-7 h-7 border-2 border-red-500 flex-shrink-0">
                  {clip?.author_avatar ? <AvatarImage src={clip.author_avatar} /> : <AvatarFallback className="bg-red-900 text-white text-xs">{clip?.author_name?.charAt(0)?.toUpperCase()}</AvatarFallback>}
                </Avatar>
                <span className="font-semibold text-white text-xs truncate">{clip?.author_name}</span>
                {clip?.author_id === currentUser?.id && onEditClip && (
                  <button onClick={e => { e.stopPropagation(); onEditClip(clip); }} className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/50 hover:text-white transition-colors">Edit</button>
                )}
              </div>
              {clip?.caption && <p className="text-white text-xs line-clamp-2 mb-1">{clip.caption}</p>}
              {(clip?.hashtags || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {clip.hashtags.slice(0,4).map((t, i) => <span key={i} className="text-red-400 text-[10px] font-bold">#{t}</span>)}
                </div>
              )}
              {clip?.audio_id && audioMap[clip.audio_id] && (
                <ScrollingAudioBanner audioTrack={audioMap[clip.audio_id]} onClick={() => setFreqAudio(audioMap[clip.audio_id])} />
              )}
            </div>

            {/* Reactions */}
            {clip?.reactions?.length > 0 && (
              <div className="absolute bottom-20 left-3 flex gap-1 flex-wrap max-w-[55%]">
                {clip.reactions.map((r, i) => (
                  <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-zinc-800/90 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <span className="text-sm">{r.emoji}</span>
                    <span className="text-white text-[10px]">{r.users.length}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Side actions */}
            <div className="absolute right-2 bottom-20 flex flex-col gap-3">
              <Btn onClick={() => likeMut.mutate(clip)} label={clip?.likes?.length || 0} active={hasLiked}>
                <Heart className="w-5 h-5" fill={hasLiked ? 'currentColor' : 'none'} />
              </Btn>
              <Btn onClick={() => setComments(v => !v)} label={clip?.comments_count || 0} active={comments}>
                <MessageCircle className="w-5 h-5" />
              </Btn>
              <EmojiPicker onEmojiSelect={e => reactMut.mutate(e)} currentUser={currentUser}>
                <Btn label={userReactions.length || ''} active={userReactions.length > 0}>
                  <Sparkles className="w-5 h-5" />
                </Btn>
              </EmojiPicker>
              <div className="relative">
                <Btn onClick={() => setShareMenu(v => !v)} label={clip?.shares_count || 0}>
                  <Share2 className="w-5 h-5" />
                </Btn>
                <AnimatePresence>
                  {shareMenu && (
                    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                      className="absolute right-12 top-0 bg-zinc-800 rounded-xl border border-zinc-700 p-1.5 w-34 shadow-2xl z-30 min-w-[130px]">
                      <button onClick={() => { setShareWeb(true); setShareMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded-lg text-white text-xs">🕸️ Sling to DMs</button>
                      <button onClick={() => handleShare('link')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded-lg text-white text-xs"><Send className="w-3 h-3" /> Copy Link</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Btn onClick={() => saveMut.mutate()}><Bookmark className="w-5 h-5" /></Btn>
              {clip?.audio_id && audioMap[clip.audio_id] && <DataDisc audioTrack={audioMap[clip.audio_id]} onOpenFrequency={t => setFreqAudio(t)} />}
              <div className="relative group/vol">
                <Btn onClick={() => setMuted(v => !v)}>{muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</Btn>
                <div className="absolute right-12 top-0 bg-zinc-800/95 rounded-xl p-3 opacity-0 group-hover/vol:opacity-100 pointer-events-none group-hover/vol:pointer-events-auto transition-all shadow-xl">
                  <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol}
                    onChange={e => { const v = parseFloat(e.target.value); setVol(v); setMuted(v === 0); if (videoRef.current) videoRef.current.volume = v; }}
                    className="w-20 h-1 appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right,#dc2626 0%,#dc2626 ${(muted?0:vol)*100}%,#3f3f46 ${(muted?0:vol)*100}%,#3f3f46 100%)` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <AnimatePresence>
            {comments && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 340, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden flex-shrink-0"
                style={{ height: '82vh' }}>
                <RichComments clipId={clip?.id} currentUser={currentUser} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Dot indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
        {clips.slice(Math.max(0, idx - 4), idx + 5).map((_, i) => {
          const ai = Math.max(0, idx - 4) + i;
          return <button key={ai} onClick={() => setIdx(ai)} className={`h-1 rounded-full transition-all hover:bg-red-400 ${ai === idx ? 'w-5 bg-red-500' : 'w-1.5 bg-zinc-600'}`} />;
        })}
      </div>

      <AnimatePresence>
        {shareWeb && <ShareWeb isOpen={shareWeb} onClose={() => setShareWeb(false)} clip={clip} currentUser={currentUser} />}
      </AnimatePresence>
      <AnimatePresence>
        {freqAudio && <FrequencyArchive audioTrack={freqAudio} onClose={() => setFreqAudio(null)} currentUser={currentUser} onClipClick={() => setFreqAudio(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ── Micro components ──────────────────────────────────────────────────────────
function Btn({ children, onClick, label, active }) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-0.5">
      <motion.div className={`w-10 h-10 rounded-full bg-zinc-800/80 backdrop-blur flex items-center justify-center transition-colors ${active ? 'text-red-500 bg-red-500/10' : 'text-white hover:bg-zinc-700/80'}`}
        animate={active ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.15 }}>
        {children}
      </motion.div>
      {label !== undefined && label !== '' && <span className="text-white text-[10px] font-medium">{label}</span>}
    </motion.button>
  );
}

function Spinner() {
  return <div className="flex flex-col items-center gap-3 text-zinc-500">
    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs tracking-widest uppercase">Loading Web…</span>
  </div>;
}

function EmptyFeed({ onUpload }) {
  return <div className="text-center flex flex-col items-center gap-4">
    <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-500/20 flex items-center justify-center">
      <Globe className="w-8 h-8 text-red-500/40" />
    </div>
    <p className="text-zinc-400 font-bold text-sm">The Web is empty. Be first.</p>
    <button onClick={onUpload} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors">
      <Plus className="w-4 h-4" /> Upload Clip
    </button>
  </div>;
}

function NoFriendClips() {
  return <div className="text-center py-12">
    <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
    <p className="text-zinc-400 font-bold text-sm">No clips from linked nodes yet</p>
    <p className="text-zinc-600 text-xs mt-1">When your friends post, they'll appear here</p>
  </div>;
}

// ── Collections ───────────────────────────────────────────────────────────────
function CollectionsView({ collections, selectedCollection, onSelectCollection, currentUser, queryClient, allClips }) {
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);

  const createMut = useMutation({
    mutationFn: name => entities.Collection.create({ user_id: currentUser?.id, name, clip_ids: [], is_public: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['collections'] }); toast.success('Created!'); setNewName(''); setShowNew(false); },
  });

  const sel      = selectedCollection ? collections.find(c => c.id === selectedCollection) : null;
  const selClips = sel ? allClips.filter(c => sel.clip_ids?.includes(c.id)) : [];

  if (sel) return (
    <div className="w-full h-full flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <Button onClick={() => onSelectCollection(null)} variant="ghost" size="sm" className="text-zinc-400 hover:text-white mb-1">← Back</Button>
        <h2 className="text-lg font-bold text-white">{sel.name}</h2>
        <p className="text-zinc-500 text-xs">{selClips.length} clips</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selClips.length === 0
          ? <div className="text-center py-10 text-zinc-500"><Folder className="w-9 h-9 mx-auto mb-2 opacity-40" /><p className="text-sm">Empty cocoon</p></div>
          : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{selClips.map((c, i) => <PostCard3D key={c.id} clip={c} index={i} />)}</div>
        }
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">Cocoons</h2>
        <Button onClick={() => setShowNew(v => !v)} className="bg-red-600 hover:bg-red-700 text-sm"><Plus className="w-3.5 h-3.5 mr-1" /> New</Button>
      </div>
      {showNew && (
        <div className="bg-zinc-900 rounded-xl p-4 mb-5 border border-zinc-800">
          <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMut.mutate(newName)} placeholder="Name…" className="bg-zinc-800 border-zinc-700 text-white mb-3" />
          <div className="flex gap-2">
            <Button onClick={() => createMut.mutate(newName)} disabled={!newName.trim()} className="bg-red-600 hover:bg-red-700">Create</Button>
            <Button onClick={() => { setShowNew(false); setNewName(''); }} variant="outline">Cancel</Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {collections.map(col => (
          <motion.button key={col.id} onClick={() => onSelectCollection(col.id)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-red-500/50 transition-colors text-left">
            <Folder className="w-6 h-6 text-red-500 mb-2" />
            <h3 className="text-white font-semibold text-sm mb-1">{col.name}</h3>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {(col.clip_ids || []).slice(0,3).map((id, i) => {
                const c = allClips.find(ac => ac.id === id);
                return <div key={i} className="rounded overflow-hidden bg-zinc-800 aspect-square">
                  {c?.thumbnail_url ? <img src={c.thumbnail_url} className="w-full h-full object-cover" crossOrigin="anonymous" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/30 to-zinc-900"><Play className="w-4 h-4 text-red-400" /></div>}
                </div>;
              })}
            </div>
            <p className="text-zinc-500 text-xs">{col.clip_ids?.length || 0} clips</p>
          </motion.button>
        ))}
        {collections.length === 0 && <div className="col-span-full text-center py-10 text-zinc-500"><Folder className="w-9 h-9 mx-auto mb-2 opacity-40" /><p className="text-sm">No cocoons yet</p></div>}
      </div>
    </div>
  );
}
