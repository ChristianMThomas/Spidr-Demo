import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppShell } from '@/context/AppShellContext';
import ServersPanel from '@/components/spidr/ServersPanel';

/**
 * /servers and /servers/:serverId — server browser + chat.
 *
 * Passing a serverId in the URL deep-links straight to that server,
 * which is much better than the old "/Home + internal state" pattern
 * because it survives reload and can be linked-to.
 */
export default function ServersPage() {
  const { currentUser, selectedServerId, setSelectedServerId, setActiveCall, setIsCallMinimized } = useAppShell();
  const navigate = useNavigate();
  const { serverId } = useParams();

  // URL → state sync. If the URL has a server id, prefer it.
  React.useEffect(() => {
    if (serverId && serverId !== selectedServerId) {
      setSelectedServerId(serverId);
    }
  }, [serverId, selectedServerId, setSelectedServerId]);

  return (
    <ServersPanel
      currentUser={currentUser}
      selectedServerId={serverId || selectedServerId}
      onSelectServer={(id) => {
        setSelectedServerId(id);
        // Reflect into URL so the server is deep-linkable
        if (id && id !== serverId) navigate(`/servers/${id}`, { replace: true });
      }}
      onVoiceJoin={(server, channel) => {
        setActiveCall({
          serverId: server.id,
          channelId: channel.id,
          serverName: server.name,
          channelName: channel.name,
          server,
          channel,
          type: 'server',
        });
        setIsCallMinimized(false);
      }}
      onVoiceLeave={() => {
        setActiveCall(null);
        setIsCallMinimized(false);
      }}
      onMinimizeCall={() => {
        // Minimize WITHOUT navigating away. Forcing a route change here used
        // to unmount the server page (and the WebRTC session with it), which
        // is what disconnected users on minimize. Staying put keeps the call
        // alive; the MinimizedCallBar lets them roam freely from here.
        setIsCallMinimized(true);
      }}
    />
  );
}
