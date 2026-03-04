import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, Settings, LogOut, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import HolographicProfile from './HolographicProfile';

export default function UserProfilePod({ onSettingsClick, onProfileClick }) {
  const [expanded, setExpanded] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const queryClient = useQueryClient();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 120000,
  });

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ['userProfile', currentUser?.id],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: currentUser.id }).then(res => res[0]),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (newStatus) => 
      base44.entities.UserProfile.update(profile.id, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });

  // Status Colors
  const getStatusColor = () => {
    switch(profile?.status) {
      case 'online': return '#10B981';
      case 'idle': return '#F59E0B';
      case 'dnd': return '#FF3333';
      case 'offline': return '#6B7280';
      default: return '#10B981';
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (!currentUser || !profile) return null;

  return (
    <div className="fixed top-0 right-6 z-[100] flex flex-col items-center">
      
      {/* THE SILK THREAD (Status Line) */}
      <motion.div 
        className="w-[2px] bg-gradient-to-b from-current to-transparent"
        style={{ color: getStatusColor() }}
        initial={{ height: 0 }}
        animate={{ height: expanded ? 40 : 20 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      />

      {/* THE CHRYSALIS (The Profile Pod) */}
      <motion.div
        className="relative bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden group"
        initial={{ width: 60, height: 60, borderRadius: 30 }}
        animate={{ 
          width: expanded ? 240 : 60, 
          height: expanded ? 380 : 60,
          borderRadius: expanded ? 24 : 30,
          rotate: expanded ? 0 : [0, 2, -2, 0]
        }}
        transition={{ 
          rotate: { repeat: Infinity, duration: 6, ease: "easeInOut" },
          layout: { type: "spring", stiffness: 300, damping: 30 }
        }}
      >
        
        {/* HEADER (Always Visible Avatar) */}
        <div 
          onClick={() => setExpanded(!expanded)}
          className="w-full p-1 cursor-pointer flex items-center gap-3 relative z-20"
        >
          {/* Avatar */}
          <div className="relative w-[50px] h-[50px] flex-shrink-0">
            <img 
              src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`}
              className="w-full h-full rounded-full bg-black border-2 border-[#1a1a1a] group-hover:border-white/30 transition-colors" 
              alt="User"
            />
            {/* Pulse Ring */}
            <div 
              className={`absolute inset-0 rounded-full border ${profile.status === 'online' ? 'animate-ping opacity-20' : ''}`}
              style={{ borderColor: getStatusColor() }}
            />
          </div>

          {/* User Info (Reveals when expanded) */}
          <motion.div 
            className="flex-1 overflow-hidden whitespace-nowrap"
            animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -20 }}
          >
            <h3 className="font-bold text-white text-sm">{profile.display_name || currentUser.full_name}</h3>
            <p className="text-[10px] text-gray-400 font-mono tracking-wider">{profile.custom_status || 'ONLINE'}</p>
          </motion.div>

          {/* Settings Icon (Reveals when expanded) */}
          <motion.button 
            onClick={(e) => {
              e.stopPropagation();
              onSettingsClick?.();
              setExpanded(false);
            }}
            animate={{ opacity: expanded ? 1 : 0, scale: expanded ? 1 : 0 }}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"
          >
            <Settings size={18} />
          </motion.button>
        </div>

        {/* CONTROLS BODY (Hidden until clicked) */}
        <AnimatePresence>
          {expanded && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
              className="p-4 pt-2 flex flex-col gap-4 relative z-10"
            >
              
              {/* Divider */}
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Status Selectors */}
              <div className="grid grid-cols-4 gap-2">
                {['online', 'idle', 'dnd', 'offline'].map((s) => (
                  <button 
                    key={s}
                    onClick={() => updateStatusMutation.mutate(s)}
                    className={`h-8 rounded-lg border flex items-center justify-center transition-all ${profile.status === s ? 'bg-white/10 border-white/30 scale-105' : 'border-transparent hover:bg-white/5'}`}
                  >
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ 
                        backgroundColor: s === 'online' ? '#10B981' : s === 'idle' ? '#F59E0B' : s === 'dnd' ? '#FF3333' : '#6B7280'
                      }}
                    />
                  </button>
                ))}
              </div>

              {/* Hardware Toggles */}
              <div className="flex flex-col gap-2">
                <ControlRow 
                  label="Microphone" 
                  active={micActive} 
                  onClick={() => setMicActive(!micActive)} 
                  icon={micActive ? Mic : MicOff} 
                />
                <ControlRow 
                  label="Deafen" 
                  active={deafened} 
                  onClick={() => setDeafened(!deafened)} 
                  icon={Headphones} 
                />
              </div>

              {/* View Profile Button */}
              <button 
                onClick={() => {
                  setShowProfile(true);
                  setExpanded(false);
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all"
              >
                <User size={16} />
                <span className="text-xs font-bold">VIEW PROFILE</span>
              </button>

              {/* Log Out Button */}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all group"
              >
                <LogOut size={16} />
                <span className="text-xs font-bold">DISCONNECT</span>
              </button>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,51,51,0.05),transparent)] opacity-50 pointer-events-none" />
        
      </motion.div>

      {/* Holographic Profile Modal */}
      <HolographicProfile 
        userId={currentUser?.id}
        currentUser={currentUser}
        open={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </div>
  );
}

// Sub-component for toggle rows
function ControlRow({ label, active, onClick, icon: Icon }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${active ? 'bg-white/5 border-white/10 text-white' : 'bg-black/40 border-transparent text-gray-500'}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <div className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-[#FF3333]' : 'bg-gray-700'}`}>
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-[18px]' : 'left-0.5'}`} />
      </div>
    </button>
  );
}