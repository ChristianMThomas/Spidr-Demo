import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { useAppShell } from '@/context/AppShellContext';
import { Mic, MicOff, Headphones, Settings as SettingsIcon, LogOut, User as UserIcon } from 'lucide-react';
import SpiderLogo from './SpiderLogo';

/**
 * UserStatusChip — the top-right profile control, redesigned to match the
 * reference mockups:
 *   • Collapsed: just the avatar, wrapped in an animated audio-reactive ring
 *     when the user is in a voice call (or always a subtle idle ring). A small
 *     spider-logo "threat" sits above the avatar; clicking it collapses /
 *     expands the whole chip.
 *   • Expanded: a dark rounded card with the avatar + name + custom status,
 *     a settings gear, a row of 4 status dots (online / idle / dnd / invisible),
 *     a Microphone toggle, a Deafen toggle, a VIEW PROFILE button, and a
 *     DISCONNECT button (only meaningful while in a call).
 *
 * Status changes persist to the user's profile. Mic/deafen dispatch the same
 * `spidr-call-mute-toggle` / `spidr-call-deafen-toggle` window events the call
 * UI listens for, so toggling here controls the live call.
 */
const STATUS_OPTIONS = [
  { id: 'online',    color: '#22c55e', label: 'Online' },
  { id: 'idle',      color: '#eab308', label: 'Idle' },
  { id: 'dnd',       color: '#ef4444', label: 'Do Not Disturb' },
  { id: 'invisible', color: '#6b7280', label: 'Invisible' },
];

export default function UserStatusChip({ hidden: collapsedHidden = false, onToggleHidden }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser, activeCall, setActiveCall, setIsCallMinimized } = useAppShell();
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const cardRef = useRef(null);

  // Close the expanded card on outside-click.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) setExpanded(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [expanded]);

  if (!currentUser) return null;

  const status = currentUser.status || 'online';
  const statusColor = (STATUS_OPTIONS.find(s => s.id === status) || STATUS_OPTIONS[0]).color;
  const displayName = currentUser.display_name || currentUser.full_name || currentUser.username || 'You';
  const subtitle = currentUser.custom_status || currentUser.bio || `@${currentUser.username || 'user'}`;
  const inCall = !!activeCall;

  const setStatus = async (newStatus) => {
    // Optimistic; persist in the background.
    try {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles[0]) await entities.UserProfile.update(profiles[0].id, { status: newStatus });
      window.dispatchEvent(new CustomEvent('spidr-profile-updated', { detail: { profile: { status: newStatus } } }));
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch { /* non-fatal */ }
  };

  const toggleMic = () => {
    const next = !muted;
    setMuted(next);
    window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: next } }));
  };
  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    // Deafening implies muting your own mic too, matching Discord behavior.
    if (next && !muted) toggleMic();
    window.dispatchEvent(new CustomEvent('spidr-call-deafen-toggle', { detail: { deafened: next } }));
  };
  const disconnect = () => {
    setActiveCall(null);
    setIsCallMinimized(false);
    window.dispatchEvent(new Event('spidr-call-disconnect'));
    setExpanded(false);
  };

  // Avatar with the animated audio ring (image 2). The ring pulses while in a
  // call; otherwise it's a static subtle border.
  const AvatarWithRing = ({ size = 44 }) => (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {inCall && (
        <span
          className="absolute inset-[-4px] rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #ef4444, #f97316, #ef4444)',
            animation: 'spidr-ring-spin 3s linear infinite',
            filter: 'blur(1px)',
            opacity: 0.9,
          }}
        />
      )}
      <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-black bg-zinc-800">
        {currentUser.avatar_url ? (
          <img src={currentUser.avatar_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {/* status dot */}
      <span
        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black"
        style={{ backgroundColor: statusColor }}
      />
    </div>
  );

  return (
    <div className="relative" ref={cardRef}>
      {/* Spider "threat" toggle above the icon — collapses/expands the chip + biomass */}
      <button
        onClick={onToggleHidden}
        className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/70 border border-red-900/40 hover:border-red-500 transition-colors"
        title={collapsedHidden ? 'Show profile' : 'Hide profile'}
      >
        <SpiderLogo size={14} />
      </button>

      <AnimatePresence>
        {!collapsedHidden && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {!expanded ? (
              // Collapsed: avatar button
              <button
                onClick={() => setExpanded(true)}
                className="block rounded-full hover:scale-105 transition-transform"
                title={displayName}
              >
                <AvatarWithRing size={40} />
              </button>
            ) : (
              // Expanded: full card
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-64 rounded-2xl bg-[#0d0d0f]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 flex items-center gap-3">
                  <AvatarWithRing size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-sm truncate">{displayName}</p>
                    <p className="text-zinc-500 text-xs truncate font-mono">{subtitle}</p>
                  </div>
                  <button
                    onClick={() => { setExpanded(false); navigate('/settings'); }}
                    className="text-zinc-500 hover:text-white transition-colors"
                    title="Settings"
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Status dots */}
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-2 bg-black/40 rounded-xl p-2 justify-around">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setStatus(opt.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          status === opt.id ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
                        }`}
                        title={opt.label}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.color }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mic toggle */}
                <div className="px-4 pb-2">
                  <button
                    onClick={toggleMic}
                    className="w-full flex items-center gap-3 bg-black/40 hover:bg-black/60 rounded-xl px-3 py-2.5 transition-colors"
                  >
                    {muted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-white" />}
                    <span className="text-white text-sm font-semibold flex-1 text-left">Microphone</span>
                    <span className={`w-9 h-5 rounded-full transition-colors relative ${muted ? 'bg-zinc-700' : 'bg-red-500'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${muted ? 'left-0.5' : 'left-4'}`} />
                    </span>
                  </button>
                </div>

                {/* Deafen toggle */}
                <div className="px-4 pb-3">
                  <button
                    onClick={toggleDeafen}
                    className="w-full flex items-center gap-3 bg-black/40 hover:bg-black/60 rounded-xl px-3 py-2.5 transition-colors"
                  >
                    <Headphones className={`w-4 h-4 ${deafened ? 'text-red-400' : 'text-zinc-400'}`} />
                    <span className="text-zinc-300 text-sm font-semibold flex-1 text-left">Deafen</span>
                    <span className={`w-9 h-5 rounded-full transition-colors relative ${deafened ? 'bg-red-500' : 'bg-zinc-700'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${deafened ? 'left-4' : 'left-0.5'}`} />
                    </span>
                  </button>
                </div>

                {/* View profile */}
                <div className="px-4 pb-2">
                  <button
                    onClick={() => { setExpanded(false); window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: currentUser.id } })); }}
                    className="w-full flex items-center gap-3 bg-black/40 hover:bg-black/60 rounded-xl px-3 py-2.5 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-zinc-300" />
                    <span className="text-white text-sm font-semibold">VIEW PROFILE</span>
                  </button>
                </div>

                {/* Disconnect */}
                <div className="px-4 pb-4">
                  <button
                    onClick={disconnect}
                    disabled={!inCall}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      inCall ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400' : 'bg-black/30 text-zinc-700 cursor-not-allowed'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-semibold">DISCONNECT</span>
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
