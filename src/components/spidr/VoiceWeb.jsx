import React from 'react';
import { motion } from 'framer-motion';

const HangingUser = ({ user, index }) => {
  const stringLength = 40 + (index % 3) * 15;
  
  return (
    <div className="relative flex flex-col items-center mx-2" style={{ height: stringLength + 60 }}>
      {/* The Thread */}
      <motion.div 
        className={`w-[2px] bg-[#FF3333] opacity-40 origin-top ${user.is_speaking ? 'animate-pulse' : ''}`}
        style={{ height: stringLength }}
        initial={{ scaleY: 0 }}
        animate={{ 
          scaleY: 1,
          x: user.is_speaking ? [-1, 1, -1] : 0
        }}
        transition={{ 
          scaleY: { type: "spring", stiffness: 200, damping: 20 },
          x: { repeat: Infinity, duration: 0.5 }
        }}
      />
      
      {/* The Avatar */}
      <motion.div
        className="relative z-10"
        initial={{ y: -50, opacity: 0 }}
        animate={{ 
          y: 0, 
          opacity: 1,
          rotate: [0, 2, -2, 0]
        }}
        transition={{ 
          y: { delay: 0.2, type: "spring" },
          opacity: { delay: 0.2 },
          rotate: { repeat: Infinity, duration: 3, ease: "easeInOut" }
        }}
      >
        {/* The Avatar Circle */}
        <div className="w-10 h-10 rounded-full border-2 border-[#FF3333] bg-black overflow-hidden relative shadow-[0_0_15px_rgba(255,51,51,0.4)]">
          <img 
            src={user.user_avatar || 'https://via.placeholder.com/40'} 
            alt={user.user_name} 
            className="w-full h-full object-cover" 
          />
          
          {/* Speaking Indicator (Green Ring) */}
          {user.is_speaking && (
            <motion.div 
              className="absolute inset-0 border-2 border-green-400 rounded-full"
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          )}

          {/* Muted Indicator */}
          {user.is_muted && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-xs">🔇</span>
            </div>
          )}

          {/* Video Indicator */}
          {user.is_video_on && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-black" />
          )}
        </div>
        
        {/* Name Tag */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-1 rounded z-20">
          {user.user_name}
        </div>
      </motion.div>
    </div>
  );
};

export default function VoiceWeb({ channelName, users, onJoin }) {
  return (
    <div className="mb-4">
      {/* Channel Header */}
      <div 
        onClick={onJoin}
        className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer group"
      >
        <span className="text-[#FF3333] group-hover:animate-pulse">🔊</span>
        <span className="font-bold tracking-wide uppercase text-sm">{channelName}</span>
        {users.length > 0 && (
          <span className="text-xs text-gray-600 ml-auto">{users.length}</span>
        )}
      </div>

      {/* The Web Container */}
      <div className="relative flex flex-wrap px-4 min-h-[20px] border-l border-[#FF3333]/20 ml-6">
        {users.length === 0 ? (
          <div className="text-xs text-gray-700 italic py-2 pl-2">The web is empty...</div>
        ) : (
          users.map((user, idx) => (
            <HangingUser key={user.user_id || idx} user={user} index={idx} />
          ))
        )}
      </div>
    </div>
  );
}