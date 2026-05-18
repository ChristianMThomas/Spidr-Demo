import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import { motion } from 'framer-motion';

import TopFeedBar from '../components/spidr/TopFeedBar';
import Sidebar from '../components/spidr/Sidebar';
import FriendsPanel from '../components/spidr/FriendsPanel';
import ServersPanel from '../components/spidr/ServersPanel';
import SettingsPanel from '../components/spidr/SettingsPanel';
import AIPanel from '../components/spidr/AIPanel';
import FeedPanel from '../components/spidr/FeedPanel';
import BotLaboratory from '../components/spidr/BotLaboratory';
import CreateServerModal from '../components/spidr/CreateServerModal';
import SignalRadar from '../components/spidr/SignalRadar';
import SpiderLogo from '../components/spidr/SpiderLogo';
import SpiderWeb from '../components/spidr/SpiderWeb';
import Preloader from '../components/spidr/Preloader';
import WelcomeOverlay from '../components/spidr/WelcomeOverlay';
import UserProfileWidget from '../components/spidr/UserProfileWidget';
import UserProfilePod from '../components/spidr/UserProfilePod';
import DiscoverUsers from '../components/spidr/DiscoverUsers';
import EnhancedFeed from '../components/spidr/EnhancedFeed';
import EngagementHub from '../components/spidr/EngagementHub';

import GifsEmojisPage from './GifsEmojis';
import GlobalReports from './GlobalReports';
import ActiveCallTether from '../components/spidr/ActiveCallTether';
import BanScreen from '../components/spidr/BanScreen';
import ModuleNexus from '../components/nexus/ModuleNexus';
import NerveCenter from '../components/spidr/NerveCenter';
import HolographicProfile from '../components/spidr/HolographicProfile';
import ErrorBoundary from '../components/spidr/ErrorBoundary';

