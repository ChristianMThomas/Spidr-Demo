import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share2, Play, Volume2, VolumeX, Plus, Bookmark, Send, Sparkles, Folder, Globe, User, Users, Disc3 } from 'lucide-react';
import PostCard3D from '../feed/PostCard3D';
import WebProfile from '../feed/WebProfile';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VideoStudio from './VideoStudio';
import RichComments from './RichComments';
import EmojiPicker from './EmojiPicker';
import ShareWeb from './ShareWeb';
import SignalTracker from './SignalTracker';
import DataDisc from '../feed/DataDisc';
import ScrollingAudioBanner from '../feed/ScrollingAudioBanner';
import FrequencyArchive from '../feed/FrequencyArchive';
import SoundsBrowser from '../feed/SoundsBrowser';

export default function FeedPanel({ currentUser }) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [activeTab, setActiveTab] = useState('main');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const queryClient = useQueryClient();

  const { data: clips = [], isLoading } = useQuery({
    queryKey: ['clips'],
    queryFn: () => base44.entities.Clip.list('-created_date', 50),
    staleTime: 30000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-feed', currentUser?.id],
    queryFn: () => base44.entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  const friendIds = new Set(friends.map(f => f.friend_id));
  const friendClips = clips.filter(c => friendIds.has(c.author_id));

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', currentUser?.id],
    queryFn: () => base44.entities.Collection.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  const userClips = clips.filter(c => c.author_id === currentUser?.id);

  const [editingClip, setEditingClip] = useState(null);

  return (
    <div className="flex-1 flex bg-gradient-to-br from-zinc-950 via-black to-red-950/20">
      {/* Main Feed */}
      <div className="flex-1 flex flex-col relative">
        {/* Tabs */}
        <div className="border-b border-zinc-800 px-4">
          <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="bg-transparent border-0 w-full justify-start h-12">
              <TabsTrigger 
                value="main" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none font-bold tracking-wide"
              >
                <Globe className="w-4 h-4 mr-2" />
                GLOBAL SIGNAL
              </TabsTrigger>
              <TabsTrigger 
                value="friends-feed" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none font-bold tracking-wide"
              >
                <Users className="w-4 h-4 mr-2" />
                LINKED NODES
              </TabsTrigger>
              <TabsTrigger 
                value="profile" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none font-bold tracking-wide"
              >
                <User className="w-4 h-4 mr-2" />
                MY NODE
              </TabsTrigger>
              <TabsTrigger 
                value="sounds" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none font-bold tracking-wide"
              >
                <Disc3 className="w-4 h-4 mr-2" />
                SOUNDS
              </TabsTrigger>
              <TabsTrigger 
                value="collections" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none font-bold tracking-wide"
              >
                <Folder className="w-4 h-4 mr-2" />
                COCOONS
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SignalTracker
            placeholder="Search clips..."
            messages={clips.map(c => ({ id: c.id, content: c.caption, author_name: c.author_name, created_date: c.created_date }))}
            onResultClick={() => {}}
          />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {activeTab === 'main' && (
            isLoading ? (
              <div className="text-zinc-500">Loading clips...</div>
            ) : clips.length === 0 ? (
              <div className="text-center">
                <p className="text-zinc-400 mb-4">No clips yet. Be the first to post!</p>
                <label htmlFor="video-upload-input">
                  <Button className="bg-red-600 hover:bg-red-700" asChild>
                    <span>
                      <Plus className="w-4 h-4 mr-2" /> Upload Clip
                    </span>
                  </Button>
                </label>
              </div>
            ) : (
              <ClipViewer clips={clips} currentUser={currentUser} queryClient={queryClient} onEditClip={setEditingClip} />
            )
          )}

          {activeTab === 'friends-feed' && (
            friendClips.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-zinc-400 mb-1 font-bold">No clips from linked nodes yet</p>
                <p className="text-zinc-600 text-xs">When your friends post clips, they'll appear here</p>
              </div>
            ) : (
              <ClipViewer clips={friendClips} currentUser={currentUser} queryClient={queryClient} onEditClip={setEditingClip} />
            )
          )}

          {activeTab === 'profile' && (
            <WebProfile
              currentUser={currentUser}
              onUploadClick={() => document.getElementById('video-upload-input')?.click()}
            />
          )}

          {activeTab === 'sounds' && (
            <SoundsBrowser currentUser={currentUser} />
          )}

          {activeTab === 'collections' && (
            <CollectionsView 
              collections={collections}
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
              currentUser={currentUser}
              queryClient={queryClient}
              allClips={clips}
            />
          )}
        </div>

        {/* Upload Button */}
        {clips.length > 0 && (
          <label htmlFor="video-upload-input" className="cursor-pointer">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute bottom-6 right-6 bg-red-600 hover:bg-red-700 rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
            >
              <Plus className="w-6 h-6 text-white" />
            </motion.div>
          </label>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        accept="video/*"
        className="hidden"
        id="video-upload-input"
        onClick={(e) => { e.target.value = null; }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setUploadedFile(file);
            setShowUpload(true);
          }
        }}
      />

      {/* Video Studio - Create */}
      {uploadedFile && (
        <VideoStudio
          open={showUpload}
          onClose={() => {
            setShowUpload(false);
            setUploadedFile(null);
          }}
          videoFile={uploadedFile}
          currentUser={currentUser}
          onPublish={async (clipData) => {
            await base44.entities.Clip.create(clipData);
            queryClient.invalidateQueries({ queryKey: ['clips'] });
            toast.success('Clip published!');
          }}
        />
      )}

      {/* Video Studio - Edit */}
      {editingClip && (
        <VideoStudio
          open={!!editingClip}
          onClose={() => setEditingClip(null)}
          videoFile={null}
          currentUser={currentUser}
          initialClip={editingClip}
          onPublish={async (clipData) => {
            await base44.entities.Clip.update(editingClip.id, clipData);
            queryClient.invalidateQueries({ queryKey: ['clips'] });
            toast.success('Clip updated!');
            setEditingClip(null);
          }}
        />
      )}
      </div>
      );
}

