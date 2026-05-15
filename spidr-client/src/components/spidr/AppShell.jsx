import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';
import { entities, auth, getSocket } from '@/api/apiClient';
import { motion } from 'framer-motion';

import Sidebar from './Sidebar';
import TopFeedBar from './TopFeedBar';
import UserProfilePod from './UserProfilePod';
import CreateServerModal from './CreateServerModal';
import ActiveCallTether from './ActiveCallTether';
import HolographicProfile from './HolographicProfile';
import SignalRadar from './SignalRadar';
import BanScreen from './BanScreen';
import Preloader from './Preloader';
import WelcomeOverlay from './WelcomeOverlay';
import SpiderWeb from './SpiderWeb';

export default function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showPreloader, setShowPreloader] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

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

  // Load current user once
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

  // Global DM navigation from context menus
  const handleNavigateToDM = (_, conversationId) => {
    navigate('/friends/@me/' + conversationId);
  };

  useEffect(() => {
    const handler = (e) => {
      const { userId } = e.detail;
      const conversationId = [currentUser?.id, userId].sort().join('-');
      navigate('/friends/@me/' + conversationId);
    };
    window.addEventListener('spidr-open-dm', handler);
    return () => window.removeEventListener('spidr-open-dm', handler);
  }, [currentUser?.id, navigate]);

  // Incoming friend request toast
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

  // Voice call handlers
  const handleVoiceJoin = (callInfo) => {
    setActiveCall(callInfo);
    setIsCallMinimized(false);
  };

  const handleVoiceLeave = () => {
    setActiveCall(null);
    setIsCallMinimized(false);
  };

  const handleMinimizeCall = () => {
    if (activeCall) {
      setIsCallMinimized(true);
      navigate('/home');
    }
  };

  const getBackgroundStyle = () => {
    if (appTheme.type === 'solid') {
      return { backgroundColor: appTheme.primaryColor };
    } else if (appTheme.type === 'gradient') {
      return { background: `linear-gradient(135deg, ${appTheme.primaryColor}, ${appTheme.secondaryColor})` };
    } else if (appTheme.type === 'image' && appTheme.backgroundImage) {
      return {
        backgroundImage: `url(${appTheme.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    return { background: 'linear-gradient(135deg, #dc2626, #991b1b)' };
  };

  const isBanned = currentUser?.is_banned && (!currentUser?.ban_until || new Date(currentUser.ban_until) > new Date());

  if (!showPreloader && !showWelcome && !userLoaded) {
    return <div className="w-full bg-black" style={{ height: '100%', minHeight: '550px', minWidth: '900px' }} />;
  }

  if (isBanned) {
    return <BanScreen profile={currentUser} />;
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
      <UserProfilePod />

      {/* Background Layer */}
      <div
        className="absolute inset-0"
        style={{
          ...getBackgroundStyle(),
          filter: appTheme.type === 'image' ? `blur(${appTheme.blur}px)` : 'none'
        }}
      />
      {appTheme.type === 'image' && (
        <div className="absolute inset-0 bg-black" style={{ opacity: (100 - appTheme.opacity) / 100 }} />
      )}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

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
              navigate('/channels/' + activeCall.serverId);
            } else {
              navigate('/friends');
            }
          }}
          onDisconnect={async () => {
            const { entities } = await import('@/api/apiClient');
            if (activeCall.type === 'server') {
              const sessions = await entities.VoiceSession.filter({
                server_id: activeCall.serverId,
                channel_id: activeCall.channelId,
                user_id: currentUser?.id
              });
              if (sessions[0]) await entities.VoiceSession.delete(sessions[0].id);
            } else if (activeCall.type === 'group') {
              const sessions = await entities.VoiceSession.filter({
                group_id: activeCall.groupId,
                user_id: currentUser?.id
              });
              if (sessions[0]) await entities.VoiceSession.delete(sessions[0].id);
            } else if (activeCall.type === 'dm') {
              const sessions = await entities.VoiceSession.filter({
                conversation_id: activeCall.conversationId,
                user_id: currentUser?.id
              });
              if (sessions[0]) await entities.VoiceSession.delete(sessions[0].id);
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
        <TopFeedBar currentUser={currentUser} onNavigateDM={handleNavigateToDM} />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            onCreateServer={() => setShowCreateServer(true)}
            isGlass={appTheme.type === 'image'}
            onRadarOpen={() => setShowRadar(true)}
          />

          <motion.div
            className="flex-1 flex overflow-hidden"
            key={typeof window !== 'undefined' ? window.location.pathname : ''}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet context={{
              currentUser,
              appTheme,
              onThemeChange: setAppTheme,
              onVoiceJoin: handleVoiceJoin,
              onVoiceLeave: handleVoiceLeave,
              onMinimizeCall: handleMinimizeCall,
              onNavigateToDM: handleNavigateToDM,
              onProfileClick: setSelectedProfileId,
            }} />
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

      <SignalRadar
        open={showRadar}
        onClose={() => setShowRadar(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
