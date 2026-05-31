import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, integrations, algorithm } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Heart, MessageCircle, Share2, Play, Volume2, VolumeX,
  Plus, ChevronUp, ChevronDown, Bookmark, Send, Sparkles, Folder,
  Globe, User, Users, Disc3, Zap, Search
} from 'lucide-react';
import PostCard3D from '../feed/PostCard3D';
import WebProfile from '../feed/WebProfile';
import ClipFeed from '../feed/ClipFeed';
import { toast } from 'sonner';
import VideoStudio from './VideoStudio';
import RichComments from './RichComments';
import PeopleSearch from './PeopleSearch';
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

// ── Main FeedPanel ────────────────────────────────────────────────────────────
export default function FeedPanel({ currentUser }) {
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
    staleTime: 30000,
    refetchInterval: 60000,
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

  // Audio tracks used by clips in this feed — lifted here so all ClipCards
  // share one query rather than each refetching.
  const audioIds = React.useMemo(
    () => [...new Set(clips.filter(c => c.audio_id).map(c => c.audio_id))],
    [clips]
  );
  const { data: audioTracks = [] } = useQuery({
    queryKey: ['audio-clips', audioIds.join(',')],
    queryFn: async () => {
      if (!audioIds.length) return [];
      const a = await entities.AudioTrack.list('-created_date', 100);
      return a.filter(t => audioIds.includes(t.id));
    },
    enabled: audioIds.length > 0,
    staleTime: 60000,
  });
  const audioMap = React.useMemo(
    () => Object.fromEntries(audioTracks.map(t => [t.id, t])),
    [audioTracks]
  );

  const TABS = [
    { val: 'main',         Icon: Globe,  label: 'THE WEB' },
    { val: 'friends-feed', Icon: Users,  label: 'LINKED NODES' },
    { val: 'people',       Icon: Search, label: 'FIND PEOPLE' },
    { val: 'profile',      Icon: User,   label: 'MY NODE' },
    { val: 'sounds',       Icon: Disc3,  label: 'SOUNDS' },
    { val: 'collections',  Icon: Folder, label: 'COCOONS' },
  ];

  return (
    <div className="flex-1 flex bg-black/40">
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
                : <ClipFeed clips={filteredClips} currentUser={currentUser} onEditClip={setEditingClip} feedPersonalized={!!feedData?.personalized} audioMap={audioMap} />
          )}
          {activeTab === 'friends-feed' && (
            friendClips.length === 0
              ? <NoFriendClips />
              : <ClipFeed clips={friendClips} currentUser={currentUser} onEditClip={setEditingClip} audioMap={audioMap} />
          )}
          {activeTab === 'profile'     && <WebProfile currentUser={currentUser} onUploadClick={() => document.getElementById('vid-upload')?.click()} />}
          {activeTab === 'people'      && <div className="w-full h-full self-stretch"><PeopleSearch currentUser={currentUser} /></div>}
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

      <input type="file" accept="video/*" className="hidden" id="vid-upload"
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
