import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { useAppShell } from '@/context/AppShellContext';
import { Mic, MicOff, Headphones, Settings as SettingsIcon, LogOut, User as UserIcon } from 'lucide-react';

/**
 * UserStatusChip — the top-right profile control, designed to look like the
 * user's avatar is "hanging by a thread" from the top of the screen, Spidr
 * style. HOVER behavior drives everything:
 *   • Collapsed (mouse away): a spider sits at the top with a thin silk thread
 *     dropping down to the avatar dangling below it. Subtle idle sway.
 *   • Relapsed/expanded (mouse over): the thread "drops" and the full status
 *     card unfurls beneath the spider — name, status dots, mic, deafen,
 *     view profile, disconnect. Moving the mouse away collapses it again.
 *
 * Status changes persist to the profile. Mic/deafen/disconnect dispatch the
 * window events the live voice session listens for.
 */
const STATUS_OPTIONS = [
  { id: 'online',    color: '#22c55e', label: 'Online' },
  { id: 'idle',      color: '#eab308', label: 'Idle' },
  { id: 'dnd',       color: '#ef4444', label: 'Do Not Disturb' },
  { id: 'invisible', color: '#6b7280', label: 'Invisible' },
];

export default function UserStatusChip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser, activeCall, setActiveCall, setIsCallMinimized } = useAppShell();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const closeTimer = useRef(null);

  // Hover intent: open immediately, but delay close slightly so moving the
  // mouse across the small thread gap doesn't flicker the card shut.
  const handleEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const handleLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  if (!currentUser) return null;

  const status = currentUser.status || 'online';
  const statusColor = (STATUS_OPTIONS.find(s => s.id === status) || STATUS_OPTIONS[0]).color;
  const displayName = currentUser.display_name || currentUser.full_name || currentUser.username || 'You';
  const subtitle = currentUser.custom_status || currentUser.bio || `@${currentUser.username || 'user'}`;
  const inCall = !!activeCall;

  const setStatus = async (newStatus) => {
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
    if (next && !muted) toggleMic();
    window.dispatchEvent(new CustomEvent('spidr-call-deafen-toggle', { detail: { deafened: next } }));
  };
  const disconnect = () => {
    setActiveCall(null);
    setIsCallMinimized(false);
    window.dispatchEvent(new Event('spidr-call-disconnect'));
    setOpen(false);
  };

  const Avatar = ({ size = 44, ring = false }) => (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* In-call gets the animated red conic ring; otherwise a status-colored
          glow ring (matching the reference: a thin colored halo around the
          circular avatar). */}
      {inCall ? (
        <span
          className="absolute inset-[-4px] rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #ef4444, #f97316, #ef4444)',
            animation: 'spidr-ring-spin 3s linear infinite',
            filter: 'blur(1px)',
            opacity: 0.9,
          }}
        />
      ) : ring && (
        <span
          className="absolute inset-[-3px] rounded-full"
          style={{
            background: statusColor,
            opacity: 0.9,
            boxShadow: `0 0 12px ${statusColor}aa`,
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
      <span
        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black"
        style={{ backgroundColor: statusColor }}
      />
    </div>
  );

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Collapsed: a clean circular avatar with a status-colored ring (matches
          the reference). On hover it does a quick "breathing" pop then the
          full card unfurls below. The avatar stays put as the card anchor. */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className="relative z-10 origin-center"
        animate={open
          ? { scale: 1.08, y: 0 }
          : { scale: [1, 1.04, 1] }}
        transition={open
          ? { type: 'spring', stiffness: 400, damping: 18 }
          : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.94 }}
        title={displayName}
      >
        <Avatar size={40} ring />
      </motion.button>

      {/* Expanded card unfurls beneath the avatar on hover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scaleY: 0.85 }}
            animate={{ opacity: 1, y: 8, scaleY: 1 }}
            exit={{ opacity: 0, y: -10, scaleY: 0.85 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={{ transformOrigin: 'top center' }}
            className="absolute top-full right-0 w-64 rounded-2xl bg-[#0d0d0f]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 flex items-center gap-3">
              <Avatar size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-sm truncate">{displayName}</p>
                <p className="text-zinc-500 text-xs truncate font-mono">{subtitle}</p>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/settings'); }}
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
                onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: currentUser.id } })); }}
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
      </AnimatePresence>
    </div>
  );
}
