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
  Globe, User, Users, Disc3, Zap, Search, Clock, Flame, X as XIcon
} from 'lucide-react';
import PostCard3D from '../feed/PostCard3D';
import WebProfile from '../feed/WebProfile';
import WebSignalsInbox from '../feed/WebSignalsInbox';
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
  // Viewing another user's WEB profile (tap an author in the feed). When set,
  // it overlays the current tab with their public profile.
  const [viewingUser, setViewingUser]   = useState(null);
  // When set, the main feed is filtered to a single user's clips — driven
  // by the "ENTER USER WEB" button on the profile modal. A close-affordance
  // at the top of the feed lets the viewer return to the full feed.
  const [userArchiveId, setUserArchiveId] = useState(null);
  const [userArchiveName, setUserArchiveName] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [jumpClipId, setJumpClipId]     = useState(null);
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
  // Friends tab = strands your friends AUTHORED plus strands they RELAYED
  // (reposts). A relayed clip carries a `_relayedBy` annotation so the card
  // can render the "X RELAYED THIS SIGNAL" banner. Authored wins when both.
  const friendById = React.useMemo(() => {
    const m = {};
    for (const f of friends) if (f.friend_id) m[f.friend_id] = f;
    return m;
  }, [friends]);
  const friendClips = React.useMemo(() => clips
    .filter(c => friendIds.has(c.author_id) || (c.relays || []).some(id => friendIds.has(id)))
    .map(c => {
      if (friendIds.has(c.author_id)) return c;
      const relayerId = (c.relays || []).find(id => friendIds.has(id));
      const fr = friendById[relayerId];
      // `repost_by` is the shape the ClipCard's existing purple "Relayed this
      // signal" header renders — reuse the OG design instead of a new banner.
      return { ...c, repost_by: { user_name: fr?.friend_name || 'A friend', user_avatar: fr?.friend_avatar || '' } };
    }), [clips, friendIds, friendById]);

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

  // Listen for "ENTER USER WEB" button presses (fired from HolographicProfile
  // and any other surface that wants to open a user's clip archive). Filters
  // the main feed to clips authored by the requested user, switches us into
  // the main tab, and lights up the archive-mode chrome.
  useEffect(() => {
    const handler = (e) => {
      const { userId, userName } = e.detail || {};
      if (!userId) return;
      setUserArchiveId(userId);
      setUserArchiveName(userName || 'this user');
      setActiveTab('main');
    };
    window.addEventListener('spidr-open-user-clips', handler);
    return () => window.removeEventListener('spidr-open-user-clips', handler);
  }, []);

  // The clip list piped into ClipFeed for the main tab. Two layers:
  //   (a) user-archive mode wins (single-user view via ENTER USER WEB),
  //   (b) otherwise the search-bar `filteredClips` already narrows by
  //       caption / hashtag / name.
  // The friends-only feed lives in the separate LINKED NODES tab.
  const mainTabClips = React.useMemo(() => {
    if (userArchiveId) {
      return filteredClips.filter(c => c.author_id === userArchiveId);
    }
    return filteredClips;
  }, [userArchiveId, filteredClips]);

  // ── Recents ────────────────────────────────────────────────────────────
  // Tracks the last 10 user IDs the viewer opened a profile for. Listens
  // for the global `spidr-open-profile` event (the same event clip
  // authors, comments, member lists, and search results all fire) and
  // bumps the matching user to the front, dedup'd, capped to 10.
  // Persisted to localStorage so the list survives reloads.
  const [recentIds, setRecentIds] = useState(() => {
    try {
      const raw = localStorage.getItem('spidr_recent_profiles');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, 10) : [];
    } catch { return []; }
  });
  useEffect(() => {
    const handler = (e) => {
      const uid = e?.detail?.userId;
      if (!uid || uid === currentUser?.id) return; // never record self
      setRecentIds((prev) => {
        const next = [uid, ...prev.filter(x => x !== uid)].slice(0, 10);
        try { localStorage.setItem('spidr_recent_profiles', JSON.stringify(next)); } catch {}
        return next;
      });
    };
    window.addEventListener('spidr-open-profile', handler);
    return () => window.removeEventListener('spidr-open-profile', handler);
  }, [currentUser?.id]);

  // Pull profiles for the recent IDs. One bulk query; only refetches when
  // the ID set changes.
  const { data: recentProfilesRaw = [] } = useQuery({
    queryKey: ['recent-profiles', recentIds.join('|')],
    queryFn: async () => {
      if (!recentIds.length) return [];
      const profiles = await entities.UserProfile.list('-created_date', 500);
      return profiles;
    },
    enabled: recentIds.length > 0,
    staleTime: 60000,
  });
  const recentProfiles = React.useMemo(() => {
    if (!recentIds.length) return [];
    const byId = new Map(recentProfilesRaw.map(p => [p.user_id || p.id, p]));
    return recentIds.map(id => byId.get(id)).filter(Boolean);
  }, [recentProfilesRaw, recentIds]);

  // ── Pulse ──────────────────────────────────────────────────────────────
  // Top 5 trending hashtags computed from the current clip pool. We weight
  // by clip engagement (likes + comments + relays) instead of raw count
  // so a tag attached to viral clips outranks a tag spammed on low-signal
  // clips. Re-derived whenever the pool shifts.
  const trendingTags = React.useMemo(() => {
    const tally = {};
    for (const c of clips) {
      const tags = c.hashtags || [];
      const engagement =
        (c.likes?.length || 0) +
        (c.comments_count || 0) * 1.5 +
        (c.relays?.length || 0) * 2 +
        1; // floor so even fresh clips contribute
      for (const t of tags) {
        const key = String(t).toLowerCase();
        if (!key) continue;
        tally[key] = (tally[key] || 0) + engagement;
      }
    }
    return Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, score]) => ({ tag, score: Math.round(score) }));
  }, [clips]);

  const [pulseOpen, setPulseOpen] = useState(true);

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
    { val: 'recents',      Icon: Clock,  label: 'RECENTS' },
    { val: 'profile',      Icon: User,   label: 'MY NODE' },
    { val: 'sounds',       Icon: Disc3,  label: 'SOUNDS' },
    { val: 'collections',  Icon: Folder, label: 'SAVED' },
    { val: 'signals',      Icon: Send,   label: 'SIGNALS' },
  ];

  return (
    <div className="flex-1 flex bg-black/40">
      <div className="flex-1 flex flex-col relative overflow-hidden">

        {/* Tab bar — pr-[200px] reserves space for the shell's top-right
            cluster so the last tab (SAVED) doesn't get covered. */}
        <div className="border-b border-zinc-800 px-4 pr-[200px] flex-shrink-0 flex items-center gap-2">
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
        <div className="flex-1 flex items-center justify-center overflow-hidden relative">
          {/* Another user's WEB profile — overlays whatever tab is active */}
          {viewingUser && (
            <div className="absolute inset-0 z-40 bg-black flex">
              <WebProfile
                currentUser={currentUser}
                targetUser={viewingUser}
                onBack={() => setViewingUser(null)}
              />
            </div>
          )}
          {/* Archive-mode banner — shown when the user clicked
              "ENTER USER WEB" on someone's profile. Pinned at top, gives
              them a clear way out back to the full feed. */}
          {activeTab === 'main' && userArchiveId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-red-500/40 shadow-[0_0_14px_rgba(239,68,68,0.20)]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-mono tracking-widest uppercase text-red-300">
                Archive · <span className="text-white">{userArchiveName}</span>
              </span>
              <button
                onClick={() => { setUserArchiveId(null); setUserArchiveName(''); }}
                className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 hover:text-white transition-colors ml-1 px-2 py-0.5 rounded-full border border-white/10 hover:border-white/30"
                title="Exit archive"
              >
                Exit
              </button>
            </div>
          )}

          {activeTab === 'main' && (
            isLoading
              ? <Spinner />
              : mainTabClips.length === 0
                ? (userArchiveId
                    ? <NoArchiveClips name={userArchiveName} />
                    : <EmptyFeed onUpload={() => document.getElementById('vid-upload')?.click()} />)
                : <ClipFeed clips={mainTabClips} currentUser={currentUser} onEditClip={setEditingClip} feedPersonalized={!!feedData?.personalized && !userArchiveId} audioMap={audioMap} initialClipId={jumpClipId} onOpenProfile={(u) => setViewingUser(u)} />
          )}
          {/* Pulse sidebar — top-5 trending tags. Floats on the LEFT edge
              of the main feed area. Clicking a tag pipes it into the
              search bar so filteredClips narrows. Hidden when in archive
              mode (the archive is by definition single-user). */}
          {activeTab === 'main' && !userArchiveId && trendingTags.length > 0 && (
            <PulsePanel
              tags={trendingTags}
              activeTag={debouncedQ}
              open={pulseOpen}
              onToggleOpen={() => setPulseOpen(o => !o)}
              onPick={(tag) => setSearchQuery(searchQuery === tag ? '' : tag)}
            />
          )}
          {activeTab === 'friends-feed' && (
            friendClips.length === 0
              ? <NoFriendClips />
              : <ClipFeed clips={friendClips} currentUser={currentUser} onEditClip={setEditingClip} audioMap={audioMap} onOpenProfile={(u) => setViewingUser(u)} />
          )}
          {activeTab === 'recents'    && <RecentsTab profiles={recentProfiles} onClear={() => { setRecentIds([]); try { localStorage.removeItem('spidr_recent_profiles'); } catch {} }} />}
          {activeTab === 'profile'     && <WebProfile currentUser={currentUser} onUploadClick={() => document.getElementById('vid-upload')?.click()} />}
          {activeTab === 'signals'     && <WebSignalsInbox currentUser={currentUser} onOpenClip={(id) => { setJumpClipId(id); setActiveTab('main'); }} onOpenProfile={(u) => setViewingUser(u)} />}
          {activeTab === 'people'      && <div className="w-full h-full self-stretch"><PeopleSearch currentUser={currentUser} /></div>}
          {activeTab === 'sounds'      && <SoundsBrowser currentUser={currentUser} />}
          {activeTab === 'collections' && <CollectionsView collections={collections} selectedCollection={selectedCollection} onSelectCollection={setSelectedCollection} currentUser={currentUser} queryClient={queryClient} allClips={clips} onJumpToClip={(id) => { setJumpClipId(id); setActiveTab('main'); }} />}
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
function CollectionsView({ collections, selectedCollection, onSelectCollection, currentUser, queryClient, allClips, onJumpToClip }) {
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
          ? <div className="text-center py-10 text-zinc-500"><Folder className="w-9 h-9 mx-auto mb-2 opacity-40" /><p className="text-sm">Nothing saved here yet</p></div>
          : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{selClips.map((c, i) => (
              <div key={c.id} className="relative cursor-pointer group/saved" onClick={() => onJumpToClip(c.id)}>
                <PostCard3D clip={c} index={i} />
                <div className="absolute inset-0 bg-black/0 group-hover/saved:bg-black/40 transition-colors rounded-xl flex items-center justify-center pointer-events-none">
                  <Play className="w-8 h-8 text-white opacity-0 group-hover/saved:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </div>
            ))}</div>
        }
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">Saved</h2>
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
        {collections.length === 0 && <div className="col-span-full text-center py-10 text-zinc-500"><Folder className="w-9 h-9 mx-auto mb-2 opacity-40" /><p className="text-sm">No saved collections yet</p></div>}
      </div>
    </div>
  );
}

