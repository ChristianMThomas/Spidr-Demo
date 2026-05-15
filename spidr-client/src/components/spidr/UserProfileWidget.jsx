import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Settings, Mic, Headphones, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HolographicProfile from './HolographicProfile';
import StatusMatrix from './StatusMatrix';
import ActivityStream from './ActivityStream';

const statusColors = {
  online: '#10B981',
  offline: '#6B7280',
  idle: '#F59E0B',
  dnd: '#EF4444',
  streaming: '#A855F7'
};

export default function UserProfileWidget({ currentUser, onOpenSettings }) {
  const { logout } = useAuth();
  const [showPanel, setShowPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const queryClient = useQueryClient();

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', currentUser?.id],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus) => {
      if (userProfile?.id) {
        await entities.UserProfile.update(userProfile.id, { status: newStatus });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', currentUser?.id] });
    }
  });

  const status = userProfile?.status || 'offline';
  const neuralLinks = currentUser?.neural_links || {};
  const hasActivity = neuralLinks.spotify || neuralLinks.steam;

  return (
    <div className="relative flex flex-col">
      {/* Activity Stream at Top */}
      {hasActivity && (
        <div className="mb-2">
          {neuralLinks.spotify && (
            <ActivityStream 
              type="spotify" 
              data={neuralLinks.spotify_data || {}}
            />
          )}
          {!neuralLinks.spotify && neuralLinks.steam && (
            <ActivityStream 
              type="game" 
              data={neuralLinks.steam_data || {}}
            />
          )}
        </div>
      )}

      {/* Glassmorphic Control Panel */}
      {showPanel && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPanel(false)}
          />
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-full left-0 mb-2 w-64 backdrop-blur-2xl bg-black/80 rounded-xl border border-red-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 z-50"
          >
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setShowPanel(false);
                  setShowProfile(true);
                }}
                className="w-full flex items-center gap-3 p-2 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <User className="w-5 h-5 text-zinc-400" />
                <span className="text-white text-sm">View Profile</span>
              </button>
              <button className="w-full flex items-center gap-3 p-2 hover:bg-red-900/20 rounded-lg transition-colors">
                <Mic className="w-5 h-5 text-zinc-400" />
                <span className="text-white text-sm">Voice Settings</span>
              </button>
              <button className="w-full flex items-center gap-3 p-2 hover:bg-red-900/20 rounded-lg transition-colors">
                <Headphones className="w-5 h-5 text-zinc-400" />
                <span className="text-white text-sm">Audio Settings</span>
              </button>
              <button 
                onClick={() => {
                  setShowPanel(false);
                  onOpenSettings?.();
                }}
                className="w-full flex items-center gap-3 p-2 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-zinc-400" />
                <span className="text-white text-sm">User Settings</span>
              </button>
              <div className="border-t border-zinc-700 pt-3">
                <button 
                  onClick={() => logout()}
                  className="w-full flex items-center gap-3 p-2 hover:bg-red-900/20 rounded-lg transition-colors text-red-500"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">Log Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Main Widget */}
      <div className="flex items-center gap-3 p-3 bg-zinc-900/80 rounded-lg w-full">
        {/* Status Matrix */}
        <StatusMatrix 
          currentStatus={status} 
          onSetStatus={(newStatus) => updateStatusMutation.mutate(newStatus)} 
        />

        <div 
          className="flex-1 text-left min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowProfile(true)}
        >
          <p className="text-white font-semibold truncate">
            {currentUser?.display_name || 'User'}
            <span className="text-zinc-500 ml-1 opacity-60">
              #{userProfile?.discriminator || '0000'}
            </span>
          </p>
          <p className="text-xs text-zinc-500 truncate">
            {userProfile?.custom_status || getStatusLabel(status)}
          </p>
        </div>

        <button onClick={() => setShowPanel(!showPanel)}>
          <Settings className="w-4 h-4 text-zinc-500 hover:text-white transition-colors" />
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Holographic Profile Modal */}
      <HolographicProfile
        open={showProfile}
        onClose={() => setShowProfile(false)}
        userId={currentUser?.id}
        currentUser={currentUser}
      />
    </div>
  );
}

function getStatusLabel(status) {
  switch(status) {
    case 'online': return 'SIGNAL: ACTIVE';
    case 'idle': return 'SIGNAL: DORMANT';
    case 'dnd': return 'SIGNAL: JAMMED';
    case 'offline': return 'SIGNAL: CLOAKED';
    default: return status;
  }
}
