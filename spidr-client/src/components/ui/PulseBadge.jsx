import React from 'react';
import { motion } from 'framer-motion';

// 1. FOR SERVER ICONS (The circular buttons on the far left)
export const ServerPulse = ({ unread, mentions }) => {
  if (!unread && !mentions) return null;

  return (
    <>
      {/* PASSIVE UNREAD: The glowing vertical line on the left */}
      {unread && !mentions && (
        <motion.div 
           initial={{ height: 0, opacity: 0 }}
           animate={{ height: 20, opacity: 1 }}
           className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 bg-white/50 rounded-r-full"
        />
      )}

      {/* TARGETED PING: The glowing neon box on the top right */}
      {mentions > 0 && (
        <>
           {/* The active vertical line */}
           <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 32 }}
              className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 bg-[#FF3333] shadow-[0_0_10px_#FF3333] rounded-r-full"
           />
           {/* The Notification Count */}
           <div className="absolute -top-1 -right-1 z-20 bg-[#FF3333] border border-black text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-[0_0_10px_#FF3333] animate-pulse">
              {mentions > 99 ? '99+' : mentions}
           </div>
        </>
      )}
    </>
  );
};

// 2. FOR CHANNEL NAMES (Text channels / DMs in the secondary sidebar)
export const ChannelPulse = ({ name, unread, mentions, active, icon, onClick, onContextMenu }) => {
   return (
      <button
         onClick={onClick}
         onContextMenu={onContextMenu}
         className={`w-full relative flex items-center justify-between px-2 py-1.5 rounded-lg group cursor-pointer transition-colors ${active ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`}
      >
         <div className="flex items-center gap-2 min-w-0">
            {/* Hashtag / Icon */}
            <span className={`text-[14px] font-mono shrink-0 ${unread || mentions ? 'text-white' : 'text-gray-600'}`}>
               {icon || '#'}
            </span>
            
            {/* Channel Name */}
            <span className={`text-sm truncate ${unread || mentions ? 'text-white font-bold' : ''}`}>
               {name}
            </span>
         </div>

         {/* BADGES */}
         <div className="flex items-center gap-2 shrink-0">
            {/* Passive Unread Dot */}
            {unread && !mentions && (
               <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_5px_white]" />
            )}
            
            {/* Targeted Mention Badge (The Spidr Bracket Style) */}
            {mentions > 0 && (
               <div className="text-[10px] font-black text-[#FF3333] bg-[#FF3333]/10 px-1.5 rounded uppercase tracking-widest border border-[#FF3333]/30 shadow-[0_0_10px_rgba(255,51,51,0.2)]">
                  [{mentions}]
               </div>
            )}
         </div>
      </button>
   );
};