import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';
import { entities, auth, getSocket } from '@/api/apiClient';

import TopFeedBar from './TopFeedBar';
import Sidebar from './Sidebar';
import CreateServerModal from './CreateServerModal';
import SignalRadar from './SignalRadar';
import SpiderWeb from './SpiderWeb';
import Preloader from './Preloader';
import WelcomeOverlay from './WelcomeOverlay';
import UserProfilePod from './UserProfilePod';
import ActiveCallTether from './ActiveCallTether';
import BanScreen from './BanScreen';
import HolographicProfile from './HolographicProfile';
import ErrorBoundary from './ErrorBoundary';

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showPreloader, setShowPreloader] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
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
      opacity: 90,
    };
  });
  const [activeCall, setActiveCall] = useState(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  useEffect(() => {
    if (userLoaded) return;
    auth.me()
      .then(async (user) => {
        setCurrentUser(user);
        setUserLoaded(true);
        const profiles = await entities.UserProfile.filter({ user_id: user.id });
        if (profiles[0]) {
          setCurrentUser({ ...user, ...profiles[0], id: user.id });
          if (profiles[0].app_theme) {
            setAppTheme(profiles[0].app_theme);
            try { localStorage.setItem('spidr_theme', JSON.stringify(profiles[0].app_theme)); } catch {}
          }
        }
      })
      .catch(() => { setUserLoaded(true); });
  }, [userLoaded]);

  const handleNavigateToDM = (friendId, conversationId) => {
    navigate('/friends/@me/' + conversationId);
  };

  // Global DM navigation from context menus / profile cards
  useEffect(() => {
    const handler = (e) => {
      const { userId } = e.detail;
      const conversationId = [currentUser?.id, userId].sort().join('-');
      navigate('/friends/@me/' + conversationId);
    };
    window.addEventListener('spidr-open-dm', handler);
    return () => window.removeEventListener('spidr-open-dm', handler);
  }, [currentUser?.id, navigate]);

  // Global friend request notification
  useEffect(() => {
    if (!currentUser) return;
    const socket = getSocket();
    const handleFriendIncoming = ({ senderName }) => {
      toast.info(`${senderName} sent you a friend request!`, {
        action: { label: 'View', onClick: () => navigate('/friends') },
      });
      queryClientInstance.invalidateQueries({ queryKey: ['friends'] });
    };
    socket.on('friend:incoming', handleFriendIncoming);
    return () => socket.off('friend:incoming', handleFriendIncoming);
  }, [currentUser, navigate]);

  const getBackgroundStyle = () => {
    if (appTheme.type === 'solid') {
      return { backgroundColor: appTheme.primaryColor };
    } else if (appTheme.type === 'gradient') {
      return { background: `linear-gradient(135deg, ${appTheme.primaryColor}, ${appTheme.secondaryColor})` };
    } else if (appTheme.type === 'image' && appTheme.backgroundImage) {
      return {
        backgroundImage: `url(${appTheme.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return { background: 'linear-gradient(135deg, #dc2626, #991b1b)' };
  };

  // Unified voice join — detects type by arg shape (string = group, object = server)
  const onVoiceJoin = (serverOrGroupId, channelOrGroupName) => {
    if (typeof serverOrGroupId === 'object' && serverOrGroupId !== null) {
      const server = serverOrGroupId;
      const channel = channelOrGroupName;
      setActiveCall({
        serverId: server.id, channelId: channel.id,
        serverName: server.name, channelName: channel.name,
        server, channel, type: 'server',
      });
    } else {
      setActiveCall({ groupId: serverOrGroupId, groupName: channelOrGroupName, type: 'group' });
    }
    setIsCallMinimized(false);
  };

  const onVoiceLeave = () => { setActiveCall(null); setIsCallMinimized(false); };

  const onMinimizeCall = () => {
    if (activeCall) { setIsCallMinimized(true); navigate('/home'); }
  };

  const outletContext = {
    currentUser,
    appTheme,
    onThemeChange: setAppTheme,
    onVoiceJoin,
    onVoiceLeave,
    onMinimizeCall,
  };

  const isBanned = currentUser?.is_banned && (!currentUser?.ban_until || new Date(currentUser.ban_until) > new Date());
  if (isBanned) return <BanScreen profile={currentUser} />;

  if (!showPreloader && !showWelcome && !userLoaded) {
    return <div className="w-full bg-black" style={{ height: '100%', minHeight: '550px', minWidth: '900px' }} />;
  }

  if (showPreloader) {
    return (
      <div className="w-full bg-[#111111]" style={{ height: '100%', minHeight: '550px', minWidth: '900px' }}>
        <Preloader onComplete={() => { setShowPreloader(false); setShowWelcome(true); }} />
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
      {/* Floating profile pod — top right */}
      <UserProfilePod />

      {/* Theme background */}
      <div
        className="absolute inset-0"
        style={{ ...getBackgroundStyle(), filter: appTheme.type === 'image' ? `blur(${appTheme.blur}px)` : 'none' }}
      />
      {appTheme.type === 'image' && (
        <div className="absolute inset-0 bg-black" style={{ opacity: (100 - appTheme.opacity) / 100 }} />
      )}

      {/* Glassmorphic overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Spider webs */}
      <SpiderWeb position="top-left"    size="large"  opacity={0.15} />
      <SpiderWeb position="top-right"   size="medium" opacity={0.1}  />
      <SpiderWeb position="bottom-left" size="medium" opacity={0.08} />
      <SpiderWeb position="bottom-right" size="large" opacity={0.12} />

      {/* Minimized call tether */}
      {activeCall && isCallMinimized && (
        <ActiveCallTether
          callInfo={activeCall}
          onExpand={() => {
            setIsCallMinimized(false);
            if (activeCall.type === 'server') {
              navigate('/channels/' + activeCall.serverId);
            } else {
              navigate('/friends');
            }
          }}
          onDisconnect={async () => {
            const { entities: ent } = await import('@/api/apiClient');
            if (activeCall.type === 'server') {
              const sessions = await ent.VoiceSession.filter({ server_id: activeCall.serverId, channel_id: activeCall.channelId, user_id: currentUser?.id });
              if (sessions[0]) await ent.VoiceSession.delete(sessions[0].id);
            } else if (activeCall.type === 'group') {
              const sessions = await ent.VoiceSession.filter({ group_id: activeCall.groupId, user_id: currentUser?.id });
              if (sessions[0]) await ent.VoiceSession.delete(sessions[0].id);
            } else if (activeCall.type === 'dm') {
              const sessions = await ent.VoiceSession.filter({ conversation_id: activeCall.conversationId, user_id: currentUser?.id });
              if (sessions[0]) await ent.VoiceSession.delete(sessions[0].id);
            }
            setActiveCall(null);
            setIsCallMinimized(false);
          }}
          onToggleMute={() => {}}
          isMuted={false}
        />
      )}

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <TopFeedBar currentUser={currentUser} onNavigateDM={handleNavigateToDM} />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar onCreateServer={() => setShowCreateServer(true)} isGlass={appTheme.type === 'image'} />
          <ErrorBoundary>
            <Outlet context={outletContext} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Holographic profile modal */}
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

      {/* Signal Radar — full-screen overlay, shown when pathname is /radar */}
      <SignalRadar
        open={location.pathname === '/radar'}
        onClose={() => navigate(-1)}
        currentUser={currentUser}
      />
    </div>
  );
}
