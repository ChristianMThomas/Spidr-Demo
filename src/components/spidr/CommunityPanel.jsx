import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Crown, User, ChevronDown, Pencil, Check, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

export default function CommunityPanel({ server, currentUser, onSelectUser }) {
  const [expandedTiers, setExpandedTiers] = useState({ admin: true, moderator: true, member: true });
  const [editingNickname, setEditingNickname] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voiceSessions', server?.id],
    queryFn: () => base44.entities.VoiceSession.filter({ server_id: server.id }),
    enabled: !!server?.id,
    refetchInterval: 3000
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
      return base44.entities.Server.update(server.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['servers']);
    }
  });

  const updateMemberNicknameMutation = useMutation({
    mutationFn: ({ memberId, nickname }) => {
      const updatedMembers = server.members.map(m => 
        (m.user_id === memberId) ? { ...m, nickname: nickname || undefined } : m
      );
      return base44.entities.Server.update(server.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['servers']);
      setEditingNickname(null);
      toast.success('Nickname updated!');
    }
  });

  const kickMemberMutation = useMutation({
    mutationFn: ({ memberId }) => {
      const updatedMembers = server.members.filter(m => m.user_id !== memberId);
      return base44.entities.Server.update(server.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['servers']);
      toast.success('Member kicked!');
    }
  });

  const banMemberMutation = useMutation({
    mutationFn: ({ memberId }) => {
      const updatedMembers = server.members.map(m => 
        m.user_id === memberId ? { ...m, banned: true } : m
      ).filter(m => !m.banned);
      return base44.entities.Server.update(server.id, { 
        members: updatedMembers,
        banned_users: [...(server.banned_users || []), memberId]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['servers']);
      toast.success('Member banned!');
    }
  });

  const muteMemberMutation = useMutation({
    mutationFn: ({ sessionId, isMuted }) => {
      return base44.entities.VoiceSession.update(sessionId, { is_muted: isMuted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['voiceSessions']);
      toast.success('Voice state updated!');
    }
  });

  const deafenMemberMutation = useMutation({
    mutationFn: ({ sessionId, isDeafened }) => {
      return base44.entities.VoiceSession.update(sessionId, { is_deafened: isDeafened });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['voiceSessions']);
      toast.success('Voice state updated!');
    }
  });

  const disconnectMemberMutation = useMutation({
    mutationFn: ({ sessionId }) => {
      return base44.entities.VoiceSession.delete(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['voiceSessions']);
      toast.success('Member disconnected!');
    }
  });

  const moveMemberMutation = useMutation({
    mutationFn: ({ sessionId, channelId }) => {
      return base44.entities.VoiceSession.update(sessionId, { channel_id: channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['voiceSessions']);
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
    if (!result.destination || !isOwner) return;

    const { draggableId, destination } = result;
    const newRole = destination.droppableId;
    const memberId = draggableId;

    updateMemberRoleMutation.mutate({ memberId, newRole });
  };

  const toggleTier = (tier) => {
    setExpandedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  // Build role tiers dynamically from server roles + defaults
  const roleTiers = {};
  (server?.roles || []).forEach(role => {
    // Skip hidden roles
    if (!(server?.hidden_roles || []).includes(role.id)) {
      roleTiers[role.id] = {
        name: role.name,
        icon: Shield,
        color: role.color || '#6b7280'
      };
    }
  });
  Object.keys(defaultRoleTiers).forEach(key => {
    if (!roleTiers[key] && !(server?.hidden_roles || []).includes(key)) {
      roleTiers[key] = defaultRoleTiers[key];
    }
  });

  const membersByRole = {};
  Object.keys(roleTiers).forEach(roleKey => {
    membersByRole[roleKey] = server?.members?.filter(m => (m.role || 'member') === roleKey) || [];
  });

  if (!server) return null;

  return (
    <div className="w-72 bg-zinc-900/80 backdrop-blur-xl border-l border-red-900/20 flex flex-col">
      <div className="p-4 border-b border-red-900/20">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          Community ({server.members?.length || 0})
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="p-3 space-y-3">
            {Object.entries(roleTiers).filter(([_, tier]) => tier).map(([roleKey, tier]) => {
              const Icon = tier.icon;
              const members = membersByRole[roleKey] || [];
              
              return (
                <div key={roleKey} className="space-y-2">
                  <button
                    onClick={() => toggleTier(roleKey)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50 backdrop-blur-sm hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: tier.color }} />
                      <span className="font-semibold text-white text-sm">{tier.name}</span>
                      <span className="text-xs text-zinc-500">({members.length})</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${expandedTiers[roleKey] ? '' : '-rotate-90'}`} />
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
                                {(provided, snapshot) => (
                                  <motion.div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onContextMenu={(e) => handleRightClick(e, member)}
                                    className={`glass-light rounded-xl p-3 border border-white/10 transition-all cursor-pointer group hover:bg-white/[0.05] ${
                                      snapshot.isDragging ? 'shadow-lg shadow-red-500/20 scale-105' : ''
                                    }`}
                                    style={{
                                      ...provided.draggableProps.style,
                                      backdropFilter: 'blur(12px)',
                                      WebkitBackdropFilter: 'blur(12px)'
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    layout
                                    onClick={(e) => {
                                      if (!snapshot.isDragging && onSelectUser) {
                                        onSelectUser(member.user_id);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                     <div className="relative">
                                       <Avatar 
                                         className="w-10 h-10 border-2" 
                                         style={{ 
                                           borderColor: profile?.apex_tier === 'apex' && profile?.apex_features?.show_aura 
                                             ? profile?.accent_color || tier.color 
                                             : tier.color,
                                           boxShadow: profile?.apex_tier === 'apex' && profile?.apex_features?.show_aura 
                                             ? `0 0 15px ${profile?.accent_color || tier.color}` 
                                             : 'none'
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
                                       <div 
                                         className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900"
                                         style={{ backgroundColor: statusColors[status] }}
                                       />
                                       {profile?.apex_tier === 'apex' && (
                                         <div className="absolute -top-1 -left-1 w-4 h-4 bg-gradient-to-br from-yellow-500 to-red-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                                           <span className="text-[8px]">🕷️</span>
                                         </div>
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
                                              {member.nickname || profile?.display_name || member.user_name}
                                            </p>
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
                                          <Icon className="w-3 h-3" style={{ color: tier.color }} />
                                          <p className="text-xs text-zinc-400 truncate">
                                            {profile?.custom_status || status}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
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
        </DragDropContext>
      </ScrollArea>

    </div>
  );
}