import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, MonitorUp, Zap } from 'lucide-react';
import StreamSelector from './StreamSelector';
import { useScreenShare } from './useScreenShare';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';

export default function CallOverlay({ participants = [], onEndCall, onToggleMic, onToggleVideo, isMuted, isVideoOn, currentUser }) {
  const [minimized, setMinimized] = useState(false);
  const [showStreamSelector, setShowStreamSelector] = useState(false);
  const [squadOverclock, setSquadOverclock] = useState(false);
  const { stream, isSharing, startShare, stopShare } = useScreenShare();

  const { data: currentProfile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id
  });

  const isApexUser = currentProfile?.apex_tier === 'apex';
  const threadSkin = currentProfile?.apex_features?.thread_skin || 'default';

  const handleStartStream = async (sourceId) => {
    setShowStreamSelector(false);
    await startShare(sourceId);
  };

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: minimized ? 60 : 320, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="w-full bg-[#050505] relative border-b border-white/5 overflow-hidden"
    >
      


      {/* SQUAD OVERCLOCK BANNER */}
      {squadOverclock && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-1 bg-yellow-500 text-black text-xs font-black rounded-full animate-pulse">
          ⚡ SQUAD OVERCLOCK: 4K/60FPS ENABLED
        </div>
      )}

      {/* 2. THE HANGING VIDEO FEEDS */}
      <div className="flex justify-center items-start h-full pt-0 gap-6 px-10">
        {participants.map((user, index) => (
          <HangingFeed key={user.user_id} user={user} index={index} minimized={minimized} threadSkin={threadSkin} squadOverclock={squadOverclock} />
        ))}
      </div>

      {/* 3. CONTROLS (Floating at bottom) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
         {/* Toggle Minimize */}
         <button 
           onClick={() => setMinimized(!minimized)} 
           className="p-3 rounded-full bg-[#1a1a1a]/80 backdrop-blur border border-white/10 text-white hover:bg-white/10 transition-colors"
         >
           <Maximize2 size={18} className={minimized ? "" : "rotate-180"} />
         </button>

         {/* Call Actions */}
         {!minimized && (
           <div className="flex gap-4 px-6 py-2 bg-[#1a1a1a]/80 backdrop-blur border border-white/10 rounded-full shadow-2xl">
             <button onClick={onToggleMic} className={`p-3 rounded-full transition-all ${!isMuted ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500/20 text-red-500'}`}>
               {!isMuted ? <Mic size={20} /> : <MicOff size={20} />}
             </button>
             <button onClick={onToggleVideo} className={`p-3 rounded-full transition-all ${isVideoOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500/20 text-red-500'}`}>
               {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
             </button>
             <button 
               onClick={() => isSharing ? stopShare() : setShowStreamSelector(true)}
               className={`p-3 rounded-full transition-all ${isSharing ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
               title={isSharing ? 'Stop Streaming' : 'Start Streaming'}
             >
               <MonitorUp size={20} />
             </button>
             {isApexUser && (
               <button 
                 onClick={() => setSquadOverclock(!squadOverclock)}
                 className={`p-3 rounded-full transition-all ${squadOverclock ? 'bg-yellow-500 text-black animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.8)]' : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'}`}
                 title="Squad Overclock: Boost everyone to 4K/60FPS"
               >
                 <Zap size={20} />
               </button>
             )}
             <button onClick={onEndCall} className="p-3 rounded-full bg-[#FF3333] text-white hover:bg-red-600 shadow-[0_0_15px_rgba(255,51,51,0.5)]">
               <PhoneOff size={20} />
             </button>
           </div>
         )}
      </div>



      {/* Stream Selector Modal */}
      <StreamSelector 
        isOpen={showStreamSelector} 
        onClose={() => setShowStreamSelector(false)} 
        onStartStream={handleStartStream}
      />

      {/* Screen Share Preview */}
      {isSharing && stream && !minimized && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30"
        >
          <div className="relative">
            <div className="w-[2px] h-8 bg-[#FF3333] shadow-[0_0_15px_#FF3333] mx-auto" />
            <div className="w-80 h-48 border-2 border-[#FF3333] rounded-xl overflow-hidden shadow-2xl bg-black relative">
              <video 
                ref={video => { if (video && stream) video.srcObject = stream }} 
                autoPlay 
                muted 
                className="w-full h-full object-cover" 
              />
              <div className="absolute top-2 left-2 bg-[#FF3333] text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">
                🔴 STREAMING
              </div>
              <button
                onClick={stopShare}
                className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
              >
                Stop
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// THE "COCOON" COMPONENT
const HangingFeed = ({ user, index, minimized, threadSkin = 'default', squadOverclock = false }) => {
  // Randomize thread length slightly for organic feel
  const threadLength = minimized ? 10 : 40 + (index % 2) * 20;
  const speaking = !user.is_muted && user.is_speaking;

  // Thread skin styles
  const threadStyles = {
    default: 'bg-[#333]',
    rgb: 'bg-gradient-to-b from-red-500 via-green-500 to-blue-500 shadow-[0_0_10px_rgba(255,255,255,0.5)]',
    venom: 'bg-gradient-to-b from-purple-600 to-black shadow-[0_0_10px_rgba(147,51,234,0.5)]',
    glitch: 'bg-[#00ff00] shadow-[0_0_10px_rgba(0,255,0,0.8)]',
    invisible: 'bg-transparent'
  };

  const threadClass = speaking 
    ? 'bg-[#FF3333] shadow-[0_0_10px_#FF3333]' 
    : threadStyles[threadSkin] || threadStyles.default; 

  return (
    <div className="relative flex flex-col items-center">
      
      {/* THE SILK THREAD */}
      <motion.div 
        className={`w-[2px] origin-top transition-colors duration-300 ${threadClass}`}
        initial={{ height: 0 }}
        animate={{ 
            height: threadLength, 
            scaleY: speaking ? [1, 1.05, 1] : 1 // Vibrate if speaking
        }}
        transition={{ type: "spring", stiffness: 100 }}
      />

      {/* THE VIDEO CAPSULE */}
      <motion.div
        className="relative group"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: index * 0.1, type: "spring" }}
      >
        {/* Swaying Animation Container */}
        <motion.div
          animate={{ rotate: [ -1, 1, -1] }}
          transition={{ 
            repeat: Infinity, 
            duration: 4 + index, // Randomize sway speed
            ease: "easeInOut" 
          }}
          className={`
            relative overflow-hidden transition-all duration-500
            ${minimized 
               ? 'w-12 h-12 rounded-full border border-white/10' 
               : 'w-48 h-32 rounded-[2rem] rounded-t-md border-2'
            }
            ${speaking ? 'border-[#FF3333] shadow-[0_0_20px_rgba(255,51,51,0.2)]' : 'border-[#333]'}
            bg-[#111]
          `}
        >
          {/* The Video Image */}
          {user.is_video_on && user.stream_url ? (
            <img src={user.stream_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-white text-2xl font-bold">
                {user.user_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
          )}
          
          {/* Speaking Waveform Overlay */}
          {!minimized && speaking && (
            <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#FF3333]/40 to-transparent flex items-end justify-center gap-1 pb-2">
               {[1,2,3,4,5].map(i => (
                 <motion.div 
                   key={i} 
                   className="w-1 bg-white rounded-full"
                   animate={{ height: [5, 15, 5] }}
                   transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                 />
               ))}
            </div>
          )}

          {/* User Label */}
          {!minimized && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
              {user.user_name}
              {squadOverclock && <span className="ml-1 text-yellow-400">⚡</span>}
            </div>
          )}

          {/* Mute Indicator */}
          {user.is_muted && (
            <div className="absolute bottom-2 right-2 p-1 bg-red-500/80 rounded-full">
              <MicOff size={12} className="text-white" />
            </div>
          )}
          
          {/* Speaking Indicator when minimized */}
          {minimized && speaking && (
            <div className="absolute inset-0 border-2 border-[#FF3333] rounded-full animate-pulse" />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};