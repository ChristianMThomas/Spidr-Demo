import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppShell } from '@/context/AppShellContext';
import FriendsPanel from '@/components/spidr/FriendsPanel';

/**
 * /friends — the friends list + DMs + add-friend tab.
 *
 * URL sub-tabs:
 *   /friends         → "all" tab (default)
 *   /friends/online  → online tab
 *   /friends/pending → pending requests
 *   /friends/blocked → blocked
 *   /friends/add     → add friend tab
 *   /friends/dms     → dm/group-chat list
 */
export default function FriendsPage() {
  const { currentUser, setActiveCall, setIsCallMinimized, pendingDM, setPendingDM } = useAppShell();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  // Derive sub-tab from URL
  const subTab = params.tab || (location.pathname.split('/')[2] || 'all');

  // FriendsPanel uses a `tab` state internally; we pass initialTab and
  // ask it to call us back when it consumes it.
  return (
    <FriendsPanel
      currentUser={currentUser}
      pendingDM={pendingDM}
      onPendingDMHandled={() => setPendingDM(null)}
      initialTab={subTab}
      onInitialTabConsumed={() => { /* URL is the source of truth; nothing to consume */ }}
      onTabChange={(tab) => {
        // Reflect tab changes back into the URL
        const target = tab === 'all' ? '/friends' : `/friends/${tab}`;
        if (location.pathname !== target) navigate(target, { replace: true });
      }}
      onVoiceJoin={(idOrGroupId, name, conversationId) => {
        // DirectMessages calls (recipientId, displayName, conversationId);
        // KineticChat calls (groupId, groupName). Distinguish by the 3rd arg.
        if (conversationId) {
          setActiveCall({ conversationId, groupName: name, recipientId: idOrGroupId, type: 'dm' });
        } else {
          setActiveCall({ groupId: idOrGroupId, groupName: name, type: 'group' });
        }
        setIsCallMinimized(false);
      }}
      onVoiceLeave={() => {
        setActiveCall(null);
        setIsCallMinimized(false);
      }}
      onMinimizeCall={() => {
        setIsCallMinimized(true);
        navigate('/home');
      }}
    />
  );
}
