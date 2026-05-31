import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MicOff, Headphones, VolumeX, Volume2, ShieldOff, ShieldX, Music, PhoneOff, ArrowRightLeft, User } from 'lucide-react';

/**
 * VoiceDeckContextMenu — themed right-click menu for a voice/video tile.
 *
 * Dark glassmorphic container with a crimson edge, ink-shift hover states, and a
 * custom volume slider whose track glows purple→red as it rises. Renders in a
 * portal at the click coordinates and closes on outside-click / Escape.
 *
 * Props:
 *   x, y            screen coordinates to anchor at
 *   targetName      display name (header)
 *   isSelf          hide self-only-irrelevant actions
 *   isAdmin         gate Server Mute/Deafen, Disconnect, Move To
 *   localMuted, localDeafened, soundboardMuted   current local toggle states
 *   volume          0..1 local volume
 *   channels        [{id,name}] for Move To (admin)
 *   onClose
 *   onLocalMute, onLocalDeafen, onServerMute, onServerDeafen,
 *   onToggleSoundboard, onDisconnect, onMoveTo(channelId), onVolumeChange(v),
 *   onViewProfile
 */
export default function VoiceDeckContextMenu({
  x, y, targetName = 'User', isSelf = false, isAdmin = false,
  localMuted = false, localDeafened = false, soundboardMuted = false, volume = 1,
  channels = [],
  onClose,
  onLocalMute, onLocalDeafen, onServerMute, onServerDeafen,
  onToggleSoundboard, onDisconnect, onMoveTo, onVolumeChange, onViewProfile,
}) {
  const ref = useRef(null);
  const [showMove, setShowMove] = useState(false);
  const [vol, setVol] = useState(volume);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // Keep the menu on-screen.
  const menuW = 248, menuH = 360;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);

  const Item = ({ icon: Icon, label, onClick, danger, active }) => (
    <button
      onClick={() => { onClick?.(); }}
      className={`group/item relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left
        ${danger ? 'text-red-300 hover:text-white' : active ? 'text-white' : 'text-zinc-300 hover:text-white'}`}
    >
      {/* Ink-shift hover background + neon-red left accent */}
      <span className={`absolute inset-0 rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity
        ${danger ? 'bg-gradient-to-r from-red-600/30 to-transparent' : 'bg-gradient-to-r from-white/10 to-transparent'}`} />
      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-0 group-hover/item:h-5 w-[2px] bg-[#FF3333] rounded-full transition-all shadow-[0_0_8px_#FF3333]" />
      <Icon size={15} className={`relative ${danger ? 'text-red-400' : active ? 'text-[#FF3333]' : 'text-zinc-400 group-hover/item:text-white'}`} />
      <span className="relative font-medium">{label}</span>
      {active && <span className="relative ml-auto text-[9px] font-black text-[#FF3333]">ON</span>}
    </button>
  );

  const volPct = Math.round(vol * 100);

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      style={{ left, top }}
      className="fixed z-[400] w-[248px] bg-[#050505]/90 backdrop-blur-md border border-red-600/30 rounded-xl shadow-2xl shadow-black/60 p-1.5"
    >
      {/* Header */}
      <div className="px-3 py-1.5 mb-1 border-b border-white/5">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Voice Node</p>
        <p className="text-sm font-bold text-white truncate">{targetName}</p>
      </div>

      <Item icon={User} label="View Profile" onClick={() => { onViewProfile?.(); onClose?.(); }} />

      {!isSelf && (
        <>
          <Item icon={MicOff} label="Mute User" active={localMuted} onClick={onLocalMute} />

          {/* Custom volume slider — glowing thread purple→red */}
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Volume2 size={13} /> User Volume</span>
              <span className="text-[11px] font-bold text-white">{volPct}%</span>
            </div>
            <div className="relative h-4 flex items-center">
              {/* Track */}
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${volPct}%`,
                    background: 'linear-gradient(90deg, #9333ea, #dc2626)',
                    boxShadow: '0 0 10px rgba(220,38,38,0.6)',
                  }}
                />
              </div>
              <input
                type="range" min="0" max="1" step="0.01" value={vol}
                onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); onVolumeChange?.(v); }}
                className="relative w-full appearance-none bg-transparent cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(220,38,38,0.9)]
                  [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
              />
            </div>
          </div>

          <Item icon={Music} label="Mute Soundboard" active={soundboardMuted} onClick={onToggleSoundboard} />
        </>
      )}

      {isAdmin && !isSelf && (
        <>
          <div className="my-1 border-t border-white/5" />
          <p className="px-3 py-1 text-[9px] uppercase tracking-widest text-zinc-600">Admin</p>
          <Item icon={ShieldOff} label="Server Mute" onClick={onServerMute} />
          <Item icon={ShieldX} label="Server Deafen" onClick={onServerDeafen} />
          {channels.length > 0 && (
            <div className="relative">
              <Item icon={ArrowRightLeft} label="Move To…" onClick={() => setShowMove(s => !s)} />
              {showMove && (
                <div className="mx-2 mb-1 rounded-lg bg-black/60 border border-white/10 max-h-32 overflow-y-auto">
                  {channels.map(ch => (
                    <button key={ch.id}
                      onClick={() => { onMoveTo?.(ch.id); onClose?.(); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors truncate">
                      # {ch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Item icon={PhoneOff} label="Disconnect" danger onClick={() => { onDisconnect?.(); onClose?.(); }} />
        </>
      )}
    </motion.div>,
    document.body
  );
}
