import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, Settings, LogOut, User, Crown } from 'lucide-react';
import { entities, auth } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import HolographicProfile from './HolographicProfile';
import ApexStore from './ApexStore';

const STATUS_COLORS = {
  online:    '#10B981',
  idle:      '#F59E0B',
  dnd:       '#FF3333',
  offline:   '#6B7280',
  streaming: '#A855F7',
};

export default function UserProfilePod({ onSettingsClick }) {
  const { logout } = useAuth();
  const [expanded,     setExpanded]     = useState(false);
  const [micActive,    setMicActive]    = useState(true);
  const [deafened,     setDeafened]     = useState(false);
  const [showProfile,  setShowProfile]  = useState(false);
  const [showApex,     setShowApex]     = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn:  () => auth.me(),
    staleTime: 120000,
  });

  const { data: profile } = useQuery({
    queryKey: ['userProfile', currentUser?.id],
    queryFn:  async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles[0]) return profiles[0];
      // Auto-create a profile if none exists
      return entities.UserProfile.create({
        user_id:      currentUser.id,
        display_name: currentUser.full_name || currentUser.username || 'User',
        status:       'online',
        avatar_url:   '',
        bio:          '',
        custom_status:'',
      });
    },
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  const updateStatusMut = useMutation({
    mutationFn: (status) => entities.UserProfile.update(profile.id, { status }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['userProfile'] }),
  });

  const statusColor = STATUS_COLORS[profile?.status] || STATUS_COLORS.online;
  const displayName = profile?.display_name || currentUser?.full_name || currentUser?.username || 'User';
  const avatarUrl   = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id || 'user'}`;
  const isApex      = profile?.apex_tier === 'apex';

  // Show a minimal spinner while loading
  if (!currentUser) return null;

  return (
    <>
      <div className="fixed top-0 right-4 z-[200] flex flex-col items-center">
        {/* Silk thread */}
        <motion.div
          className="w-[2px]"
          style={{ background: `linear-gradient(to bottom, ${statusColor}, transparent)` }}
          initial={{ height: 0 }}
          animate={{ height: expanded ? 48 : 24 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />

        {/* The Chrysalis */}
        <motion.div
          className="relative bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden cursor-pointer"
          initial={{ width: 52, height: 52, borderRadius: 26 }}
          animate={{
            width:        expanded ? 220 : 52,
            height:       expanded ? 320 : 52,
            borderRadius: expanded ? 20 : 26,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          onClick={() => !expanded && setExpanded(true)}
        >
          {/* Pulse ring */}
          <div
            className="absolute inset-0 rounded-full opacity-20 pointer-events-none animate-ping"
            style={{ borderColor: statusColor, borderWidth: 1, borderStyle: 'solid' }}
          />

          {/* Header: always-visible avatar row */}
          <div className="flex items-center gap-2.5 p-1.5 relative z-20">
            <div className="relative flex-shrink-0 w-[40px] h-[40px]">
              <img
                src={avatarUrl}
                className="w-full h-full rounded-full bg-zinc-900 border-2 border-zinc-800 object-cover"
                alt={displayName}
              />
              {/* Online dot */}
              <div
                className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a]"
                style={{ backgroundColor: statusColor }}
              />
              {isApex && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Crown size={8} className="text-black" />
                </div>
              )}
            </div>

            <motion.div
              className="flex-1 overflow-hidden"
              animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -10 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-white font-bold text-xs truncate leading-tight">{displayName}</p>
              <p className="text-zinc-500 text-[9px] truncate leading-tight font-mono">
                {profile?.custom_status || profile?.status?.toUpperCase() || 'ONLINE'}
              </p>
            </motion.div>

            <motion.button
              animate={{ opacity: expanded ? 1 : 0, scale: expanded ? 1 : 0 }}
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors flex-shrink-0"
            >
              <Settings size={14} />
            </motion.button>
          </div>

          {/* Expanded body */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.05 }}
                className="px-3 pb-3 flex flex-col gap-2.5"
              >
                <div className="h-px bg-white/5" />

                {/* Status dots */}
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'streaming').map(([s, color]) => (
                    <button
                      key={s}
                      onClick={() => updateStatusMut.mutate(s)}
                      title={s}
                      className={`h-7 rounded-lg border flex items-center justify-center transition-all ${
                        (profile?.status || 'online') === s
                          ? 'bg-white/10 border-white/30 scale-110'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    </button>
                  ))}
                </div>

                {/* Mic / Deafen toggles */}
                <ControlRow icon={micActive ? Mic : MicOff}    label="Microphone" active={micActive}  onClick={() => setMicActive(v => !v)} />
                <ControlRow icon={Headphones}                   label="Deafen"     active={deafened}    onClick={() => setDeafened(v => !v)} />

                {/* View Profile */}
                <button
                  onClick={() => { setShowProfile(true); setExpanded(false); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors"
                >
                  <User size={14} />
                  <span className="text-xs font-bold">VIEW PROFILE</span>
                </button>

                {/* APEX badge / upgrade */}
                <button
                  onClick={() => { setShowApex(true); setExpanded(false); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                    isApex
                      ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                      : 'bg-[#FF3333]/10 border border-[#FF3333]/20 text-[#FF3333] hover:bg-[#FF3333]/20'
                  }`}
                >
                  <Crown size={14} />
                  <span className="text-xs font-black">{isApex ? 'APEX ACTIVE' : 'GET APEX'}</span>
                </button>

                {/* Settings */}
                <button
                  onClick={() => { onSettingsClick?.(); setExpanded(false); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Settings size={14} />
                  <span className="text-xs font-bold">SETTINGS</span>
                </button>

                {/* Disconnect */}
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <LogOut size={14} />
                  <span className="text-xs font-black">DISCONNECT</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* bg pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,51,51,0.04),transparent)] pointer-events-none" />
        </motion.div>

        {/* Click-outside overlay */}
        {expanded && (
          <div className="fixed inset-0 z-[-1]" onClick={() => setExpanded(false)} />
        )}
      </div>

      {showProfile && currentUser && (
        <HolographicProfile
          userId={currentUser.id}
          currentUser={currentUser}
          open={showProfile}
          onClose={() => setShowProfile(false)}
        />
      )}

      <ApexStore
        isOpen={showApex}
        onClose={() => setShowApex(false)}
        currentTier={profile?.apex_tier || 'free'}
      />
    </>
  );
}

function ControlRow({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
        active ? 'bg-white/5 border-white/10 text-white' : 'bg-black/40 border-transparent text-zinc-500'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <div className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-[#FF3333]' : 'bg-zinc-700'}`}>
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-[18px]' : 'left-0.5'}`} />
      </div>
    </button>
  );
}
