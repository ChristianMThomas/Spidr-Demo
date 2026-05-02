import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Heart, Bookmark, Grid, Activity, Settings, Upload, Pencil, Trash2, X, Check } from 'lucide-react';
import PostCard3D from './PostCard3D';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function WebProfile({ currentUser, onUploadClick }) {
  const [activeTab, setActiveTab] = useState('strands');
  const [editingClip, setEditingClip] = useState(null);
  const queryClient = useQueryClient();

  const { data: clips = [] } = useQuery({
    queryKey: ['clips'],
    queryFn: () => entities.Clip.list('-created_date', 50),
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', currentUser?.id],
    queryFn: () => entities.Collection.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id
  });

  const { data: profile } = useQuery({
    queryKey: ['current-user-profile', currentUser?.id],
    queryFn: () => entities.UserProfile.filter({ user_id: currentUser?.id }).then(p => p[0]),
    enabled: !!currentUser?.id
  });

  const myStrands = clips.filter(c => c.author_id === currentUser?.id);
  const savedClipIds = collections.find(c => c.name === 'Saved')?.clip_ids || [];
  const cocoons = clips.filter(c => savedClipIds.includes(c.id));
  const resonated = clips.filter(c => c.likes?.includes(currentUser?.id));

  const totalViews = myStrands.reduce((sum, c) => sum + (c.views || 0), 0);
  const totalLikes = myStrands.reduce((sum, c) => sum + (c.likes?.length || 0), 0);

  const displayName = profile?.display_name || currentUser?.full_name || currentUser?.username || 'NODE';
  const avatarSeed = currentUser?.id || 'node';
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`;

  const tabContent = activeTab === 'strands' ? myStrands : activeTab === 'saved' ? cocoons : resonated;

  const updateClipMutation = useMutation({
    mutationFn: ({ id, data }) => entities.Clip.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clips'] });
      setEditingClip(null);
      toast.success('Strand updated!');
    }
  });

  const deleteClipMutation = useMutation({
    mutationFn: (id) => entities.Clip.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clips'] });
      toast.success('Strand deleted.');
    }
  });

  return (
    <div className="flex-1 bg-black text-white h-full overflow-y-auto relative">

      {/* HERO */}
      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF3333]/20 via-black/80 to-black z-0" />
        {profile?.banner_url && (
          <img src={profile.banner_url} className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        {/* Spider web SVG accent */}
        <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" viewBox="0 0 400 200">
          {[0,1,2,3,4,5].map(i => (
            <line key={i} x1="200" y1="100" x2={200 + 200*Math.cos(i*Math.PI/3)} y2={100 + 100*Math.sin(i*Math.PI/3)} stroke="#FF3333" strokeWidth="0.5"/>
          ))}
          {[30,60,90,120].map((r,i) => (
            <circle key={i} cx="200" cy="100" r={r} fill="none" stroke="#FF3333" strokeWidth="0.5"/>
          ))}
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center h-full pt-6">
          <div className="relative w-20 h-20 mb-3 group">
            <div className="absolute inset-0 bg-[#FF3333] rounded-full blur-[16px] opacity-20 group-hover:opacity-40 transition-opacity" />
            <img
              src={avatarUrl}
              className="w-full h-full rounded-full border-2 border-white/10 relative z-10 bg-zinc-900 object-cover"
            />
            <div className="absolute bottom-0 right-0 bg-black rounded-full p-1 border border-white/10 z-20">
              <Settings size={12} className="text-gray-400" />
            </div>
          </div>

          <h1 className="text-xl font-black italic tracking-tighter">{displayName}</h1>
          <div className="text-[10px] font-mono text-[#FF3333] mb-4">NODE_ID: {currentUser?.id?.slice(-8)?.toUpperCase() || 'UNKNOWN'}</div>

          <div className="flex gap-8 text-center">
            <StatItem label="Strands" value={myStrands.length} />
            <StatItem label="Impact" value={totalViews > 1000 ? `${(totalViews/1000).toFixed(1)}K` : totalViews} icon={Activity} />
            <StatItem label="Resonance" value={totalLikes} />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md z-20 border-b border-white/10">
        <div className="flex justify-center gap-10 py-3">
          <TabButton icon={Grid} label="MY STRANDS" active={activeTab === 'strands'} onClick={() => setActiveTab('strands')} />
          <TabButton icon={Bookmark} label="COCOONS" active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} />
          <TabButton icon={Heart} label="RESONANCE" active={activeTab === 'liked'} onClick={() => setActiveTab('liked')} />
        </div>
      </div>

      {/* GRID */}
      <div className="px-4 pb-20 pt-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">

          {/* Upload button - only on strands tab */}
          {activeTab === 'strands' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onUploadClick}
              className="aspect-[9/16] rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 group hover:border-[#FF3333] hover:bg-[#FF3333]/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:bg-[#FF3333] transition-colors text-white">
                <Upload size={18} />
              </div>
              <span className="text-[10px] font-bold text-gray-500 group-hover:text-white uppercase tracking-widest">Weave Strand</span>
            </motion.button>
          )}

          {tabContent.map((clip, i) => (
            <PostCard3D
              key={clip.id}
              clip={clip}
              index={i}
              isOwner={clip.author_id === currentUser?.id}
              onEdit={() => setEditingClip({ ...clip })}
              onDelete={() => {
                if (window.confirm('Delete this strand permanently?')) {
                  deleteClipMutation.mutate(clip.id);
                }
              }}
            />
          ))}

          {tabContent.length === 0 && activeTab !== 'strands' && (
            <div className="col-span-full text-center py-12 text-zinc-600">
              <p className="text-sm font-mono">{activeTab === 'saved' ? 'No cocoons yet. Save clips to build your archive.' : 'No resonance yet. Like clips to track them here.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {editingClip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setEditingClip(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="font-black italic tracking-tight text-[#FF3333]">EDIT STRAND</h2>
                <button onClick={() => setEditingClip(null)} className="text-zinc-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Thumbnail preview */}
                {editingClip.thumbnail_url && (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                    <img src={editingClip.thumbnail_url} className="w-full h-full object-cover opacity-70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play size={32} className="text-white/50" fill="currentColor" />
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Caption</label>
                  <Textarea
                    value={editingClip.caption || ''}
                    onChange={(e) => setEditingClip(prev => ({ ...prev, caption: e.target.value }))}
                    placeholder="Describe your strand..."
                    className="bg-zinc-800 border-zinc-700 text-white resize-none h-20"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Hashtags (comma separated)</label>
                  <Input
                    value={(editingClip.hashtags || []).join(', ')}
                    onChange={(e) => setEditingClip(prev => ({
                      ...prev,
                      hashtags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    }))}
                    placeholder="#gaming, #tech, #vibes"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1 bg-[#FF3333] hover:bg-[#cc0000]"
                    onClick={() => updateClipMutation.mutate({
                      id: editingClip.id,
                      data: { caption: editingClip.caption, hashtags: editingClip.hashtags }
                    })}
                    disabled={updateClipMutation.isPending}
                  >
                    <Check size={14} className="mr-1" /> Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingClip(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatItem({ label, value, icon: Icon }) {
  return (
    <div className="flex flex-col items-center group cursor-default">
      <div className="text-lg font-black text-white group-hover:text-[#FF3333] transition-colors flex items-center gap-1">
        {Icon && <Icon size={12} className="text-[#FF3333]" />}
        {value}
      </div>
      <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{label}</div>
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 transition-colors ${active ? 'text-white' : 'text-gray-500 hover:text-white'}`}
    >
      <Icon size={18} className={active ? 'text-[#FF3333]' : ''} />
      <span className="text-[9px] font-bold tracking-widest">{label}</span>
      {active && (
        <motion.div
          layoutId="nodeActiveTab"
          className="absolute -bottom-3 w-10 h-0.5 bg-[#FF3333] rounded-t-full shadow-[0_0_8px_#FF3333]"
        />
      )}
    </button>
  );
}

