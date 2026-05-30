import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserNameplate from './UserNameplate';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Crown, User, Users, ChevronDown, Pencil, Check, X, UserX, Ban, Volume2, VolumeX, PhoneOff, ArrowRight, Settings, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import HolographicProfile from './HolographicProfile';

const defaultRoleTiers = {
  admin: { name: 'The Council', icon: Crown, color: '#dc2626' },
  moderator: { name: 'The Guardians', icon: Shield, color: '#f59e0b' },
  member: { name: 'The Citizens', icon: User, color: '#6b7280' }
};

const statusColors = {
  online: '#10B981',
  offline: '#6B7280',
  idle: '#F59E0B',
  dnd: '#EF4444',
  streaming: '#A855F7'
};

export default function CommunityPanel({ server, currentUser, onSelectUser, chatType = 'server', members: membersProp = null }) {
  const isGroup = chatType === 'group';
  const [expandedTiers, setExpandedTiers] = useState({ admin: true, moderator: true, member: true });
  const [editMode, setEditMode] = useState(false); // role-hierarchy edit (admin)
  const [editingNickname, setEditingNickname] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list(),
  });

  useEffect(() => {
    if (!server?.id) return;
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['voiceSessions', server.id] });
    socket.on('voice:session-changed', refresh);
    return () => socket.off('voice:session-changed', refresh);
  }, [server?.id, queryClient]);

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voiceSessions', server?.id],
    queryFn: () => entities.VoiceSession.filter({ server_id: server.id }),
    enabled: !!server?.id,
  });

  const getProfile = (userId) => profiles.find(p => p.user_id === userId);

  const isOwner = currentUser?.id === server?.owner_id || currentUser?.email === server?.owner_id;
  
  const currentUserRole = server?.members?.find(m => m.user_id === currentUser?.id || m.user_id === currentUser?.email)?.role || 'member';
  const currentUserPermissions = server?.roles?.find(r => r.id === currentUserRole)?.permissions || [];
  const canGiveNicknames = isOwner || currentUserPermissions.includes('give_nicknames');

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, newRole }) => {
      const updatedMembers = server.members.map(m => 
        (m.user_id === memberId) ? { ...m, role: newRole } : m
      );
      return entities.Server.update(server.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    }
  });

  const updateMemberNicknameMutation = useMutation({
    mutationFn: ({ memberId, nickname }) => {
      const updatedMembers = server.members.map(m => 
        (m.user_id === memberId) ? { ...m, nickname: nickname || undefined } : m
      );
      return entities.Server.update(server.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      setEditingNickname(null);
      toast.success('Nickname updated!');
    }
  });

  const kickMemberMutation = useMutation({
    mutationFn: ({ memberId }) => {
      const updatedMembers = server.members.filter(m => m.user_id !== memberId);
      return entities.Server.update(server.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Member kicked!');
    }
  });

  const banMemberMutation = useMutation({
    mutationFn: ({ memberId }) => {
      const updatedMembers = server.members.map(m => 
        m.user_id === memberId ? { ...m, banned: true } : m
      ).filter(m => !m.banned);
      return entities.Server.update(server.id, { 
        members: updatedMembers,
        banned_users: [...(server.banned_users || []), memberId]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Member banned!');
    }
  });

  const muteMemberMutation = useMutation({
    mutationFn: ({ sessionId, isMuted }) => {
      return entities.VoiceSession.update(sessionId, { is_muted: isMuted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Voice state updated!');
    }
  });

  const deafenMemberMutation = useMutation({
    mutationFn: ({ sessionId, isDeafened }) => {
      return entities.VoiceSession.update(sessionId, { is_deafened: isDeafened });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Voice state updated!');
    }
  });

  const disconnectMemberMutation = useMutation({
    mutationFn: ({ sessionId }) => {
      return entities.VoiceSession.delete(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Member disconnected!');
    }
  });

  const moveMemberMutation = useMutation({
    mutationFn: ({ sessionId, channelId }) => {
      return entities.VoiceSession.update(sessionId, { channel_id: channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Member moved!');
    }
  });

  const handleRightClick = (e, member) => {
    e.preventDefault();
    e.stopPropagation();
    
    const canKick = isOwner || currentUserPermissions.includes('kick');
    const canMute = isOwner || currentUserPermissions.includes('mute');
    const canManage = isOwner || currentUserPermissions.includes('manage_channels') || currentUserPermissions.includes('administrator');
    
    // Find if user is in a voice channel
    const memberVoiceSession = voiceSessions.find(s => s.user_id === member.user_id);
    const voiceChannels = server?.channels?.filter(c => c.type === 'voice') || [];
    
    const options = [];
    
    // Nickname
    if (canGiveNicknames) {
      options.push({
        label: '✏️ Change Nickname',
        color: 'text-cyan-400',
        action: () => {
          setEditingNickname(member.user_id);
          setNicknameInput(member.nickname || '');
        }
      });
      options.push({ separator: true });
    }
    
    // Voice controls if in voice
    if (memberVoiceSession) {
      if (canMute) {
        options.push({
          label: memberVoiceSession.is_muted ? '🔊 Unmute' : '🔇 Server Mute',
          color: 'text-blue-400',
          action: () => {
            muteMemberMutation.mutate({ 
              sessionId: memberVoiceSession.id, 
              isMuted: !memberVoiceSession.is_muted 
            });
          }
        });
        
        options.push({
          label: memberVoiceSession.is_deafened ? '👂 Undeafen' : '🙉 Server Deafen',
          color: 'text-purple-400',
          action: () => {
            deafenMemberMutation.mutate({ 
              sessionId: memberVoiceSession.id, 
              isDeafened: !memberVoiceSession.is_deafened 
            });
          }
        });
      }
      
      if (canManage) {
        options.push({
          label: '📞 Disconnect from Voice',
          color: 'text-red-400',
          action: () => {
            disconnectMemberMutation.mutate({ sessionId: memberVoiceSession.id });
          }
        });
        
        // Move to channel submenu
        const otherChannels = voiceChannels.filter(vc => vc.id !== memberVoiceSession.channel_id);
        if (otherChannels.length > 0) {
          options.push({
            label: '📍 Move to Channel ▸',
            color: 'text-green-400',
            submenu: otherChannels.map(vc => ({
              label: `# ${vc.name}`,
              action: () => {
                moveMemberMutation.mutate({ 
                  sessionId: memberVoiceSession.id, 
                  channelId: vc.id 
                });
              }
            }))
          });
        }
      }
      
      options.push({ separator: true });
    }
    
    // Kick & Ban
    if (canKick) {
      options.push({
        label: '🚪 Kick from Server',
        color: 'text-orange-400',
        action: () => {
          if (confirm(`Kick ${member.user_name || member.nickname || 'this member'} from the server?`)) {
            kickMemberMutation.mutate({ memberId: member.user_id });
          }
        }
      });
      
      options.push({
        label: '🔨 Ban Permanently',
        color: 'text-red-500',
        action: () => {
          if (confirm(`Ban ${member.user_name || member.nickname || 'this member'} permanently? They will not be able to rejoin.`)) {
            banMemberMutation.mutate({ memberId: member.user_id });
          }
        }
      });
    }
    
    if (options.length > 0) {
      showContextMenu(e.clientX, e.clientY, options, member);
    }
  };

  const showContextMenu = (x, y, options, member) => {
    // Remove any existing menus
    document.querySelectorAll('[data-context-menu]').forEach(el => el.remove());
    
    const menuElement = document.createElement('div');
    menuElement.setAttribute('data-context-menu', 'true');
    menuElement.className = 'fixed bg-zinc-900/95 border border-red-500/40 rounded-lg shadow-2xl z-[9999] min-w-56 py-2 backdrop-blur-xl';
    menuElement.style.top = y + 'px';
    menuElement.style.left = x + 'px';
    
    // Add header with member name
    if (member) {
      const header = document.createElement('div');
      header.className = 'px-4 py-2 border-b border-zinc-700 mb-1';
      header.innerHTML = `<div class="text-white font-semibold text-sm">${member.nickname || member.user_name}</div>`;
      menuElement.appendChild(header);
    }
    
    options.forEach(opt => {
      if (opt.separator) {
        const separator = document.createElement('div');
        separator.className = 'h-px bg-zinc-700 my-1';
        menuElement.appendChild(separator);
      } else if (opt.submenu) {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';
        
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-4 py-2 ${opt.color || 'text-white'} hover:bg-red-600/20 text-sm flex items-center justify-between group transition-colors`;
        btn.textContent = opt.label;
        
        let submenuElement = null;
        
        btn.onmouseenter = () => {
          // Remove other submenus
          document.querySelectorAll('[data-submenu]').forEach(el => el.remove());
          
          const rect = btn.getBoundingClientRect();
          submenuElement = document.createElement('div');
          submenuElement.setAttribute('data-submenu', 'true');
          submenuElement.className = 'fixed bg-zinc-900/95 border border-red-500/40 rounded-lg shadow-2xl z-[10000] min-w-44 py-1 backdrop-blur-xl';
          submenuElement.style.top = rect.top + 'px';
          submenuElement.style.left = (rect.right + 5) + 'px';
          
          opt.submenu.forEach(subOpt => {
            const subBtn = document.createElement('button');
            subBtn.className = 'w-full text-left px-4 py-2 text-white hover:bg-red-600/20 text-sm transition-colors';
            subBtn.textContent = subOpt.label;
            subBtn.onclick = () => {
              subOpt.action();
              removeAllMenus();
            };
            submenuElement.appendChild(subBtn);
          });
          
          document.body.appendChild(submenuElement);
        };
        
        wrapper.appendChild(btn);
        menuElement.appendChild(wrapper);
      } else {
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-4 py-2.5 ${opt.color || 'text-white'} hover:bg-red-600/20 text-sm transition-colors font-medium`;
        btn.textContent = opt.label;
        btn.onclick = () => {
          opt.action();
          removeAllMenus();
        };
        menuElement.appendChild(btn);
      }
    });
    
    document.body.appendChild(menuElement);
    
    // Adjust position if menu goes off screen
    const rect = menuElement.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuElement.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menuElement.style.top = (y - rect.height) + 'px';
    }
    
    const removeAllMenus = () => {
      document.querySelectorAll('[data-context-menu], [data-submenu]').forEach(el => el.remove());
      document.removeEventListener('click', removeAllMenus);
      document.removeEventListener('contextmenu', removeAllMenus);
    };
    
    setTimeout(() => {
      document.addEventListener('click', removeAllMenus);
      document.addEventListener('contextmenu', removeAllMenus);
    }, 10);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    // Edit mode: reordering role HEADERS (droppableId === 'role-headers').
    if (result.source?.droppableId === 'role-headers') {
      handleRoleReorder(result);
      return;
    }
    // Normal mode: moving a MEMBER between role tiers (owner only).
    if (!isOwner) return;
    const { draggableId, destination } = result;
    const newRole = destination.droppableId;
    const memberId = draggableId;
    updateMemberRoleMutation.mutate({ memberId, newRole });
  };

  // Reorder role headers in edit mode → persist new positions (Patch 1.8).
  const handleRoleReorder = async (result) => {
    if (!isOwner || !result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    // Only explicit server roles are reorderable (default tiers stay below).
    const explicitKeys = orderedRoleKeys.filter(k => (server?.roles || []).some(r => (r.id ?? r.name) === k));
    const reordered = [...explicitKeys];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // Build the new roles array with updated positions, snappy local update.
    const order = reordered.map((roleId, position) => ({ roleId, position }));
    const newRoles = (server.roles || []).map(r => {
      const key = r.id ?? r.name;
      const found = order.find(o => o.roleId === key);
      return found ? { ...r, position: found.position } : r;
    });
    queryClient.setQueryData(['servers'], (old) =>
      Array.isArray(old) ? old.map(s => s.id === server.id ? { ...s, roles: newRoles } : s) : old
    );
    // Persist via the standard update (the reorder endpoint exists too, but
    // Server.update keeps the whole roles array consistent in one call).
    try {
      await entities.Server.update(server.id, { roles: newRoles });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    } catch {
      toast.error('Could not save role order');
    }
  };

  const toggleTier = (tier) => {
    setExpandedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  // Build role tiers dynamically from server roles + defaults
  const roleTiers = {};
  const rolePositions = {}; // roleKey -> position (for hierarchy sorting)
  (server?.roles || []).forEach((role, idx) => {
    // Skip hidden roles
    if (!(server?.hidden_roles || []).includes(role.id)) {
      roleTiers[role.id] = {
        name: role.name,
        icon: Shield,
        color: role.color || '#6b7280'
      };
      // position falls back to array index if not set
      rolePositions[role.id] = typeof role.position === 'number' ? role.position : idx;
    }
  });
  Object.keys(defaultRoleTiers).forEach((key, i) => {
    if (!roleTiers[key] && !(server?.hidden_roles || []).includes(key)) {
      roleTiers[key] = defaultRoleTiers[key];
      // default tiers sort after explicit roles
      rolePositions[key] = 1000 + i;
    }
  });

  // Ordered role keys, highest (lowest position int) first (1.3 sorting).
  const orderedRoleKeys = Object.keys(roleTiers).sort(
    (a, b) => (rolePositions[a] ?? 999) - (rolePositions[b] ?? 999)
  );

  // Place each member ONLY under their highest-ranking role to avoid dupes
  // (Highest Role Display). A member's role string maps to a tier; if it maps
  // to none, they fall into the lowest default tier ('member').
  const membersByRole = {};
  orderedRoleKeys.forEach(roleKey => { membersByRole[roleKey] = []; });
  const seen = new Set();
  // Walk roles highest→lowest; first match wins for each member.
  orderedRoleKeys.forEach(roleKey => {
    (server?.members || []).forEach(m => {
      const uid = m.user_id;
      if (seen.has(uid)) return;
      const memberRole = m.role || 'member';
      if (memberRole === roleKey) { membersByRole[roleKey].push(m); seen.add(uid); }
    });
  });
  // Any member whose role didn't match a tier → drop into 'member' (or first tier).
  const fallbackKey = orderedRoleKeys.includes('member') ? 'member' : orderedRoleKeys[orderedRoleKeys.length - 1];
  (server?.members || []).forEach(m => {
    if (!seen.has(m.user_id) && fallbackKey) { membersByRole[fallbackKey].push(m); seen.add(m.user_id); }
  });

  // ── GROUP CHAT (Patch 2.7): bypass role sorting. Build ONE flat "MEMBERS"
  // tier from the passed-in members array. The group creator (owner_id) is
  // marked so the row can show a crown.
  let groupRoleTiers = roleTiers;
  let groupOrderedKeys = orderedRoleKeys;
  let groupMembersByRole = membersByRole;
  const groupMembers = membersProp || server?.members || [];
  if (isGroup) {
    groupRoleTiers = { members: { name: 'Members', icon: Users, color: '#9ca3af' } };
    groupOrderedKeys = ['members'];
    groupMembersByRole = { members: groupMembers };
  }
  const tiers = isGroup ? groupRoleTiers : roleTiers;
  const tierKeys = isGroup ? groupOrderedKeys : orderedRoleKeys;
  const tierMembers = isGroup ? groupMembersByRole : membersByRole;
  const totalCount = isGroup ? groupMembers.length : (server?.members?.length || 0);

  // For servers we require a server object; groups can render without one.
  if (!isGroup && !server) return null;

  return (
    <div className="w-72 shrink-0 h-full bg-[#0a0a0a] border-l border-red-900/20 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-red-900/20 flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          {isGroup ? `Members (${totalCount})` : `Community (${totalCount})`}
        </h3>
        {isOwner && !isGroup && (
          <button
            onClick={() => setEditMode(e => !e)}
            title={editMode ? 'Done editing hierarchy' : 'Edit Node Hierarchy'}
            className={`p-1.5 rounded-lg transition-colors ${editMode ? 'bg-[#FF3333]/20 text-[#FF3333] shadow-[0_0_10px_rgba(255,51,51,0.4)]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <DragDropContext onDragEnd={handleDragEnd}>
          {editMode ? (
            /* Patch 1.8 — collapsed Edit Mode: only draggable role headers. */
            <Droppable droppableId="role-headers">
              {(dp) => (
                <div ref={dp.innerRef} {...dp.droppableProps} className="p-3 space-y-1.5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#FF3333]/70 px-1 pb-1">Drag to reorder hierarchy</p>
                  {orderedRoleKeys
                    .filter(k => (server?.roles || []).some(r => (r.id ?? r.name) === k))
                    .map((roleKey, index) => {
                      const tier = roleTiers[roleKey];
                      if (!tier) return null;
                      return (
                        <Draggable key={roleKey} draggableId={`hdr-${roleKey}`} index={index}>
                          {(p, snap) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors ${snap.isDragging ? 'bg-white/[0.06] border-[#FF3333]/40' : 'bg-white/[0.02] border-white/5'}`}
                              style={p.draggableProps.style}
                            >
                              <span {...p.dragHandleProps} className="cursor-grab text-zinc-600 hover:text-zinc-300">
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <span className="uppercase tracking-[0.2em] text-[10px] font-bold" style={{ color: `${tier.color}cc` }}>
                                {tier.name}
                              </span>
                              <span className="ml-auto text-[10px] text-zinc-600">{(membersByRole[roleKey] || []).length}</span>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                  {dp.placeholder}
                </div>
              )}
            </Droppable>
          ) : (
          <div className="p-3 space-y-3">
            {tierKeys.map((roleKey) => {
              const tier = tiers[roleKey];
              if (!tier) return null;
              const Icon = tier.icon;
              const members = tierMembers[roleKey] || [];
              
              return (
                <div key={roleKey} className="space-y-2">
                  <button
                    onClick={() => toggleTier(roleKey)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {/* 1.3 — uppercase, heavily letter-spaced role header */}
                      <span className="uppercase tracking-[0.2em] text-[10px] font-bold" style={{ color: `${tier.color}cc` }}>
                        {tier.name}
                      </span>
                      <span className="text-[10px] text-zinc-600">{members.length}</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${expandedTiers[roleKey] ? '' : '-rotate-90'}`} />
                  </button>

                  {expandedTiers[roleKey] && (
                    <Droppable droppableId={roleKey} isDropDisabled={!isOwner}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`space-y-1 min-h-[20px] rounded-lg transition-colors ${
                            snapshot.isDraggingOver ? 'bg-red-900/20' : ''
                          }`}
                        >
                          {members.map((member, index) => {
                            const profile = getProfile(member.user_id);
                            const status = profile?.status || 'offline';
                            
                            return (
                              <Draggable
                                key={member.user_id}
                                draggableId={member.user_id}
                                index={index}
                                isDragDisabled={!isOwner}
                              >
                                {(provided, snapshot) => {
                                  const isOnline = status === 'online' || status === 'away' || status === 'dnd' || status === 'idle';
                                  const apexColor = profile?.apex_features?.thread_skin_color
                                    || profile?.accent_color
                                    || '#dc2626';
                                  return (
                                  <motion.div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onContextMenu={(e) => handleRightClick(e, member)}
                                    className={`relative rounded-xl p-2.5 transition-colors cursor-pointer group overflow-hidden ${
                                      snapshot.isDragging ? 'shadow-lg shadow-red-500/20 bg-white/[0.04]' : 'hover:bg-white/[0.03]'
                                    }`}
                                    style={{ ...provided.draggableProps.style }}
                                    whileHover={{ x: -6, transition: { type: 'spring', stiffness: 300, damping: 15 } }}
                                    layout
                                    onClick={(e) => {
                                      if (!snapshot.isDragging && onSelectUser) {
                                        onSelectUser(member.user_id);
                                      }
                                    }}
                                  >
                                    {/* 1.2 — tension thread to the right edge, fades in on hover */}
                                    <div
                                      className="absolute top-1/2 right-0 h-px w-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                      style={{ background: `linear-gradient(to left, ${apexColor}, transparent)` }}
                                    />
                                    <div className="flex items-center gap-3">
                                     <div className="relative">
                                       {/* 1.1 — online: APEX-colored border + glow; offline: grayscale, no dot */}
                                       <Avatar
                                         className="w-10 h-10"
                                         style={isOnline ? {
                                           border: `2px solid ${apexColor}`,
                                           filter: `drop-shadow(0 0 6px ${apexColor}99)`,
                                         } : {
                                           border: 'none',
                                           filter: 'grayscale(50%)',
                                           opacity: 0.6,
                                         }}
                                       >
                                         {profile?.avatar_url || member.user_avatar ? (
                                           <AvatarImage src={profile?.avatar_url || member.user_avatar} />
                                         ) : (
                                           <AvatarFallback className="bg-zinc-800 text-white">
                                             {(profile?.display_name || member.user_name)?.charAt(0).toUpperCase() || '?'}
                                           </AvatarFallback>
                                         )}
                                       </Avatar>
                                       {/* APEX floating badge (Patch 2.4): custom
                                           badge image if set, else the spider mark. */}
                                       {profile?.apex_tier === 'apex' && (
                                         (profile?.apexBadgeUrl || profile?.apex_features?.apexBadgeUrl) ? (
                                           <div
                                             className="absolute -top-2 -left-2 w-6 h-6 rounded-full z-20 overflow-hidden border border-black/40"
                                             style={{ boxShadow: `0 0 12px ${profile?.apexBadgeGlow || profile?.apex_features?.apexBadgeGlow || '#fb923c'}` }}
                                           >
                                             <img src={profile?.apexBadgeUrl || profile?.apex_features?.apexBadgeUrl} alt="" className="w-full h-full object-cover" />
                                           </div>
                                         ) : (
                                           <div className="absolute -top-1 -left-1 w-4 h-4 bg-gradient-to-br from-yellow-500 to-red-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                                             <span className="text-[8px]">🕷️</span>
                                           </div>
                                         )
                                       )}
                                     </div>
                                      <div className="flex-1 min-w-0">
                                        {editingNickname === member.user_id ? (
                                          <div className="flex gap-1 items-center">
                                            <Input
                                              autoFocus
                                              value={nicknameInput}
                                              onChange={(e) => setNicknameInput(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  updateMemberNicknameMutation.mutate({ memberId: member.user_id, nickname: nicknameInput });
                                                } else if (e.key === 'Escape') {
                                                  setEditingNickname(null);
                                                }
                                              }}
                                              placeholder="Enter nickname"
                                              className="h-6 text-xs bg-zinc-700 border-zinc-600 text-white"
                                            />
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateMemberNicknameMutation.mutate({ memberId: member.user_id, nickname: nicknameInput });
                                              }}
                                            >
                                              <Check className="w-3 h-3 text-green-500" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingNickname(null);
                                              }}
                                            >
                                              <X className="w-3 h-3 text-red-500" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1">
                                            <p className="text-white font-medium text-sm truncate hover:underline">
                                              <UserNameplate
                                                name={member.nickname || profile?.display_name || member.user_name}
                                                style={profile?.apex_tier === 'apex' ? (profile?.apexNameplateStyle || profile?.apex_features?.apexNameplateStyle || 'default') : 'default'}
                                                apexColor={apexColor}
                                              />
                                            </p>
                                            {isGroup && (member.user_id === server?.owner_id || member.user_id === server?.created_by) && (
                                              <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" title="Group creator" style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))' }} />
                                            )}
                                            {canGiveNicknames && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingNickname(member.user_id);
                                                  setNicknameInput(member.nickname || '');
                                                }}
                                                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-zinc-700 rounded"
                                              >
                                                <Pencil className="w-3 h-3 text-zinc-400 hover:text-white" />
                                              </button>
                                            )}
                                            <span className="text-zinc-500 ml-1 opacity-60">
                                              #{profile?.discriminator || '0000'}
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1">
                                          {/* 1.3 — data-transmission style status line */}
                                          <p className="text-xs text-white/50 truncate font-mono">
                                            <span className="text-zinc-600">— </span>
                                            {profile?.custom_status || status}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                  );
                                }}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          {members.length === 0 && (
                            <p className="text-xs text-zinc-500 text-center py-2">No members</p>
                          )}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </DragDropContext>
      </ScrollArea>

    </div>
  );
}
