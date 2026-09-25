import React, { useRef, useState, useCallback } from 'react';
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
import ApexBadge from './ApexBadge';
import { motion, AnimatePresence } from 'framer-motion';
import ReportModal from './ReportModal';
import ProfileTabs from './profile/ProfileTabs';
import BioTab from './profile/BioTab';
import MutualsTab from './profile/MutualsTab';
import LinksTab from './profile/LinksTab';
import ModulesTab from './profile/ModulesTab';
import { buildUsernameStyle } from '@/lib/usernameStyle';
import { dmConversationId } from '@/lib/utils';

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

  // The @handle has to be the account's real username. It used to be derived
  // by slugifying display_name, so it silently changed every time someone
  // renamed themselves and never matched the @username Settings shows.
  // UserProfile carries no username field (only username_* styling fields),
  // so it comes off the User record. GET /users/:id is auth-guarded but not
  // owner-restricted, so this resolves for other people's profiles too.
  const { data: account } = useQuery({
    queryKey: ['user-account', userId],
    queryFn: () => entities.User.get(userId),
    enabled: !!userId && open,
    staleTime: 5 * 60 * 1000,
  });

  // Symbiote Profile Takeover (removed): the original Patch 2.0 pushed an
  // APEX user's thread color into the global SymbioteInfectionOverlay state
  // when their profile modal opened, which painted a full-screen gooey blob
  // behind the modal. In practice that overlay dominated the screen and made
  // the profile feel cluttered, so we no longer activate it from this view.
  // The overlay component remains mounted in the shell and reacts to
  // `activeApexProfile`; we just don't set it from here. If we want a more
  // tasteful "presence" cue for APEX profiles later, this is where to wire
  // a softer, contained effect (e.g. a small accent in the modal corner)
  // rather than a viewport-wide takeover.
  // Intentionally no-op.

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

  // ── Server Invite (consent-based) ────────────────────────────────────
  // Previously this immediately appended the target user to the server's
  // members array — invasive. Now we send the target a DirectMessage with
  // is_server_invite + server_invite_data, rendered as an interactive
  // ServerInviteCard in their DM thread. They click Accept to actually
  // join, or Decline to dismiss. The membership write moves to that flow
  // (ServerInviteCard's accept mutation), gated on the target's consent.
  const addToServer = useMutation({
    mutationFn: async () => {
      const server = servers.find(s => s.id === selectedServerId);
      if (!server) throw new Error('Server not found in your list');
      if (server.members?.some(m => m.user_id === userId)) {
        throw new Error('User is already a member of this server');
      }
      if (!currentUser?.id) throw new Error('Not signed in');

      // Send the invite as a DirectMessage. The recipient's DM client
      // sees `is_server_invite=true` and renders ServerInviteCard in
      // place of the normal message body.
      const conversationId = dmConversationId(currentUser.id, userId);
      await entities.DirectMessage.create({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name || currentUser.username,
        sender_avatar: currentUser.avatar_url || '',
        // Schema requires receiver_id; client filters use recipient_id.
        // Sending both matches the pattern in DirectMessages.jsx.
        receiver_id: userId,
        recipient_id: userId,
        content: `🕷️ Invited you to ${server.name}`,
        is_server_invite: true,
        server_invite_data: {
          server_id: server.id,
          server_name: server.name,
          server_icon: server.icon_url || '',
          server_description: server.description || '',
          member_count: (server.members || []).length,
          inviter_id: currentUser.id,
          inviter_name: currentUser.full_name || currentUser.username,
          // Snapshot of the inviter's snapshot of the current member list,
          // used by the accept flow to compute the next members array
          // without a follow-up read (single-write semantics).
          members_snapshot: server.members || [],
        },
      });
      return server.name;
    },
    onSuccess: (serverName) => {
      toast.success(`Invite sent — they'll see it in your DMs.`);
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      setShowAddToServer(false);
      setSelectedServerId('');
    },
    onError: (err) => {
      console.error('[ServerInvite] failed:', err);
      toast.error(err?.message || 'Could not send invite');
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

  const handleWidgetSave = useCallback(async (key, value) => {
    try {
      const updates = {};
      if (key === 'pronouns') updates.pronouns = value;
      else if (key === 'activity') updates.activity = { ...(userProfile?.activity || {}), name: value };
      else if (key === 'timezone') updates.timezone = value;
      else return; // unknown key — don't send empty update
      const targetId = userProfile?.id;
      if (!targetId) {
        toast.error('Profile not loaded yet — try again in a moment');
        return;
      }
      await entities.UserProfile.update(targetId, updates);
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-for-chat'] });
      window.dispatchEvent(new CustomEvent('spidr-profile-updated', { detail: { profile: updates } }));
      if (key !== 'timezone') toast.success('Updated!');
    } catch (err) {
      console.error('Widget save failed:', err);
      toast.error(err?.data?.error || err?.message || 'Could not save — try again');
    }
  }, [userProfile?.id, userProfile?.activity, userId, queryClient]);

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

            {/* LAYER 0.5: User Banner — shorter on small screens so the
                avatar + name area isn't pushed off the top of the viewport. */}
            <div
              className="absolute top-0 left-0 right-0 h-32 sm:h-40 md:h-52 overflow-hidden pointer-events-none"
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

            {/* LAYER 1: Avatar — padding + top offset scale with banner height
                so the overhang against the banner stays consistent at each
                breakpoint. Avatar also shrinks on small screens. */}
            <div style={{ zIndex: 5 }} className="relative px-4 sm:px-6 md:px-10 pt-[80px] sm:pt-[110px] md:pt-[140px]">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28">
                {/* APEX avatar halo — pulsing blurred gradient bloom behind
                    the avatar. Kept; only the screen-wide Symbiote takeover
                    overlay was removed (that was the "blob" complaint). */}
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
            <div style={{ zIndex: 5 }} className="relative px-4 sm:px-6 md:px-10 mt-4">
              {/* NB: APEX nameplate_url is NOT rendered here. It's a list-row
                  personalization (sidebar member list, DM list, group member
                  list, friends list) — not a profile-view treatment. Inside
                  the profile, the user's banner + avatar + accent color
                  already carry their identity; layering the nameplate image
                  on top makes the header read as a "blurry blob" because
                  most nameplates are abstract textures meant to be glanced
                  at behind a tiny username chip. */}
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h2
                  className="text-2xl md:text-3xl min-w-0 break-words max-w-full"
                  style={{
                    // Default size is 3xl + heavy weight, then overridden by user prefs
                    fontWeight: 900,
                    color: isApex ? accentColor : '#fff',
                    ...buildUsernameStyle(userProfile, { fallbackColor: isApex ? accentColor : '#fff' }),
                  }}
                >
                  {userProfile?.display_name || 'User'}
                </h2>
                {isApex && <ApexBadge size="md" />}
              </div>
              <div className="text-sm font-mono mt-1">
                <span className="text-gray-500">@</span>
                <span className="text-gray-300 font-bold">
                  {account?.username || (isOwnProfile ? currentUser?.username : null) || 'user'}
                </span>
                {/* The real tag off the profile — this used to render the first
                    4 chars of the Mongo id (falling back to '0000'), so every
                    profile showed a tag that matched nobody's actual #handle.
                    Render nothing when absent rather than faking one; the
                    server backfills tags via utils/tagService. */}
                {userProfile?.discriminator && (
                  <span className="text-gray-600">#{userProfile.discriminator}</span>
                )}
              </div>
              {userProfile?.custom_status && (
                <p className="text-[11px] text-gray-500 italic mt-1">{userProfile.custom_status}</p>
              )}
              {!isOwnProfile && mutualFriends.length > 0 && (
                <p className="text-[10px] text-[#FF3333] mt-1">{mutualFriends.length} mutual friend{mutualFriends.length !== 1 ? 's' : ''}</p>
              )}
            </div>

            {/* LAYER 3: Tabbed Content */}
            <div style={{ zIndex: 5 }} className="relative px-4 sm:px-6 md:px-10 mt-6">
              <ProfileTabs
                activeTab={isOwnProfile && activeTab === 'mutuals' ? 'bio' : activeTab}
                onTabChange={setActiveTab}
                isOwnProfile={isOwnProfile}
              />

              {/* On <md, content flows with the outer modal scroll so the inner
                  fixed-height pane doesn't double-scroll on a small viewport.
                  On md+ keep the original 280px scrolling pane. */}
              <div className="mt-4 md:h-[280px] md:overflow-y-auto md:pr-1">
                <AnimatePresence mode="wait">
                  {activeTab === 'bio' && (
                    <BioTab 
                      userProfile={userProfile} 
                      isOwnProfile={isOwnProfile} 
                      onWidgetSave={handleWidgetSave}
                      currentUser={currentUser}
                    />
                  )}
                  {activeTab === 'mutuals' && !isOwnProfile && (
                    <MutualsTab
                      mutualServers={mutualServers}
                      mutualFriends={mutualFriends}
                    />
                  )}
                  {activeTab === 'modules' && (
                  /* module_order rides down from the profile record this
                     component already holds, so the tab never re-fetches it. */
                  <ModulesTab userId={userId} isOwnProfile={isOwnProfile} moduleOrder={userProfile?.module_order} />
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
              <div style={{ zIndex: 10 }} className="relative px-4 sm:px-6 md:px-10 mt-5 pb-8">
                <ProfileActions 
                  friendshipData={friendshipData}
                  onSendRequest={() => sendFriendRequest.mutate()}
                  onAccept={() => acceptRequest.mutate()}
                  onBlock={() => blockUser.mutate()}
                  onReport={() => setShowReport(true)}
                  onAddToServer={() => setShowAddToServer(true)}
                  onMessage={handleMessage}
                  onEnterWeb={() => {
                    // Route through the SHELL so this works from ANY page —
                    // the old event only worked if THE WEB was already
                    // mounted, which is why the button felt dead. Lands on
                    // the user's full WEB profile (strands + relays).
                    window.dispatchEvent(new CustomEvent('spidr-open-web-profile', {
                      detail: {
                        userId,
                        userName: userProfile?.full_name || userProfile?.username || 'this user',
                        avatar: userProfile?.avatar_url || '',
                      },
                    }));
                    onClose();
                  }}
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

function ProfileActions({ friendshipData, onSendRequest, onAccept, onBlock, onReport, onAddToServer, onMessage, onEnterWeb }) {
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
        <EnterUserWebButton onClick={onEnterWeb} />
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
        <EnterUserWebButton onClick={onEnterWeb} />
        <ActionDefensiveRow onBlock={onBlock} onReport={onReport} />
      </div>
    );
  }

  if (friendshipData?.status === 'accepted') {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button type="button" onClick={onMessage} className="flex-1 py-2.5 bg-white hover:bg-gray-200 text-black rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg cursor-pointer whitespace-nowrap">
            <MessageCircle size={14} /> Message
          </button>
          <button type="button" onClick={onAddToServer} className="flex-1 py-2.5 bg-black/80 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap">
            <UserPlus2 size={14} />
            <span className="hidden sm:inline">Add to Server</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
        <EnterUserWebButton onClick={onEnterWeb} />
        <ActionDefensiveRow onBlock={onBlock} onReport={onReport} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" onClick={onSendRequest} className="flex-1 py-2.5 bg-[#FF3333] hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(255,51,51,0.3)] cursor-pointer whitespace-nowrap">
          <UserPlus size={14} /> Link Node
        </button>
        <button type="button" onClick={onMessage} className="flex-1 py-2.5 bg-white hover:bg-gray-200 text-black rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg cursor-pointer whitespace-nowrap">
          <MessageCircle size={14} /> Message
        </button>
      </div>
      <EnterUserWebButton onClick={onEnterWeb} />
      <ActionDefensiveRow onBlock={onBlock} onReport={onReport} />
    </div>
  );
}

// ── ENTER USER WEB ──────────────────────────────────────────────────────────
// Primary call-to-action that takes the viewer into this user's personal
// vertical clip feed (an archive of every clip they've published to THE WEB).
// Styled as a secure terminal command — uppercase tracked-out red text on a
// translucent red wash with a sharp border and faint glow. Spans the row to
// give it the visual weight the spec calls for.
function EnterUserWebButton({ onClick }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-8 py-3 rounded-md bg-red-600/10 border border-red-500/40 text-red-500 font-mono text-xs tracking-[0.22em] uppercase hover:bg-red-500 hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.10)] hover:shadow-[0_0_22px_rgba(239,68,68,0.35)] flex items-center justify-center gap-2 cursor-pointer"
    >
      <span className="text-red-400 group-hover:text-white">[</span>
      Enter User Web
      <span className="text-red-400 group-hover:text-white">]</span>
    </button>
  );
}

function ActionDefensiveRow({ onBlock, onReport }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={onBlock} className="py-2 bg-black/60 hover:bg-red-900/30 border border-white/[0.06] hover:border-red-500/40 text-gray-500 hover:text-red-500 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap">
        <UserX size={12} />
        <span className="hidden sm:inline">Sever (Block)</span>
        <span className="sm:hidden">Block</span>
      </button>
      <button type="button" onClick={onReport} className="py-2 bg-black/60 hover:bg-red-900/30 border border-white/[0.06] hover:border-red-500/40 text-gray-500 hover:text-red-500 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap">
        <ShieldAlert size={12} />
        <span className="hidden sm:inline">Flag (Report)</span>
        <span className="sm:hidden">Report</span>
      </button>
    </div>
  );
}