// Empty state shown when a viewer enters someone's archive and that user
// hasn't uploaded any clips to THE WEB yet.
function NoArchiveClips({ name }) {
  return <div className="text-center py-12 px-6">
    <User className="w-10 h-10 text-gray-700 mx-auto mb-3" />
    <p className="text-zinc-400 font-bold text-sm">{name} hasn't woven any strands yet</p>
    <p className="text-zinc-600 text-xs mt-1">Their archive is empty for now.</p>
  </div>;
}

// ── Recents tab ─────────────────────────────────────────────────────────────
// Shows the last 10 profiles the viewer opened (tracked from the global
// spidr-open-profile window event in FeedPanel). Each row re-opens the
// profile modal on click — no separate route needed.
function RecentsTab({ profiles, onClear }) {
  if (!profiles.length) {
    return (
      <div className="text-center py-12 px-6">
        <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <p className="text-zinc-400 font-bold text-sm">No recent profiles yet</p>
        <p className="text-zinc-600 text-xs mt-1">Profiles you view will land here for quick jumps.</p>
      </div>
    );
  }
  return (
    <div className="w-full max-w-xl mx-auto h-full flex flex-col p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Last 10 viewed
        </p>
        <button
          onClick={onClear}
          className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {profiles.map((p) => (
          <button
            key={p.user_id || p.id}
            onClick={() => window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: p.user_id || p.id } }))}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900/40 hover:bg-zinc-800/60 border border-white/5 hover:border-red-500/30 transition-all text-left group"
          >
            <Avatar className="w-10 h-10 border border-white/10 group-hover:border-red-500 transition-colors">
              {p.avatar_url
                ? <AvatarImage src={p.avatar_url} />
                : <AvatarFallback className="bg-red-900 text-white text-sm font-bold">
                    {(p.display_name || p.username || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-bold truncate">{p.display_name || p.username}</p>
              <p className="text-zinc-500 text-xs font-mono truncate">@{p.username || (p.user_id || p.id || '').slice(0, 8)}</p>
            </div>
            <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest group-hover:text-red-400 transition-colors">Jump →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pulse panel ─────────────────────────────────────────────────────────────
// Top-5 trending hashtags floating on the LEFT edge of the main feed. Click
// a tag to pipe it into the search bar (which already filters by hashtag
// via the debounced query). Click again to clear. Collapsible — when
// closed, only a small "Pulse" button remains so the feed has full room.
function PulsePanel({ tags, activeTag, open, onToggleOpen, onPick }) {
  const activeLower = (activeTag || '').toLowerCase();
  if (!open) {
    return (
      <button
        onClick={onToggleOpen}
        className="absolute top-4 left-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:border-red-500/40 transition-all"
        title="Show Pulse — trending tags"
      >
        <Flame className="w-3.5 h-3.5 text-red-400" />
        <span className="font-mono text-[10px] tracking-widest uppercase text-white">Pulse</span>
      </button>
    );
  }
  return (
    <div
      className="absolute top-4 left-4 z-40 w-56 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-red-400">
          <Flame className="w-3 h-3" />
          Pulse · Trending
        </p>
        <button
          onClick={onToggleOpen}
          className="text-zinc-500 hover:text-white transition-colors p-0.5 rounded"
          aria-label="Hide Pulse"
          title="Hide Pulse"
        >
          <XIcon className="w-3 h-3" />
        </button>
      </div>
      <div className="p-2 space-y-1">
        {tags.map(({ tag, score }, i) => {
          const isActive = activeLower === tag.toLowerCase();
          return (
            <button
              key={tag}
              onClick={() => onPick(tag)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left ${
                isActive
                  ? 'bg-red-500/15 border border-red-500/40'
                  : 'hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <span className={`font-mono text-[10px] w-5 ${isActive ? 'text-red-400' : 'text-zinc-600'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={`flex-1 truncate text-xs font-bold ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                #{tag}
              </span>
              <span className={`font-mono text-[9px] tracking-wider tabular-nums ${isActive ? 'text-red-300' : 'text-zinc-600'}`}>
                {score}
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-zinc-600 border-t border-white/5">
        Click to filter the web
      </p>
    </div>
  );
}
