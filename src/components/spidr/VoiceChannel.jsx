import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Volume2, VolumeX, Settings, Music, Tv, Film,
  Send, Loader2, MonitorUp, Zap
} from 'lucide-react';
import CallAVControls from './CallAVControls';
import { toast } from 'sonner';
import SpiderLogo from './SpiderLogo';
import { playSound } from './SoundEngine';
import StreamSelector from './StreamSelector';
import CinemaStage from './CinemaStage';
import { useScreenShare } from './useScreenShare';
import { useSpidrVoice } from './SpidrVoice';
import SpidrVoiceVisualizer from './SpidrVoice';
import SpidrAIProfile, { SPIDR_AI_AVATAR } from './SpidrAIProfile';

export default function VoiceChannel({ server, channel, currentUser, onLeave }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [showAVControls, setShowAVControls] = useState(false);
  const [showStreamSelector, setShowStreamSelector] = useState(false);
  const [squadOverclock, setSquadOverclock] = useState(false);
  const [showSpidrProfile, setShowSpidrProfile] = useState(false);
  const { stream, isSharing, startShare, stopShare } = useScreenShare();
  const spidrVoice = useSpidrVoice();

  const queryClient = useQueryClient();

  const { data: currentProfile } = useQuery({
    queryKey: ['current-user-profile', currentUser?.id],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id
  });

  const isApexUser = currentProfile?.apex_tier === 'apex';
  const threadSkin = currentProfile?.apex_features?.thread_skin || 'default';

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voiceSessions', server.id, channel.id],
    queryFn: () => base44.entities.VoiceSession.filter({
      server_id: server.id,
      channel_id: channel.id
    }),
    refetchInterval: 5000
  });

  // Real-time subscription for instant session updates
  useEffect(() => {
    const unsubscribe = base44.entities.VoiceSession.subscribe((event) => {
      const data = event.data;
      if (data?.server_id === server.id && data?.channel_id === channel.id) {
        queryClient.invalidateQueries({ queryKey: ['voiceSessions', server.id, channel.id] });
      }
      // Also invalidate on delete events
      if (event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['voiceSessions', server.id, channel.id] });
      }
    });
    return () => unsubscribe();
  }, [server.id, channel.id, queryClient]);

  const currentUserMember = server?.members?.find(m => m.user_id === currentUser?.id || m.user_id === currentUser?.email);
  const currentUserRole = currentUserMember?.role || 'member';
  const isOwner = currentUser?.id === server?.owner_id || currentUser?.email === server?.owner_id;
  const currentUserPermissions = server?.roles?.find(r => r.id === currentUserRole)?.permissions || [];
  const canKick = isOwner || currentUserPermissions.includes('kick');
  const canMute = isOwner || currentUserPermissions.includes('mute');
  const canManage = isOwner || currentUserPermissions.includes('manage_channels') || currentUserPermissions.includes('administrator');
  const canGiveNicknames = isOwner || currentUserPermissions.includes('give_nicknames');

  const joinMutation = useMutation({
    mutationFn: (data) => base44.entities.VoiceSession.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voiceSessions'] })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VoiceSession.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voiceSessions'] })
  });

  const leaveMutation = useMutation({
    mutationFn: (id) => base44.entities.VoiceSession.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      onLeave();
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
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Nickname updated!');
    }
  });

  const kickMemberMutation = useMutation({
    mutationFn: ({ memberId }) => {
      const updatedMembers = server.members.filter(m => m.user_id !== memberId);
      return base44.entities.Server.update(server.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Member kicked!');
    }
  });

  const banMemberMutation = useMutation({
    mutationFn: ({ memberId }) => {
      const updatedMembers = server.members.filter(m => m.user_id !== memberId);
      return base44.entities.Server.update(server.id, { 
        members: updatedMembers,
        banned_users: [...(server.banned_users || []), memberId]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Member banned!');
    }
  });

  const muteMemberMutation = useMutation({
    mutationFn: ({ sessionId, isMuted }) => {
      return base44.entities.VoiceSession.update(sessionId, { is_muted: isMuted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Voice state updated!');
    }
  });

  const deafenMemberMutation = useMutation({
    mutationFn: ({ sessionId, isDeafened }) => {
      return base44.entities.VoiceSession.update(sessionId, { is_deafened: isDeafened });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Voice state updated!');
    }
  });

  const disconnectMemberMutation = useMutation({
    mutationFn: ({ sessionId }) => {
      return base44.entities.VoiceSession.delete(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Member disconnected!');
    }
  });

  const moveMemberMutation = useMutation({
    mutationFn: ({ sessionId, channelId }) => {
      return base44.entities.VoiceSession.update(sessionId, { channel_id: channelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
      toast.success('Member moved!');
    }
  });

  const handleRightClick = (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (session.is_spidr_ai || session.user_id === currentUser?.id) return;
    
    const member = server?.members?.find(m => m.user_id === session.user_id);
    if (!member) return;
    
    const voiceChannels = server?.channels?.filter(c => c.type === 'voice') || [];
    const options = [];
    
    // Nickname
    if (canGiveNicknames) {
      options.push({
        label: '✏️ Change Nickname',
        color: 'text-cyan-400',
        action: () => {
          const nickname = prompt(`Enter nickname for ${member.user_name}:`, member.nickname || '');
          if (nickname !== null) {
            updateMemberNicknameMutation.mutate({ memberId: member.user_id, nickname });
          }
        }
      });
      options.push({ separator: true });
    }
    
    // Voice controls
    if (canMute) {
      options.push({
        label: session.is_muted ? '🔊 Unmute' : '🔇 Server Mute',
        color: 'text-blue-400',
        action: () => {
          muteMemberMutation.mutate({ sessionId: session.id, isMuted: !session.is_muted });
        }
      });
      
      options.push({
        label: session.is_deafened ? '👂 Undeafen' : '🙉 Server Deafen',
        color: 'text-purple-400',
        action: () => {
          deafenMemberMutation.mutate({ sessionId: session.id, isDeafened: !session.is_deafened });
        }
      });
    }
    
    if (canManage) {
      options.push({
        label: '📞 Disconnect from Voice',
        color: 'text-red-400',
        action: () => {
          disconnectMemberMutation.mutate({ sessionId: session.id });
        }
      });
      
      // Move to channel submenu
      const otherChannels = voiceChannels.filter(vc => vc.id !== session.channel_id);
      if (otherChannels.length > 0) {
        options.push({
          label: '📍 Move to Channel ▸',
          color: 'text-green-400',
          submenu: otherChannels.map(vc => ({
            label: `# ${vc.name}`,
            action: () => {
              moveMemberMutation.mutate({ sessionId: session.id, channelId: vc.id });
            }
          }))
        });
      }
    }
    
    // Kick & Ban
    if (canKick) {
      options.push({ separator: true });
      options.push({
        label: '🚪 Kick from Server',
        color: 'text-orange-400',
        action: () => {
          if (confirm(`Kick ${member.user_name || 'this member'} from the server?`)) {
            kickMemberMutation.mutate({ memberId: member.user_id });
          }
        }
      });
      
      options.push({
        label: '🔨 Ban Permanently',
        color: 'text-red-500',
        action: () => {
          if (confirm(`Ban ${member.user_name || 'this member'} permanently?`)) {
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
    document.querySelectorAll('[data-context-menu]').forEach(el => el.remove());
    
    const menuElement = document.createElement('div');
    menuElement.setAttribute('data-context-menu', 'true');
    menuElement.className = 'fixed bg-zinc-900/95 border border-red-500/40 rounded-lg shadow-2xl z-[9999] min-w-56 py-2 backdrop-blur-xl';
    menuElement.style.top = y + 'px';
    menuElement.style.left = x + 'px';
    
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
        btn.className = `w-full text-left px-4 py-2.5 ${opt.color || 'text-white'} hover:bg-red-600/20 text-sm transition-colors font-medium`;
        btn.textContent = opt.label;
        
        let submenuElement = null;
        
        btn.onmouseenter = () => {
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

  const [showCinema, setShowCinema] = useState(true);
  const mySession = voiceSessions.find(s => s.user_id === currentUser?.id);
  const aiSession = voiceSessions.find(s => s.is_spidr_ai);

  // Auto-remove Spidr AI if it's the only one left in the channel
  useEffect(() => {
    if (!aiSession) return;
    const humanSessions = voiceSessions.filter(s => !s.is_spidr_ai);
    if (humanSessions.length === 0) {
      base44.entities.VoiceSession.delete(aiSession.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
    }
  }, [voiceSessions.length, aiSession?.id]);

  const hasJoinedRef = React.useRef(false);
  const channelIdRef = React.useRef(channel.id);
  
  // Track channel changes
  useEffect(() => {
    channelIdRef.current = channel.id;
  }, [channel.id]);

  // Join on mount, cleanup on unmount
  useEffect(() => {
    if (!currentUser) return;
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    playSound('join');
    
    // Clean up any stale sessions for this user in this server, then create fresh
    base44.entities.VoiceSession.filter({
      server_id: server.id,
      user_id: currentUser.id
    }).then(existing => {
      return Promise.all(existing.map(s => base44.entities.VoiceSession.delete(s.id).catch(() => {})));
    }).then(() => {
      return joinMutation.mutateAsync({
        server_id: server.id,
        channel_id: channel.id,
        user_id: currentUser.id,
        user_name: currentUser.full_name || currentUser.email,
        user_avatar: currentUser.avatar_url,
        is_muted: false,
        is_deafened: false,
        is_video_on: false,
        is_screen_sharing: false
      });
    }).catch(() => {});

    // Auto-leave on unmount (e.g. navigating away)
    return () => {
      base44.entities.VoiceSession.filter({
        server_id: server.id,
        user_id: currentUser.id
      }).then(sessions => {
        return Promise.all(sessions.map(s => base44.entities.VoiceSession.delete(s.id).catch(() => {})));
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
        queryClient.invalidateQueries({ queryKey: ['voice-sessions'] });
      }).catch(() => {});
    };
  }, [currentUser?.id]);

  const handleLeave = async () => {
    playSound('leave');
    // Stop screen share if active
    if (isSharing) stopShare();
    // Clean up ALL sessions for this user in this server (handles stale duplicates)
    const allSessions = await base44.entities.VoiceSession.filter({
      server_id: server.id,
      user_id: currentUser?.id
    });
    await Promise.all(allSessions.map(s => base44.entities.VoiceSession.delete(s.id).catch(() => {})));
    queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
    queryClient.invalidateQueries({ queryKey: ['voice-sessions'] });
    hasJoinedRef.current = false;
    onLeave();
  };

  const toggleMute = () => {
    playSound('toggle');
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (mySession) {
      updateMutation.mutate({ id: mySession.id, data: { is_muted: newMuted } });
    }
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    // Deafening also mutes
    if (newDeafened && !isMuted) {
      setIsMuted(true);
    }
    if (mySession) {
      updateMutation.mutate({ 
        id: mySession.id, 
        data: { 
          is_deafened: newDeafened,
          ...(newDeafened ? { is_muted: true } : {})
        } 
      });
    }
  };

  const toggleVideo = () => {
    const newVideoState = !isVideoOn;
    setIsVideoOn(newVideoState);
    if (mySession) {
      updateMutation.mutate({ id: mySession.id, data: { is_video_on: newVideoState } });
    }
    toast.success(newVideoState ? 'Camera on' : 'Camera off');
  };

  const handleStartStream = async (sourceId) => {
    setShowStreamSelector(false);
    const mediaStream = await startShare(sourceId);
    if (mediaStream && mySession) {
      setIsScreenSharing(true);
      updateMutation.mutate({ id: mySession.id, data: { is_screen_sharing: true } });
    }
  };

  const handleStopStream = () => {
    stopShare();
    setIsScreenSharing(false);
    if (mySession) {
      updateMutation.mutate({ id: mySession.id, data: { is_screen_sharing: false } });
    }
  };

  const invokeSpidrAI = async (action) => {
    setIsAILoading(true);
    
    // Ensure AI session exists
    const ensureAISession = async () => {
      const existing = await base44.entities.VoiceSession.filter({
        server_id: server.id,
        is_spidr_ai: true
      });
      if (existing.length > 0) return existing[0];
      return await base44.entities.VoiceSession.create({
        server_id: server.id,
        channel_id: channel.id,
        user_id: 'spidr-ai',
        user_name: 'SPIDR_AI',
        user_avatar: SPIDR_AI_AVATAR,
        is_spidr_ai: true,
        is_muted: false
      });
    };

    try {
      const session = await ensureAISession();

      if (action === 'custom') {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are Spidr AI, a chill, friendly AI buddy in a voice channel on Spidr. You sound like a cool guy in his 20s — casual, warm, approachable. Use contractions and natural speech. Keep responses under 200 characters. The user asks: "${aiPrompt}"`,
          response_json_schema: {
            type: 'object',
            properties: { answer: { type: 'string' } }
          }
        });
        const answer = result.answer || 'Hmm, my bad — try asking again!';
        toast.success(answer);
        spidrVoice.speak(answer);
      } else if (action === 'music' || action === 'video' || action === 'movie') {
        const url = prompt(`Enter a YouTube or Twitch URL to ${action === 'music' ? 'play' : 'stream'}:`);
        if (url) {
          await base44.entities.VoiceSession.update(session.id, {
            stream_url: url,
            channel_id: channel.id
          });
          setShowCinema(true);
          toast.success('Spidr AI is streaming! Cinema mode activated.');
        }
      }

      setAIPrompt('');
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
    } catch (err) {
      console.error('Spidr AI error:', err);
      toast.error('Failed to invoke Spidr AI');
    }
    setIsAILoading(false);
  };

  const kickAI = async () => {
    // Remove all AI sessions in this server to be safe
    const aiSessions = await base44.entities.VoiceSession.filter({
      server_id: server.id,
      is_spidr_ai: true
    });
    for (const s of aiSessions) {
      await base44.entities.VoiceSession.delete(s.id).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
    queryClient.invalidateQueries({ queryKey: ['voice-sessions'] });
    toast.success('Spidr AI left the channel');
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 relative">
      {/* Cinema Stage when AI is streaming */}
      <AnimatePresence>
        {aiSession?.stream_url && showCinema && (
          <CinemaStage
            streamUrl={aiSession.stream_url}
            streamType={aiSession.stream_url?.includes('twitch') ? 'twitch' : aiSession.stream_url?.includes('youtu') ? 'youtube' : 'video'}
            onClose={() => setShowCinema(false)}
            voiceSessions={voiceSessions}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-red-900/20">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-green-500" />
          <span className="font-semibold text-white">{channel.name}</span>
          <span className="text-xs text-zinc-500">• {voiceSessions.length} connected</span>
        </div>
        <div className="flex items-center gap-2">
          {aiSession?.stream_url && !showCinema && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCinema(true)}
              className="text-[#FF3333] hover:text-white bg-[#FF3333]/10"
            >
              <Tv className="w-4 h-4 mr-1" />
              <span className="text-xs">Open Stream</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAIPanel(!showAIPanel)}
            className="text-zinc-400 hover:text-white"
          >
            <SpiderLogo size={20} />
            <span className="ml-2">Spidr AI</span>
          </Button>
        </div>
      </div>

      {/* Stream Selector Modal */}
      <StreamSelector 
        isOpen={showStreamSelector} 
        onClose={() => setShowStreamSelector(false)} 
        onStartStream={handleStartStream}
      />

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Participants */}
        <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start overflow-y-auto relative">
          
          {/* Screen Share Preview */}
          {isSharing && stream && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="col-span-2 md:col-span-3 lg:col-span-4 aspect-video rounded-xl overflow-hidden border-2 border-[#FF3333] bg-black relative shadow-2xl"
            >
              <video 
                ref={video => { if (video && stream) video.srcObject = stream }} 
                autoPlay 
                muted 
                className="w-full h-full object-contain" 
              />
              <div className="absolute top-2 left-2 bg-[#FF3333] text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse flex items-center gap-2">
                🔴 YOU ARE STREAMING
              </div>
              <button
                onClick={handleStopStream}
                className="absolute top-2 right-2 bg-black/80 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Stop Stream
              </button>
            </motion.div>
          )}
          {squadOverclock && (
            <div className="col-span-full mb-2 px-4 py-2 bg-yellow-500 text-black text-xs font-black rounded-full text-center animate-pulse">
              ⚡ SQUAD OVERCLOCK: 4K/60FPS ENABLED
            </div>
          )}

          <AnimatePresence>
            {voiceSessions.map((session) => {
              const sessionProfile = profiles.find(p => p.user_id === session.user_id);
              const sessionThreadSkin = sessionProfile?.apex_features?.thread_skin || 'default';
              
              const threadStyles = {
                default: 'border-zinc-700',
                rgb: 'border-2 border-transparent bg-gradient-to-r from-red-500 via-green-500 to-blue-500 bg-clip-border',
                venom: 'border-2 border-transparent bg-gradient-to-r from-purple-600 to-black bg-clip-border',
                glitch: 'border-2 border-[#00ff00] shadow-[0_0_10px_rgba(0,255,0,0.8)]',
                invisible: 'border border-white/10'
              };

              const borderClass = session.is_spidr_ai 
                ? 'border-red-500/50' 
                : threadStyles[sessionThreadSkin] || threadStyles.default;

              return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onContextMenu={(e) => handleRightClick(e, session)}
                className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer hover:border-red-500/30 transition-colors ${
                  session.is_video_on || session.is_screen_sharing 
                    ? 'bg-zinc-800' 
                    : 'bg-gradient-to-br from-zinc-800 to-zinc-900'
                } ${borderClass}`}
              >
                {session.is_video_on || session.is_screen_sharing ? (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-500 text-sm">
                      {session.is_screen_sharing ? 'Screen sharing...' : 'Video active'}
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center relative">
                    {/* Hanging Thread */}
                    {sessionProfile?.apex_tier === 'apex' && sessionThreadSkin !== 'invisible' && (
                      <div 
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-8 opacity-60"
                        style={{
                          background: sessionThreadSkin === 'rgb' 
                            ? 'linear-gradient(180deg, #ef4444, #22c55e, #3b82f6)'
                            : sessionThreadSkin === 'venom'
                            ? 'linear-gradient(180deg, #9333ea, #000)'
                            : sessionThreadSkin === 'glitch'
                            ? '#00ff00'
                            : '#999',
                          animation: 'thread-sway 3s ease-in-out infinite',
                          boxShadow: sessionThreadSkin === 'glitch' ? '0 0 5px #00ff00' : 'none'
                        }}
                      />
                    )}
                    {session.is_spidr_ai ? (
                      <div 
                        className="flex flex-col items-center gap-2 cursor-pointer"
                        onClick={() => setShowSpidrProfile(true)}
                      >
                        <img 
                          src={SPIDR_AI_AVATAR} 
                          className="w-16 h-16 rounded-full border-2 border-red-500 object-cover"
                          style={{ boxShadow: '0 0 20px rgba(255, 51, 51, 0.5)' }}
                          alt="Spidr AI"
                        />
                        <SpidrVoiceVisualizer isSpeaking={spidrVoice.isSpeaking} />
                      </div>
                    ) : (
                      <div 
                        className="w-16 h-16 rounded-full bg-red-900 flex items-center justify-center text-white text-2xl font-bold border-2"
                        style={{
                          borderColor: sessionProfile?.apex_tier === 'apex' && sessionProfile?.apex_features?.show_aura
                            ? sessionProfile?.accent_color || '#dc2626'
                            : '#991b1b',
                          boxShadow: sessionProfile?.apex_tier === 'apex' && sessionProfile?.apex_features?.show_aura
                            ? `0 0 20px ${sessionProfile?.accent_color || '#dc2626'}`
                            : 'none'
                        }}
                      >
                        {session.user_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                <style>{`
                  @keyframes thread-sway {
                    0%, 100% { transform: translateX(-50%) rotate(-2deg); }
                    50% { transform: translateX(-50%) rotate(2deg); }
                  }
                `}</style>

                {/* Status indicators */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <span className={`text-sm font-medium px-2 py-0.5 rounded flex items-center gap-1 ${
                    session.is_spidr_ai ? 'bg-red-600 text-white' : 'bg-black/50 text-white'
                  }`}>
                    {session.user_name}
                    {squadOverclock && <span className="text-yellow-400">⚡</span>}
                  </span>
                  <div className="flex gap-1">
                    {session.is_muted && <MicOff className="w-4 h-4 text-red-500" />}
                    {session.is_deafened && <VolumeX className="w-4 h-4 text-red-500" />}
                  </div>
                </div>

                {/* Speaking indicator */}
                {!session.is_muted && (
                  <div className="absolute inset-0 border-2 border-green-500 rounded-xl animate-pulse opacity-0 hover:opacity-100 transition-opacity" />
                )}
              </motion.div>
            );
            })}
          </AnimatePresence>
        </div>

        {/* AI Panel */}
        <AnimatePresence>
          {showAIPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-red-900/20 bg-zinc-800/50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-red-900/20">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <SpiderLogo size={24} />
                  Spidr AI Controls
                </h3>
              </div>

              <div className="flex-1 p-4 space-y-3">
                <p className="text-xs text-zinc-500">Quick Actions</p>
                
                <Button
                  onClick={() => invokeSpidrAI('music')}
                  className="w-full justify-start bg-zinc-700 hover:bg-zinc-600"
                  disabled={isAILoading}
                >
                  <Music className="w-4 h-4 mr-2" />
                  Play Music
                </Button>
                
                <Button
                  onClick={() => invokeSpidrAI('video')}
                  className="w-full justify-start bg-zinc-700 hover:bg-zinc-600"
                  disabled={isAILoading}
                >
                  <Tv className="w-4 h-4 mr-2" />
                  Stream Video
                </Button>
                
                <Button
                  onClick={() => invokeSpidrAI('movie')}
                  className="w-full justify-start bg-zinc-700 hover:bg-zinc-600"
                  disabled={isAILoading}
                >
                  <Film className="w-4 h-4 mr-2" />
                  Watch Together
                </Button>

                <div className="pt-3 border-t border-zinc-700">
                  <p className="text-xs text-zinc-500 mb-2">Ask Spidr AI</p>
                  <div className="flex gap-2">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAIPrompt(e.target.value)}
                      placeholder="Ask anything..."
                      className="bg-zinc-700 border-zinc-600 text-white text-sm"
                    />
                    <Button
                      size="icon"
                      onClick={() => invokeSpidrAI('custom')}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={isAILoading || !aiPrompt.trim()}
                    >
                      {isAILoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {aiSession && (
                  <div className="space-y-2 mt-4">
                    <Button
                      onClick={spidrVoice.toggleMute}
                      variant="outline"
                      className={`w-full ${spidrVoice.isMuted ? 'text-zinc-500 border-zinc-600' : 'text-green-400 border-green-500/30 hover:bg-green-500/10'}`}
                    >
                      {spidrVoice.isMuted ? <VolumeX className="w-4 h-4 mr-2" /> : <Volume2 className="w-4 h-4 mr-2" />}
                      {spidrVoice.isMuted ? 'AI Voice Muted' : 'AI Voice Active'}
                    </Button>
                    {spidrVoice.isSpeaking && (
                      <div className="flex items-center justify-center py-1">
                        <SpidrVoiceVisualizer isSpeaking={true} />
                      </div>
                    )}
                    <Button
                      onClick={kickAI}
                      variant="outline"
                      className="w-full text-red-500 border-red-500/30 hover:bg-red-500/10"
                    >
                      Remove Spidr AI
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="h-16 px-4 flex items-center justify-center gap-2 border-t border-red-900/20 bg-zinc-800/50">
        <Button
          size="icon"
          variant={isMuted ? 'destructive' : 'secondary'}
          onClick={toggleMute}
          className="rounded-full w-12 h-12"
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <Button
          size="icon"
          variant={isDeafened ? 'destructive' : 'secondary'}
          onClick={toggleDeafen}
          className="rounded-full w-12 h-12"
        >
          {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </Button>

        <Button
          size="icon"
          variant={isVideoOn ? 'default' : 'secondary'}
          onClick={toggleVideo}
          className={`rounded-full w-12 h-12 ${isVideoOn ? 'bg-green-600 hover:bg-green-700' : ''}`}
        >
          {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>

        <Button
          size="icon"
          variant={isSharing ? 'default' : 'secondary'}
          onClick={() => isSharing ? handleStopStream() : setShowStreamSelector(true)}
          className={`rounded-full w-12 h-12 ${isSharing ? 'bg-green-600 hover:bg-green-700' : ''}`}
          title={isSharing ? 'Stop Streaming' : 'Start Streaming'}
        >
          <MonitorUp className="w-5 h-5" />
        </Button>

        <Button
          size="icon"
          variant="secondary"
          onClick={() => setShowAVControls(!showAVControls)}
          className="rounded-full w-12 h-12"
        >
          <Settings className="w-5 h-5" />
        </Button>

        {isApexUser && (
          <Button
            size="icon"
            variant={squadOverclock ? 'default' : 'secondary'}
            onClick={() => setSquadOverclock(!squadOverclock)}
            className={`rounded-full w-12 h-12 ${squadOverclock ? 'bg-yellow-500 hover:bg-yellow-600 text-black animate-pulse' : ''}`}
            title="Squad Overclock: Boost everyone to 4K/60FPS"
          >
            <Zap className="w-5 h-5" />
          </Button>
        )}

        <div className="w-px h-8 bg-zinc-700 mx-2" />

        <Button
          size="icon"
          variant="destructive"
          onClick={handleLeave}
          className="rounded-full w-12 h-12"
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>

      <AnimatePresence>
        {showAVControls && <CallAVControls onClose={() => setShowAVControls(false)} />}
      </AnimatePresence>

      <SpidrAIProfile open={showSpidrProfile} onClose={() => setShowSpidrProfile(false)} />
    </div>
  );
}