export default function Home() {
  const [showPreloader, setShowPreloader] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [pendingDM, setPendingDM] = useState(null);

  const [showCreateServer, setShowCreateServer] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [appTheme, setAppTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('spidr_theme');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      type: 'gradient',
      primaryColor: '#dc2626',
      secondaryColor: '#991b1b',
      backgroundImage: '',
      blur: 0,
      opacity: 90
    };
  });
  const [activeCall, setActiveCall] = useState(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  const [userLoaded, setUserLoaded] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  // When the home "Find Friends" button is clicked we want the Friends panel
  // to land on the "add" tab — not the default "all" tab.
  const [initialFriendsTab, setInitialFriendsTab] = useState(null);
  useEffect(() => {
    if (userLoaded) return;
    auth.me()
      .then(async (user) => {
        setCurrentUser(user);
        setUserLoaded(true);
        const profiles = await entities.UserProfile.filter({ user_id: user.id });
        if (profiles[0]) {
          setCurrentUser({ ...user, ...profiles[0], id: user.id });
          // Load saved theme from profile (cross-device)
          if (profiles[0].app_theme) {
            setAppTheme(profiles[0].app_theme);
            try { localStorage.setItem('spidr_theme', JSON.stringify(profiles[0].app_theme)); } catch {}
          }
        }
      })
      .catch(() => { setUserLoaded(true); });
  }, [userLoaded]);

  // Prevent flash - show nothing until preloader takes over
  if (!showPreloader && !showWelcome && !userLoaded) {
    return <div className="w-full bg-black" style={{ height: '100%', minHeight: '550px', minWidth: '900px' }} />;
  }

  const handleTabChange = (tab) => {
    if (tab.startsWith('server-')) {
      setSelectedServerId(tab.replace('server-', ''));
      setActiveTab('servers');
    } else {
      setActiveTab(tab);
      if (tab !== 'servers') {
        setSelectedServerId(null);
      }
    }
  };

  // Global handler: navigate to friends tab and open DM
  const handleNavigateToDM = (friendId, conversationId) => {
    setPendingDM({ friendId, conversationId });
    setActiveTab('friends');
  };


  // Global DM navigation from context menus
  useEffect(() => {
    const handler = (e) => {
      const { userId, name } = e.detail;
      handleNavigateToDM(userId, [currentUser?.id, userId].sort().join('-'));
    };
    window.addEventListener('spidr-open-dm', handler);
    return () => window.removeEventListener('spidr-open-dm', handler);
  }, [currentUser?.id]);

  // Global friend request notification
  useEffect(() => {
    if (!currentUser) return;
    const socket = getSocket();
    const handleFriendIncoming = ({ senderName }) => {
      toast.info(`${senderName} sent you a friend request!`, {
        action: { label: 'View', onClick: () => setActiveTab('friends') },
      });
      queryClientInstance.invalidateQueries({ queryKey: ['friends'] });
    };
    socket.on('friend:incoming', handleFriendIncoming);
    return () => socket.off('friend:incoming', handleFriendIncoming);
  }, [currentUser]);

  const renderContent = () => {
    switch (activeTab) {
      case 'friends':
        return <FriendsPanel 
          currentUser={currentUser}
          pendingDM={pendingDM}
          onPendingDMHandled={() => setPendingDM(null)}
          initialTab={initialFriendsTab}
          onInitialTabConsumed={() => setInitialFriendsTab(null)}
          onVoiceJoin={(groupId, groupName) => {
            setActiveCall({
              groupId,
              groupName,
              type: 'group'
            });
            setIsCallMinimized(false);
          }}
          onVoiceLeave={() => {
            setActiveCall(null);
            setIsCallMinimized(false);
          }}
          onMinimizeCall={() => {
            if (activeCall) {
              setIsCallMinimized(true);
              setActiveTab('home');
            }
          }}
        />;
      case 'servers':
        return (
          <ServersPanel 
            currentUser={currentUser} 
            selectedServerId={selectedServerId}
            onSelectServer={setSelectedServerId}
            onVoiceJoin={(server, channel) => {
              setActiveCall({
                serverId: server.id,
                channelId: channel.id,
                serverName: server.name,
                channelName: channel.name,
                server,
                channel,
                type: 'server'
              });
              setIsCallMinimized(false);
            }}
            onVoiceLeave={() => {
              setActiveCall(null);
              setIsCallMinimized(false);
            }}
            onMinimizeCall={() => {
              if (activeCall) {
                setIsCallMinimized(true);
                setActiveTab('home');
              }
            }}
          />
        );
      case 'settings':
        return <SettingsPanel currentUser={currentUser} appTheme={appTheme} onThemeChange={setAppTheme} />;
      case 'feed':
        return <FeedPanel currentUser={currentUser} />;
      case 'bots':
        return <BotLaboratory currentUser={currentUser} />;
      case 'ai':
        return <AIPanel currentUser={currentUser} />;
      case 'radar':
        return null;
      case 'gifs':
        return <GifsEmojisPage />;
      case 'global-reports':
        return <GlobalReports />;
      case 'modules':
        return <ModuleNexus currentUser={currentUser} />;
      case 'nerve-center':
        return <NerveCenter currentUser={currentUser} />;
      
      default:
        return <HomeContent currentUser={currentUser} setActiveTab={setActiveTab} setSelectedServerId={setSelectedServerId} onNavigateToDM={handleNavigateToDM} setInitialFriendsTab={setInitialFriendsTab} />;
    }
  };

  const getBackgroundStyle = () => {
    if (appTheme.type === 'solid') {
      return { backgroundColor: appTheme.primaryColor };
    } else if (appTheme.type === 'gradient') {
      return {
        background: `linear-gradient(135deg, ${appTheme.primaryColor}, ${appTheme.secondaryColor})`
      };
    } else if (appTheme.type === 'image' && appTheme.backgroundImage) {
      return {
        backgroundImage: `url(${appTheme.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    return { background: 'linear-gradient(135deg, #dc2626, #991b1b)' };
  };

  // Check if user is banned
  const isBanned = currentUser?.is_banned && (!currentUser?.ban_until || new Date(currentUser.ban_until) > new Date());

  if (isBanned) {
    return <BanScreen profile={currentUser} />;
  }

  if (showPreloader) {
    return (
      <div className="w-full bg-[#111111]" style={{ height: '100%', minHeight: '550px', minWidth: '900px' }}>
        <Preloader onComplete={() => {
          setShowPreloader(false);
          setShowWelcome(true);
        }} />
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="w-full bg-[#111111]" style={{ height: '100%', minHeight: '550px', minWidth: '900px' }}>
        <WelcomeOverlay currentUser={currentUser} onComplete={() => setShowWelcome(false)} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col overflow-hidden relative" style={{ height: '100%', minHeight: '550px', minWidth: '900px' }}>
      {/* The Chrysalis - Floating Top Right */}
      <UserProfilePod 
        onSettingsClick={() => setActiveTab('settings')}
        onProfileClick={(userId) => setSelectedProfileId(userId)}
      />

      {/* Background Layer */}
      <div 
        className="absolute inset-0"
        style={{
          ...getBackgroundStyle(),
          filter: appTheme.type === 'image' ? `blur(${appTheme.blur}px)` : 'none'
        }}
      />
      {appTheme.type === 'image' && (
        <div 
          className="absolute inset-0 bg-black"
          style={{ opacity: (100 - appTheme.opacity) / 100 }}
        />
      )}
      
      {/* Glassmorphic Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      {/* Spider Webs */}
      <SpiderWeb position="top-left" size="large" opacity={0.15} />
      <SpiderWeb position="top-right" size="medium" opacity={0.1} />
      <SpiderWeb position="bottom-left" size="medium" opacity={0.08} />
      <SpiderWeb position="bottom-right" size="large" opacity={0.12} />
      
      {/* Active Call Tether */}
      {activeCall && isCallMinimized && (
        <ActiveCallTether 
          callInfo={activeCall}
          onExpand={() => {
            setIsCallMinimized(false);
            if (activeCall.type === 'server') {
              setActiveTab('servers');
              setSelectedServerId(activeCall.serverId);
            } else if (activeCall.type === 'group') {
              setActiveTab('friends');
            } else if (activeCall.type === 'dm') {
              setActiveTab('friends');
            }
          }}
          onDisconnect={async () => {
            const { entities, auth, integrations } = await import('@/api/apiClient');
            if (activeCall.type === 'server') {
              const sessions = await entities.VoiceSession.filter({
                server_id: activeCall.serverId,
                channel_id: activeCall.channelId,
                user_id: currentUser?.id
              });
              if (sessions[0]) {
                await entities.VoiceSession.delete(sessions[0].id);
              }
            } else if (activeCall.type === 'group') {
              const sessions = await entities.VoiceSession.filter({
                group_id: activeCall.groupId,
                user_id: currentUser?.id
              });
              if (sessions[0]) {
                await entities.VoiceSession.delete(sessions[0].id);
              }
            } else if (activeCall.type === 'dm') {
              const sessions = await entities.VoiceSession.filter({
                conversation_id: activeCall.conversationId,
                user_id: currentUser?.id
              });
              if (sessions[0]) {
                await entities.VoiceSession.delete(sessions[0].id);
              }
            }
            setActiveCall(null);
            setIsCallMinimized(false);
          }}
          onToggleMute={() => {}}
          isMuted={false}
        />
      )}

      {/* Content Layer */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Top Feed Bar */}
        <TopFeedBar 
          currentUser={currentUser} 
          onNavigateDM={handleNavigateToDM}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={handleTabChange}
            onCreateServer={() => setShowCreateServer(true)}
            isGlass={appTheme.type === 'image'}
          />
          
          <motion.div 
            className="flex-1 flex overflow-hidden"
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary key={activeTab}>
            {renderContent()}
            </ErrorBoundary>
          </motion.div>
        </div>
      </div>

      {/* User Profile Modal */}
      {selectedProfileId && (
        <HolographicProfile
          open={true}
          userId={selectedProfileId}
          currentUser={currentUser}
          onClose={() => setSelectedProfileId(null)}
          onOpenDM={handleNavigateToDM}
        />
      )}
      <CreateServerModal 
        open={showCreateServer} 
        onClose={() => setShowCreateServer(false)}
        currentUser={currentUser}
      />
      
      {/* Signal Radar Overlay */}
      <SignalRadar 
        open={activeTab === 'radar'} 
        onClose={() => setActiveTab('home')} 
        currentUser={currentUser} 
      />
    </div>
  );
}

function HomeContent({ currentUser, setActiveTab, setSelectedServerId, onNavigateToDM, setInitialFriendsTab }) {
  const { data: allServers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 60000,
  });

  // Only show servers the user actually belongs to
  const servers = React.useMemo(() => {
    if (!currentUser?.id) return [];
    return allServers.filter(s =>
      s.owner_id === currentUser.id ||
      (s.members || []).some(m => m.user_id === currentUser.id)
    );
  }, [allServers, currentUser?.id]);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  return (
    <div className="flex-1 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/20 overflow-y-auto">
      <div className="flex gap-6 p-6 max-w-[1400px] mx-auto">
        {/* Main Column */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Welcome Header — compact */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            >
              <SpiderLogo size={64} />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome to <span className="text-red-500">Spidr</span>
              </h1>
              <p className="text-zinc-500 text-sm">Connect, chat, and create with your community</p>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <motion.div whileHover={{ scale: 1.02 }} className="bg-zinc-800/50 rounded-xl p-4 border border-red-900/20">
              <p className="text-3xl font-bold text-white">{servers.length}</p>
              <p className="text-zinc-500 text-xs">Servers</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} className="bg-zinc-800/50 rounded-xl p-4 border border-red-900/20">
              <p className="text-3xl font-bold text-white">{friends.length}</p>
              <p className="text-zinc-500 text-xs">Friends</p>
            </motion.div>
            <motion.button whileHover={{ scale: 1.02 }} onClick={() => setActiveTab('gifs')}
              className="bg-zinc-800/50 rounded-xl p-4 border border-red-900/20 hover:border-red-500 transition-all text-left">
              <p className="text-3xl font-bold text-red-500">∞</p>
              <p className="text-zinc-500 text-xs">GIFs & Emojis</p>
            </motion.button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setInitialFriendsTab && setInitialFriendsTab('add'); setActiveTab('friends'); }}
              className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-4 text-left hover:from-red-500 hover:to-red-600 transition-all">
              <h3 className="text-base font-semibold text-white mb-1">Find Friends</h3>
              <p className="text-red-200 text-xs">Connect with others</p>
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveTab('ai')}
              className="bg-gradient-to-r from-zinc-800 to-zinc-700 rounded-xl p-4 text-left border border-red-900/30 hover:border-red-500/50 transition-all">
              <h3 className="text-base font-semibold text-white mb-1">Try Spidr AI</h3>
              <p className="text-zinc-400 text-xs">Create servers & customize</p>
            </motion.button>
          </div>

          {/* AI User Discovery */}
          <DiscoverUsers currentUser={currentUser} onNavigateToDM={onNavigateToDM} />

          {/* Enhanced Activity Feed */}
          <div>
            <h2 className="text-lg font-bold text-white mb-3">Activity Feed</h2>
            <EnhancedFeed currentUser={currentUser} />
          </div>

          {/* Recent Servers */}
          {servers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-3">Recent Servers</h2>
              <div className="grid grid-cols-4 gap-3">
                {servers.slice(0, 4).map((server) => (
                  <motion.button
                    key={server.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setSelectedServerId(server.id); setActiveTab('servers'); }}
                    className="bg-zinc-800/50 rounded-xl p-3 text-center border border-red-900/20 hover:border-red-500/50 transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg mx-auto mb-2 overflow-hidden">
                      {server.icon_url ? (
                        <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white text-lg font-bold">
                          {server.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{server.name}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar — Engagement Hub */}
        <div className="w-72 shrink-0 hidden lg:block">
          <EngagementHub currentUser={currentUser} onNavigate={setActiveTab} onNavigateToDM={onNavigateToDM} />
        </div>
      </div>
    </div>
  );
}