// Display helpers for non-destructive styling
function getRatioClass(ratio) {
  switch (ratio) {
    case '9:16': return 'aspect-[9/16]';
    case '16:9': return 'aspect-[16/9] col-span-2';
    case '1:1': return 'aspect-square';
    default: return 'aspect-[9/16]';
  }
}
function getFilterClass(filter) {
  switch (filter) {
    case 'venom': return 'contrast-125 brightness-110 hue-rotate-90';
    case 'glitch': return 'contrast-150 saturate-200 hue-rotate-15';
    case 'noir': return 'grayscale contrast-125 brightness-90';
    case 'neon': return 'hue-rotate-[280deg] saturate-150 contrast-110';
    case 'heat': return 'sepia contrast-125 saturate-150';
    case 'ice': return 'hue-rotate-180 saturate-75 brightness-110 contrast-110';
    default: return '';
  }
}

function StrandCard({ clip, index, isOwner, onEdit, onDelete }) {
  const ratio = clip.style?.ratio || clip.meta?.ratio || clip.aspect_ratio || '9:16';
  const filter = clip.style?.filter || clip.meta?.filter || 'none';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`relative bg-[#111] rounded-xl overflow-hidden cursor-pointer group border border-transparent hover:border-white/20 ${getRatioClass(ratio)}`}
    >
      {clip.thumbnail_url ? (
        <img src={clip.thumbnail_url} className={`w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity ${getFilterClass(filter)}`} />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center ${getFilterClass(filter)}`}>
          <Play size={24} className="text-zinc-600" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
        <div className="flex items-center gap-1 text-white text-xs font-bold">
          <Play size={10} fill="currentColor" /> {clip.views || 0}
        </div>
        {clip.likes?.length > 0 && (
          <div className="flex items-center gap-1 text-red-400 text-xs">
            <Heart size={10} fill="currentColor" /> {clip.likes.length}
          </div>
        )}
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-[#FF3333] transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-700 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
