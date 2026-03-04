import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Users, X } from 'lucide-react';
import SpiderLogo from './SpiderLogo';

export default function CinemaStage({ streamUrl, streamType, onClose, voiceSessions = [] }) {
  const [showChat, setShowChat] = useState(true);

  // Build the embed URL
  const getEmbedUrl = () => {
    if (!streamUrl) return null;
    
    // YouTube
    const ytMatch = streamUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
    }
    
    // Twitch channel
    const twitchChannelMatch = streamUrl.match(/twitch\.tv\/(\w+)/);
    if (twitchChannelMatch) {
      return `https://player.twitch.tv/?channel=${twitchChannelMatch[1]}&parent=${window.location.hostname}`;
    }

    // Direct video URL (mp4 etc)
    if (streamUrl.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
      return null; // We'll use a video tag instead
    }
    
    // Fallback: try as iframe
    return streamUrl;
  };

  const embedUrl = getEmbedUrl();
  const isDirectVideo = streamUrl && !embedUrl;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black flex flex-col"
    >
      {/* Cinema Header */}
      <div className="h-12 flex items-center justify-between px-4 bg-gradient-to-b from-black/90 to-transparent z-20 absolute top-0 w-full">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#FF3333] rounded-full animate-pulse" />
          <SpiderLogo size={18} />
          <span className="text-xs font-black text-white uppercase tracking-widest">
            SPIDR_AI LIVE // {streamType?.toUpperCase() || 'STREAM'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-lg transition-colors ${showChat ? 'bg-white/20 text-white' : 'bg-white/10 text-zinc-400 hover:text-white'}`}
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* The Player */}
      <div className="flex-1 flex relative pt-12">
        <div className={`flex-1 relative bg-[#050505] flex items-center justify-center ${showChat ? 'mr-72' : ''} transition-all`}>
          {isDirectVideo ? (
            <video
              src={streamUrl}
              autoPlay
              controls
              className="w-full h-full object-contain"
            />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              frameBorder="0"
            />
          ) : (
            <div className="text-center text-zinc-500">
              <SpiderLogo size={64} />
              <p className="mt-4 text-sm">No stream URL provided</p>
            </div>
          )}
        </div>

        {/* Overlay Chat */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="absolute top-0 right-0 h-full bg-black/80 backdrop-blur-xl border-l border-white/5 flex flex-col overflow-hidden"
            >
              {/* Viewer count */}
              <div className="p-3 border-b border-white/5 flex items-center gap-2">
                <Users size={14} className="text-zinc-400" />
                <span className="text-xs text-zinc-400">{voiceSessions.length} watching</span>
              </div>

              {/* Viewer avatars */}
              <div className="p-3 flex flex-wrap gap-1">
                {voiceSessions.map((s, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-white font-bold overflow-hidden">
                    {s.user_avatar ? (
                      <img src={s.user_avatar} className="w-full h-full object-cover" />
                    ) : (
                      s.user_name?.charAt(0)?.toUpperCase()
                    )}
                  </div>
                ))}
              </div>

              {/* Chat stream */}
              <div className="flex-1 p-3 space-y-2 overflow-y-auto flex flex-col justify-end">
                <div className="text-[10px] text-gray-400">
                  <span className="text-[#FF3333] font-bold">SPIDR_AI:</span> Stream started. Enjoy the show!
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}