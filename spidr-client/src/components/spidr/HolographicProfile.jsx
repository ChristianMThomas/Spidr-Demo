import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, MessageCircle, Check, X, UserPlus2, 
  ShieldAlert, UserX 
} from 'lucide-react';
import { toast } from 'sonner';
import ImageCropper from './ImageCropper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SpiderLogo from './SpiderLogo';
import { motion, AnimatePresence } from 'framer-motion';
import ReportModal from './ReportModal';
import ProfileTabs from './profile/ProfileTabs';
import BioTab from './profile/BioTab';
import MutualsTab from './profile/MutualsTab';
import LinksTab from './profile/LinksTab';
import ModulesTab from './profile/ModulesTab';
import { buildUsernameStyle } from '@/lib/usernameStyle';

export default function HolographicProfile({ open, onClose, userId, currentUser, onOpenDM }) {
  const queryClient = useQueryClient();

  const cardRef = useRef(null);

  const [cropImage, setCropImage] = useState(null);
  const [cropType, setCropType] = useState(null);
  const [showAddToServer, setShowAddToServer] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [activeTab, setActiveTab] = useState('bio');

  const isOwnProfile = currentUser?.id === userId;

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: userId });
      if (profiles[0]) return profiles[0];
      const allProfiles = await entities.UserProfile.list();
      return allProfiles.find(p => p.id === userId || p.user_id === userId) || null;
    },
    enabled: !!userId && open
  });

  const { data: friendshipData } = useQuery({
    queryKey: ['friendship', currentUser?.id, userId],
    queryFn: async () => {
      const friendships = await entities.Friend.filter({ user_id: currentUser?.id, friend_id: userId });
      return friendships[0] || null;
    },
    enabled: !!currentUser?.id && !!userId && userId !== currentUser?.id && open
  });

  const { data: servers = [] } = useQuery({
    queryKey: ['user-servers', currentUser?.id],
    queryFn: async () => {
      const allServers = await entities.Server.list();
      return allServers.filter(server =>
        server.owner_id === currentUser?.id ||
        server.members?.some(member => member.user_id === currentUser?.id)
      );
    },
    enabled: !!currentUser?.id && open
  });

  const { data: allFriends = [] } = useQuery({
    queryKey: ['all-friends', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      return await entities.Friend.filter({ user_id: currentUser.id, status: 'accepted' });
    },
    enabled: !!currentUser?.id && open
  });

  const { data: targetUserFriends = [] } = useQuery({
    queryKey: ['target-friends', userId],
    queryFn: async () => {
      if (!userId) return [];
      return await entities.Friend.filter({ user_id: userId, status: 'accepted' });
    },
    enabled: !!userId && open && !isOwnProfile
  });

  const mutualFriends = React.useMemo(() => {
    if (isOwnProfile) return [];
    const myFriendIds = new Set(allFriends.map(f => f.friend_id));
    return targetUserFriends.filter(f => myFriendIds.has(f.friend_id));
  }, [allFriends, targetUserFriends, isOwnProfile]);

  const mutualServers = React.useMemo(() => {
    if (isOwnProfile || !userId) return [];
    return servers.filter(s => s.members?.some(m => m.user_id === userId));
  }, [servers, userId, isOwnProfile]);

  // Mutations
  const sendFriendRequest = useMutation({
    mutationFn: async () => {
      await entities.Friend.create({
        user_id: currentUser?.id, friend_id: userId,
        friend_name: userProfile?.display_name, friend_avatar: userProfile?.avatar_url,
        status: 'pending_outgoing'
      });
      await entities.Friend.create({
        user_id: userId, friend_id: currentUser?.id,
        friend_name: currentUser?.display_name, friend_avatar: currentUser?.avatar_url,
        status: 'pending_incoming'
      });
    },
    onSuccess: () => { toast.success('Friend request sent!'); queryClient.invalidateQueries({ queryKey: ['friendship'] }); queryClient.invalidateQueries({ queryKey: ['friends'] }); }
  });

  const acceptRequest = useMutation({
    mutationFn: async () => {
      await entities.Friend.update(friendshipData.id, { status: 'accepted' });
      const outgoing = await entities.Friend.filter({ user_id: userId, friend_id: currentUser?.id });
      if (outgoing[0]) await entities.Friend.update(outgoing[0].id, { status: 'accepted' });
    },
    onSuccess: () => { toast.success('Friend request accepted!'); queryClient.invalidateQueries({ queryKey: ['friendship'] }); queryClient.invalidateQueries({ queryKey: ['friends'] }); }
  });

  const blockUser = useMutation({
    mutationFn: async () => {
      if (friendshipData) {
        await entities.Friend.update(friendshipData.id, { status: 'blocked' });
      } else {
        await entities.Friend.create({
          user_id: currentUser?.id, friend_id: userId,
          friend_name: userProfile?.display_name, status: 'blocked'
        });
      }
    },
    onSuccess: () => { toast.success('User blocked'); queryClient.invalidateQueries({ queryKey: ['friendship'] }); queryClient.invalidateQueries({ queryKey: ['friends'] }); onClose(); }
  });

  const addToServer = useMutation({
    mutationFn: async () => {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) throw new Error('Server not found in your list');
      if (server.members?.some(m => m.user_id === userId)) {
        throw new Error('User is already a member of this server');
      }
      await entities.Server.update(selectedServerId, {
        members: [
          ...(server.members || []),
          {
            user_id: userId,
            user_name: userProfile?.display_name || 'User',
            user_avatar: userProfile?.avatar_url || '',
            role: 'Member',
          },
        ],
      });
      return server.name;
    },
    onSuccess: (serverName) => {
      toast.success(`Added to ${serverName}!`);
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['user-servers'] });
      setShowAddToServer(false);
      setSelectedServerId('');
    },
    onError: (err) => {
      toast.error(err?.message || 'Could not add user to server');
    },
  });



  // Image uploads
  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'image/gif') {
        try {
          const { url } = await integrations.Core.UploadFile({ file });
          await entities.UserProfile.update(userProfile.id, { banner_url: url });
          queryClient.invalidateQueries({ queryKey: ['userProfile'] });
          toast.success('GIF banner updated!');
        } catch { toast.error('Upload failed'); }
      } else { const r = new FileReader(); r.onload = () => { setCropImage(r.result); setCropType('banner'); }; r.readAsDataURL(file); }
    }
  };
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'image/gif') {
        try {
          const { url } = await integrations.Core.UploadFile({ file });
          await entities.UserProfile.update(userProfile.id, { avatar_url: url });
          queryClient.invalidateQueries({ queryKey: ['userProfile'] });
          toast.success('GIF avatar updated!');
        } catch { toast.error('Upload failed'); }
      } else { const r = new FileReader(); r.onload = () => { setCropImage(r.result); setCropType('avatar'); }; r.readAsDataURL(file); }
    }
  };
  const handleCropComplete = async (file_url) => {
    if (cropType === 'banner') { await entities.UserProfile.update(userProfile.id, { banner_url: file_url }); toast.success('Banner updated!'); }
    else if (cropType === 'avatar') { await entities.UserProfile.update(userProfile.id, { avatar_url: file_url }); toast.success('Avatar updated!'); }
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
    setCropImage(null); setCropType(null);
  };

  const handleWidgetSave = async (key, value) => {
    try {
      const updates = {};
      if (key === 'pronouns') updates.pronouns = value;
      else if (key === 'activity') updates.activity = { ...(userProfile?.activity || {}), name: value };
      const targetId = userProfile?.id;
      if (!targetId) {
        toast.error('Profile not loaded yet — try again in a moment');
        return;
      }
      await entities.UserProfile.update(targetId, updates);
      // The query key is ['userProfile', userId] — invalidate that specifically,
      // then a broader prefix-match to catch every cached profile view.
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-for-chat'] });
      // Broadcast so the shell currentUser also re-syncs.
      window.dispatchEvent(new CustomEvent('spidr-profile-updated', { detail: { profile: updates } }));
      toast.success('Updated!');
    } catch (err) {
      console.error('Widget save failed:', err);
      toast.error(err?.data?.error || err?.message || 'Could not save — try again');
    }
  };

  const handleMessage = () => {
    if (onOpenDM) {
      const conversationId = [currentUser?.id, userId].sort().join('-');
      onOpenDM(userId, conversationId);
    }
    onClose();
  };

  const isApex = userProfile?.apex_tier === 'apex';
  const accentColor = userProfile?.accent_color || '#FF3333';
  const frameStyle = userProfile?.profile_frame || 'default';
  const rawCustomBgUrl = userProfile?.apex_features?.custom_bg_url;
  const validBgUrl = rawCustomBgUrl && rawCustomBgUrl !== 'undefined' ? rawCustomBgUrl : null;
  const customBgUrl = validBgUrl || null;
  const customBgOpacity = (userProfile?.apex_features?.custom_bg_opacity ?? 40) / 100;

  if (!open) return null;

  return (
    <>
      {/* Full-screen backdrop */}
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[720px]">
          <motion.div
            ref={cardRef}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="relative w-full max-w-[720px] mx-auto"
          >
            {/* LAYER 0: Card base background */}
            <div 
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{
                background: 'rgba(10, 10, 10, 0.92)',
                backdropFilter: 'blur(20px)',
                border: `${frameStyle === 'neon' ? '2px solid' : frameStyle === 'double' ? '4px double' : '1px solid'} ${frameStyle === 'neon' ? accentColor : 'rgba(255,255,255,0.08)'}`,
                borderRadius: frameStyle === 'sharp' ? '8px' : '20px',
                boxShadow: frameStyle === 'neon' 
                  ? `0 0 30px ${accentColor}40, 0 50px 100px rgba(0,0,0,0.8)` 
                  : '0 50px 100px rgba(0,0,0,0.8)',
                zIndex: 0,
              }}
            >
              {/* APEX Custom Background Image */}
              {isApex && customBgUrl && (
                <img 
                  src={customBgUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: customBgOpacity, filter: 'saturate(1.2)' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              {isApex && customBgUrl && (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,10,10,0.85) 15%, rgba(10,10,10,0.3) 60%, rgba(10,10,10,0.1) 100%)' }} />
              )}

              {/* Noise texture */}
              <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none" 
                style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />


            </div>

            {/* Close button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* LAYER 0.5: User Banner */}
            <div 
              className="absolute top-0 left-0 right-0 h-52 overflow-hidden pointer-events-none"
              style={{
                borderRadius: frameStyle === 'sharp' ? '8px 8px 0 0' : '20px 20px 0 0',
                zIndex: 1,
              }}
            >
              <div 
                className="w-full h-full relative"
                style={{ 
                  background: userProfile?.banner_url 
                    ? `url(${userProfile.banner_url}) center/cover` 
                    : userProfile?.profile_gradient 
                      ? userProfile.profile_gradient
                      : `linear-gradient(135deg, #dc262680, #7f1d1d80, #0a0a0a)`,
                }}
              />
            </div>
            {/* Banner edit button (own profile only, needs pointer events) */}
            {isOwnProfile && (
              <label 
                className="absolute top-2 right-12 cursor-pointer bg-black/60 hover:bg-black/80 px-2 py-1 rounded-lg text-[10px] text-white transition-colors z-20"
              >
                🖊️ Edit
                <input type="file" hidden onChange={handleBannerUpload} accept="image/*" />
              </label>
            )}

            {/* LAYER 1: Avatar */}
            <div style={{ zIndex: 5 }} className="relative px-10 pt-[140px]">
              <div className="relative w-28 h-28">
                {isApex && (
                  <div className="absolute -inset-1 rounded-2xl blur-md animate-pulse opacity-70"
                    style={{ background: `linear-gradient(135deg, ${accentColor}, #7c3aed)` }} />
                )}
                {userProfile?.avatar_url ? (
                  <img 
                    src={userProfile.avatar_url}
                    className="relative w-full h-full rounded-2xl object-cover bg-zinc-900 border-[3px] shadow-2xl"
                    style={{ borderColor: isApex ? 'transparent' : accentColor + '60', boxShadow: frameStyle === 'neon' ? `0 0 20px ${accentColor}80` : undefined }}
                    alt=""
                    onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                  />
                ) : null}
                <div 
                  className="relative w-full h-full rounded-2xl border-[3px] shadow-2xl bg-gradient-to-br from-red-800 to-red-950 flex items-center justify-center text-white text-4xl font-black select-none"
                  style={{ borderColor: isApex ? 'transparent' : accentColor + '60', display: userProfile?.avatar_url ? 'none' : 'flex' }}
                >
                  {(userProfile?.display_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-[3px] border-[#0a0a0a] rounded-full ${
                  userProfile?.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 
                  userProfile?.status === 'idle' ? 'bg-yellow-500' : 
                  userProfile?.status === 'dnd' ? 'bg-red-500' : 'bg-zinc-600'
                }`} />
                {isOwnProfile && (
                  <label className="absolute -bottom-1 -left-1 bg-[#FF3333] rounded-full w-5 h-5 cursor-pointer flex items-center justify-center text-[10px] shadow-lg hover:scale-110 transition-transform">
                    ✏️
                    <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                )}
                {/* APEX custom frame overlay (4.1) — sits over the avatar. */}
                {userProfile?.apex_features?.frame_url && (
                  <img
                    src={userProfile.apex_features.frame_url}
                    alt=""
                    className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-contain pointer-events-none"
                    style={{ zIndex: 6 }}
                  />
                )}
              </div>
            </div>

            {/* LAYER 2: Identity — @username#tag */}
            <div style={{ zIndex: 5 }} className="relative px-10 mt-4">
              {/* APEX nameplate background (4.1) — sits behind the name row. */}
              {userProfile?.apex_features?.nameplate_url && (
                <div
                  className="absolute inset-x-8 -inset-y-1 rounded-xl overflow-hidden pointer-events-none opacity-80"
                  style={{ zIndex: -1 }}
                >
                  <img src={userProfile.apex_features.nameplate_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/70 to-transparent" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <h2
                  className="text-3xl tracking-tight"
                  style={{
                    // Default size is 3xl + heavy weight, then overridden by user prefs
                    fontWeight: 900,
                    color: isApex ? accentColor : '#fff',
                    ...buildUsernameStyle(userProfile, { fallbackColor: isApex ? accentColor : '#fff' }),
                  }}
                >
                  {userProfile?.display_name || 'User'}
                </h2>
                {isApex && (
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-[#FF3333] to-[#990000] px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-[0_0_12px_rgba(255,51,51,0.5)]">
                    <SpiderLogo size={10} /> APEX
                  </span>
                )}
              </div>
              <div className="text-sm font-mono mt-1">
                <span className="text-gray-500">@</span>
                <span className="text-gray-300 font-bold">{userProfile?.display_name?.toLowerCase().replace(/\s+/g, '_') || 'user'}</span>
                <span className="text-gray-600">#{userId?.slice(0, 4) || '0000'}</span>
              </div>
              {userProfile?.custom_status && (
                <p className="text-[11px] text-gray-500 italic mt-1">{userProfile.custom_status}</p>
              )}
              {!isOwnProfile && mutualFriends.length > 0 && (
                <p className="text-[10px] text-[#FF3333] mt-1">{mutualFriends.length} mutual friend{mutualFriends.length !== 1 ? 's' : ''}</p>
              )}
            </div>

            {/* LAYER 3: Tabbed Content */}
            <div style={{ zIndex: 5 }} className="relative px-10 mt-6">
              <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
              
              <div className="mt-4 h-[280px] overflow-y-auto pr-1">
                <AnimatePresence mode="wait">
                  {activeTab === 'bio' && (
                    <BioTab 
                      userProfile={userProfile} 
                      isOwnProfile={isOwnProfile} 
                      onWidgetSave={handleWidgetSave} 
                    />
                  )}
                  {activeTab === 'mutuals' && (
                    <MutualsTab 
                      mutualServers={mutualServers} 
                      mutualFriends={mutualFriends} 
                    />
                  )}
                  {activeTab === 'modules' && (
                  <ModulesTab userId={userId} isOwnProfile={isOwnProfile} />
                  )}
                  {activeTab === 'links' && (
                    <LinksTab 
                      socialLinks={userProfile?.social_links} 
                      website={userProfile?.website} 
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* LAYER 5: Action Buttons (other users only) */}
            {!isOwnProfile && (
              <div style={{ zIndex: 10 }} className="relative px-10 mt-5 pb-8">
                <ProfileActions 
                  friendshipData={friendshipData}
                  onSendRequest={() => sendFriendRequest.mutate()}
                  onAccept={() => acceptRequest.mutate()}
                  onBlock={() => blockUser.mutate()}
                  onReport={() => setShowReport(true)}
                  onAddToServer={() => setShowAddToServer(true)}
                  onMessage={handleMessage}
                />

                {showAddToServer && (
                  <div
                    className="mt-3 p-3 bg-black/80 border border-white/10 rounded-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-xs font-bold text-white mb-2">Add to Server</div>

                    {servers.length === 0 ? (
                      <div className="py-3 px-2 text-center">
                        <p className="text-[11px] text-zinc-400 mb-2">You're not in any servers yet.</p>
                        <p className="text-[10px] text-zinc-600">Join or create a server first to invite people.</p>
                      </div>
                    ) : (
                      <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                        <SelectTrigger className="bg-black/50 border-red-900/30 text-white text-xs h-8 mb-2">
                          <SelectValue placeholder="Select a server..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-red-900/30 z-[200]">
                          {servers.map(s => {
                            const already = s.members?.some(m => m.user_id === userId);
                            return (
                              <SelectItem
                                key={s.id}
                                value={s.id}
                                disabled={already}
                                className="text-white hover:bg-zinc-800 text-xs data-[disabled]:opacity-50"
                              >
                                {s.name} {already && <span className="text-[10px] text-zinc-500">(already a member)</span>}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => addToServer.mutate()}
                        disabled={!selectedServerId || addToServer.isPending || servers.length === 0}
                        className="flex-1 bg-red-600 hover:bg-red-700 h-8 text-xs disabled:opacity-40"
                      >
                        {addToServer.isPending ? 'Adding…' : 'Add'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setShowAddToServer(false); setSelectedServerId(''); }}
                        className="flex-1 border-red-900/30 h-8 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Own profile bottom padding */}
            {isOwnProfile && <div className="h-8" />}
          </motion.div>
        </div>
      </div>

      <ImageCropper
        open={!!cropImage}
        onClose={() => { setCropImage(null); setCropType(null); }}
        imageSrc={cropImage}
        aspectRatio={cropType === 'banner' ? 16/9 : 1}
        onCropComplete={handleCropComplete}
        title={cropType === 'banner' ? 'Crop Banner' : 'Crop Avatar'}
      />

      {showReport && (
        <ReportModal
          open={showReport}
          onClose={() => setShowReport(false)}
          targetType="user"
          targetId={userId}
          targetName={userProfile?.display_name || userId}
          currentUser={currentUser}
        />
      )}
    </>
  );
}

function ProfileActions({ friendshipData, onSendRequest, onAccept, onBlock, onReport, onAddToServer, onMessage }) {
  if (friendshipData?.status === 'blocked') {
    return <Badge variant="destructive" className="w-full justify-center py-2">Blocked</Badge>;
  }

  if (friendshipData?.status === 'pending_incoming') {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button type="button" onClick={onAccept} className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg cursor-pointer">
            <Check size={14} /> Accept
          </button>
          <button type="button" onClick={onBlock} className="flex-1 py-2.5 bg-black/80 hover:bg-red-900/40 border border-white/10 hover:border-red-500/50 text-gray-400 hover:text-red-500 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer">
            <X size={14} /> Deny
          </button>
        </div>
        <ActionDefensiveRow onBlock={onBlock} onReport={onReport} />
      </div>
    );
  }

  if (friendshipData?.status === 'pending_outgoing') {
    return (
      <div className="space-y-2">
        <div className="py-2.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-xl text-xs font-bold uppercase tracking-widest text-center">
          Signal Sent — Pending
        </div>
        <ActionDefensiveRow onBlock={onBlock} onReport={onReport} />
      </div>
    );
  }

  if (friendshipData?.status === 'accepted') {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button type="button" onClick={onMessage} className="flex-1 py-2.5 bg-white hover:bg-gray-200 text-black rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg cursor-pointer">
            <MessageCircle size={14} /> Message
          </button>
          <button type="button" onClick={onAddToServer} className="flex-1 py-2.5 bg-black/80 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer">
            <UserPlus2 size={14} /> Add to Server
          </button>
        </div>
        <ActionDefensiveRow onBlock={onBlock} onReport={onReport} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" onClick={onSendRequest} className="flex-1 py-2.5 bg-[#FF3333] hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(255,51,51,0.3)] cursor-pointer">
          <UserPlus size={14} /> Link Node
        </button>
        <button type="button" onClick={onMessage} className="flex-1 py-2.5 bg-white hover:bg-gray-200 text-black rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg cursor-pointer">
          <MessageCircle size={14} /> Message
        </button>
      </div>
      <ActionDefensiveRow onBlock={onBlock} onReport={onReport} />
    </div>
  );
}

function ActionDefensiveRow({ onBlock, onReport }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={onBlock} className="py-2 bg-black/60 hover:bg-red-900/30 border border-white/[0.06] hover:border-red-500/40 text-gray-500 hover:text-red-500 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer">
        <UserX size={12} /> Sever (Block)
      </button>
      <button type="button" onClick={onReport} className="py-2 bg-black/60 hover:bg-red-900/30 border border-white/[0.06] hover:border-red-500/40 text-gray-500 hover:text-red-500 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer">
        <ShieldAlert size={12} /> Flag (Report)
      </button>
    </div>
  );
}