function ClipViewer({ clips, currentUser, queryClient, onEditClip }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showShareWeb, setShowShareWeb] = useState(false);
  const [frequencyAudio, setFrequencyAudio] = useState(null);
  const videoRef = useRef(null);

  // Fetch audio tracks for all clips that have audio_id
  const audioIds = [...new Set(clips.filter(c => c.audio_id).map(c => c.audio_id))];
  const { data: audioTracks = [] } = useQuery({
    queryKey: ['audio-tracks-for-clips', audioIds.join(',')],
    queryFn: async () => {
      if (audioIds.length === 0) return [];
      const all = await base44.entities.AudioTrack.list('-created_date', 100);
      return all.filter(t => audioIds.includes(t.id));
    },
    enabled: audioIds.length > 0,
    staleTime: 60000,
  });
  const audioMap = Object.fromEntries(audioTracks.map(t => [t.id, t]));

  const currentClip = clips[currentIndex];

  const likeMutation = useMutation({
    mutationFn: async (clip) => {
      const likes = clip.likes || [];
      const hasLiked = likes.includes(currentUser?.id);
      const newLikes = hasLiked 
        ? likes.filter(id => id !== currentUser?.id)
        : [...likes, currentUser?.id];
      return base44.entities.Clip.update(clip.id, { likes: newLikes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] })
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const collections = await base44.entities.Collection.filter({ user_id: currentUser?.id });
      let defaultCollection = collections.find(c => c.name === 'Saved');
      
      if (!defaultCollection) {
        defaultCollection = await base44.entities.Collection.create({
          user_id: currentUser?.id,
          name: 'Saved',
          clip_ids: [currentClip.id]
        });
      } else {
        const clipIds = defaultCollection.clip_ids || [];
        const isSaved = clipIds.includes(currentClip.id);
        const newClipIds = isSaved 
          ? clipIds.filter(id => id !== currentClip.id)
          : [...clipIds, currentClip.id];
        await base44.entities.Collection.update(defaultCollection.id, { clip_ids: newClipIds });
      }
    },
    onSuccess: () => {
      toast.success('Collection updated!');
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    }
  });

  const handleShare = async (method) => {
    const shareUrl = `${window.location.origin}?clip=${currentClip.id}`;
    
    if (method === 'link') {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
      await base44.entities.Clip.update(currentClip.id, { 
        shares_count: (currentClip.shares_count || 0) + 1 
      });
      queryClient.invalidateQueries({ queryKey: ['clips'] });
    }
    setShowShareMenu(false);
  };

  const addReaction = useMutation({
    mutationFn: async (emojiData) => {
      const reactions = currentClip.reactions || [];
      const emoji = emojiData.type === 'custom' ? `:${emojiData.name}:` : emojiData.emoji;
      const existingReaction = reactions.find(r => r.emoji === emoji);
      
      let newReactions;
      if (existingReaction) {
        const hasReacted = existingReaction.users.includes(currentUser?.id);
        newReactions = reactions.map(r => {
          if (r.emoji === emoji) {
            return {
              ...r,
              users: hasReacted 
                ? r.users.filter(id => id !== currentUser?.id)
                : [...r.users, currentUser?.id]
            };
          }
          return r;
        }).filter(r => r.users.length > 0);
      } else {
        newReactions = [...reactions, { emoji, users: [currentUser?.id] }];
      }
      
      return base44.entities.Clip.update(currentClip.id, { reactions: newReactions });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] })
  });

  const goNext = () => {
    if (currentIndex < clips.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
      setShowComments(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
      setShowComments(false);
    }
  };

  const handleScroll = (e) => {
    if (e.deltaY > 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const hasLiked = currentClip?.likes?.includes(currentUser?.id);
  const userReactions = (currentClip?.reactions || []).filter(r => 
    r.users.includes(currentUser?.id)
  );

  return (
    <div 
      className="h-full w-full flex items-center justify-center relative perspective-[1200px] overflow-hidden"
      onWheel={handleScroll}
      style={{ perspective: '1200px' }}
    >
      {/* Deck Counter */}
      <div className="absolute top-8 left-0 w-full text-center z-10 pointer-events-none">
        <h2 className="text-red-600 font-black tracking-widest text-xs uppercase opacity-50">
          Media Deck // {currentIndex + 1} of {clips.length}
        </h2>
      </div>

      {/* Main Content Area - 3D Card Stack */}
      <div className="relative w-full max-w-6xl h-full flex items-center justify-center">
        {/* 3D Card Stack */}
        <AnimatePresence mode='wait'>
          {clips.map((clip, index) => {
            const isActive = index === currentIndex;
            if (!isActive && !showComments) {
              if (index < currentIndex - 1 || index > currentIndex + 1) return null;
            }
            if (!isActive && showComments) return null;
            
            const offset = index - currentIndex;
            
            const variants = {
              active: { 
                y: 0, 
                scale: 1, 
                opacity: 1, 
                z: 0, 
                rotateX: 0,
                filter: 'brightness(1)' 
              },
              prev: { 
                y: -600, 
                scale: 0.8, 
                opacity: 0, 
                z: -200, 
                rotateX: 10,
                filter: 'brightness(0.5)' 
              },
              next: { 
                y: 150,
                scale: 0.9, 
                opacity: 0.4, 
                z: -100, 
                rotateX: -10,
                filter: 'brightness(0.3)' 
              }
            };
            
            const state = offset === 0 ? 'active' : offset < 0 ? 'prev' : 'next';
            
            return (
              <motion.div
                key={clip.id}
                initial={false}
                animate={state}
                variants={variants}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className={`absolute w-full h-full flex items-center justify-center ${isActive ? 'pointer-events-auto' : 'pointer-events-none'}`}
                style={{ zIndex: isActive ? 10 : offset < 0 ? 1 : 5 }}
              >
                <div className={`relative flex gap-4 transition-all duration-500 ${showComments ? 'max-w-5xl' : 'max-w-lg'} h-[80vh]`} style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}>
                  <motion.div
                  className={`relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-500 ${showComments ? 'w-[450px]' : 'w-full'}`}
                  style={{ maxHeight: '80vh' }}
                  >
                    {isActive && clip.id === currentClip?.id && (
                      <>
          <video
            ref={videoRef}
            src={currentClip?.video_url}
            className="w-full h-full object-contain cursor-pointer bg-black"
            loop
            autoPlay
            muted={isMuted}
            volume={volume}
            playsInline
            onClick={togglePlay}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.volume = volume;
              }
            }}
          />

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="w-16 h-16 text-white" fill="white" />
            </div>
          )}

          {/* Bottom Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="w-10 h-10 border-2 border-red-500">
                {currentClip?.author_avatar ? (
                  <AvatarImage src={currentClip.author_avatar} />
                ) : (
                  <AvatarFallback className="bg-red-900 text-white">
                    {currentClip?.author_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="font-semibold text-white">{currentClip?.author_name}</span>
            </div>
            {currentClip?.caption && (
              <p className="text-white text-sm">{currentClip.caption}</p>
            )}

            {/* Scrolling Audio Banner */}
            {currentClip?.audio_id && audioMap[currentClip.audio_id] && (
              <div className="mt-2">
                <ScrollingAudioBanner
                  audioTrack={audioMap[currentClip.audio_id]}
                  onClick={() => setFrequencyAudio(audioMap[currentClip.audio_id])}
                />
              </div>
            )}

            {/* Edit button for owner */}
            {currentClip?.author_id === currentUser?.id && onEditClip && (
              <div className="mt-2">
                <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation?.(); onEditClip(currentClip); }}>
                  Edit Post
                </Button>
              </div>
            )}
          </div>

              {/* Side Actions */}
              <div className="absolute right-3 bottom-24 flex flex-col gap-4">
                <motion.button
                  onClick={() => {
                    likeMutation.mutate(currentClip);
                  }}
                  className="flex flex-col items-center"
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div 
                    className={`w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center ${hasLiked ? 'text-red-500' : 'text-white'}`}
                    animate={hasLiked ? { scale: [1, 1.2, 1] } : {}}
                  >
                    <Heart className="w-6 h-6" fill={hasLiked ? 'currentColor' : 'none'} />
                  </motion.div>
                  <span className="text-white text-xs mt-1">{currentClip?.likes?.length || 0}</span>
                </motion.button>
                
                <button 
                  onClick={() => setShowComments(!showComments)}
                  className="flex flex-col items-center"
                >
                  <div className={`w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center ${showComments ? 'text-red-500' : 'text-white'}`}>
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <span className="text-white text-xs mt-1">{currentClip?.comments_count || 0}</span>
                </button>

                <EmojiPicker onEmojiSelect={(emoji) => addReaction.mutate(emoji)} currentUser={currentUser}>
                  <button className="flex flex-col items-center relative">
                    <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center text-white hover:scale-110 transition-transform">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    {userReactions.length > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                        {userReactions.length}
                      </div>
                    )}
                  </button>
                </EmojiPicker>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="flex flex-col items-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center text-white">
                      <Share2 className="w-6 h-6" />
                    </div>
                    <span className="text-white text-xs mt-1">{currentClip?.shares_count || 0}</span>
                  </button>

                  <AnimatePresence>
                    {showShareMenu && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="absolute right-16 top-0 bg-zinc-800 rounded-lg border border-zinc-700 p-2 space-y-1 w-40"
                      >
                        <button
                          onClick={() => {
                            setShowShareWeb(true);
                            setShowShareMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded text-white text-sm"
                        >
                          🕸️ Sling to DMs
                        </button>
                        <button
                          onClick={() => handleShare('link')}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 rounded text-white text-sm"
                        >
                          <Send className="w-4 h-4" />
                          Copy Link
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => saveMutation.mutate()}
                  className="flex flex-col items-center"
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center text-white">
                    <Bookmark className="w-6 h-6" />
                  </div>
                </button>

                {/* Data Disc - spinning audio icon */}
                {currentClip?.audio_id && audioMap[currentClip.audio_id] && (
                  <DataDisc
                    audioTrack={audioMap[currentClip.audio_id]}
                    onOpenFrequency={(track) => setFrequencyAudio(track)}
                  />
                )}

                <div className="relative group/volume">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center text-white"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  
                  {/* Volume Slider */}
                  <div className="absolute right-16 top-0 bg-zinc-800/95 rounded-lg p-3 opacity-0 group-hover/volume:opacity-100 transition-opacity pointer-events-none group-hover/volume:pointer-events-auto">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const newVolume = parseFloat(e.target.value);
                        setVolume(newVolume);
                        setIsMuted(newVolume === 0);
                        if (videoRef.current) {
                          videoRef.current.volume = newVolume;
                        }
                      }}
                      className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${(isMuted ? 0 : volume) * 100}%, #3f3f46 ${(isMuted ? 0 : volume) * 100}%, #3f3f46 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Reactions Display */}
              {currentClip?.reactions && currentClip.reactions.length > 0 && (
                <div className="absolute bottom-20 left-4 flex gap-2 flex-wrap max-w-[60%]">
                  {currentClip.reactions.map((reaction, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-zinc-800/90 rounded-full px-3 py-1 flex items-center gap-1"
                    >
                      <span className="text-lg">{reaction.emoji}</span>
                      <span className="text-white text-xs">{reaction.users.length}</span>
                    </motion.div>
                  ))}
                </div>
              )}
                    </>
                    )}
                  </motion.div>

                  {/* Comments Panel - Slides In */}
                  <AnimatePresence>
                    {isActive && showComments && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ 
                          width: 400, 
                          opacity: 1 
                        }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden flex-shrink-0"
                        style={{ height: '100%' }}
                      >
                        <RichComments clipId={currentClip?.id} currentUser={currentUser} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Share Web Overlay */}
      <AnimatePresence>
        {showShareWeb && (
          <ShareWeb
            isOpen={showShareWeb}
            onClose={() => setShowShareWeb(false)}
            clip={currentClip}
            currentUser={currentUser}
          />
        )}
      </AnimatePresence>

      {/* Frequency Archive */}
      <AnimatePresence>
        {frequencyAudio && (
          <FrequencyArchive
            audioTrack={frequencyAudio}
            onClose={() => setFrequencyAudio(null)}
            currentUser={currentUser}
            onClipClick={() => setFrequencyAudio(null)}
          />
        )}
      </AnimatePresence>

      {/* Progress Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 z-20">
        {clips.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCurrentIndex(idx);
              setIsPlaying(true);
            }}
            className={`h-1 rounded-full transition-all hover:bg-red-400 cursor-pointer ${
              idx === currentIndex ? 'w-6 bg-red-500' : 'w-2 bg-zinc-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function CollectionsView({ collections, selectedCollection, onSelectCollection, currentUser, queryClient, allClips }) {
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);

  const createCollectionMutation = useMutation({
    mutationFn: (name) => base44.entities.Collection.create({
      user_id: currentUser?.id,
      name,
      clip_ids: [],
      is_public: false
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Collection created!');
      setNewCollectionName('');
      setShowNewCollection(false);
    }
  });

  const selectedCollectionData = selectedCollection 
    ? collections.find(c => c.id === selectedCollection)
    : null;

  const collectionClips = selectedCollectionData
    ? allClips.filter(clip => selectedCollectionData.clip_ids?.includes(clip.id))
    : [];

  if (selectedCollection && selectedCollectionData) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <Button
              onClick={() => onSelectCollection(null)}
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white mb-2"
            >
              ← Back to Collections
            </Button>
            <h2 className="text-2xl font-bold text-white">{selectedCollectionData.name}</h2>
            <p className="text-zinc-500 text-sm">{collectionClips.length} clips</p>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          {collectionClips.length === 0 ? (
            <div className="text-center text-zinc-500">
              <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No clips in this collection yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 w-full max-w-5xl">
              {collectionClips.map((clip, i) => (
                <PostCard3D key={clip.id} clip={clip} index={i} isOwner={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Collections</h2>
        <Button
          onClick={() => setShowNewCollection(!showNewCollection)}
          className="bg-red-600 hover:bg-red-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Collection
        </Button>
      </div>

      {showNewCollection && (
        <div className="bg-zinc-900 rounded-lg p-4 mb-6 border border-zinc-800">
          <Input
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createCollectionMutation.mutate(newCollectionName)}
            placeholder="Collection name..."
            className="bg-zinc-800 border-zinc-700 text-white mb-3"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => createCollectionMutation.mutate(newCollectionName)}
              disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              Create
            </Button>
            <Button
              onClick={() => {
                setShowNewCollection(false);
                setNewCollectionName('');
              }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {collections.map((collection) => {
          const clipCount = collection.clip_ids?.length || 0;
          return (
            <motion.button
              key={collection.id}
              onClick={() => onSelectCollection(collection.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 hover:border-red-500 transition-colors text-left"
            >
              <Folder className="w-8 h-8 text-red-500 mb-3" />
              <h3 className="text-white font-semibold mb-1">{collection.name}</h3>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {(collection.clip_ids || []).slice(0,3).map((id, idx) => {
                  const c = allClips.find(ac => ac.id === id);
                  const ar = (c?.style?.ratio || c?.aspect_ratio) === '16:9' ? '16/9' : (c?.style?.ratio || c?.aspect_ratio) === '1:1' ? '1/1' : '9/16';
                  return (
                    <div key={idx} className="relative rounded overflow-hidden bg-zinc-800" style={{ aspectRatio: ar }}>
                      {c?.thumbnail_url ? (
                        <img src={c.thumbnail_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-3 h-3 text-zinc-500" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-zinc-500 text-sm">{clipCount} clips</p>
            </motion.button>
          );
        })}

        {collections.length === 0 && !showNewCollection && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No collections yet. Create one to organize your clips!</p>
          </div>
        )}
      </div>
    </div>
  );
}