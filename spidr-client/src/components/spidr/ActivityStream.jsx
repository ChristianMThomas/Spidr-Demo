import React from 'react';
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';

export default function ActivityStream({ type = 'spotify', data = {} }) {
  if (type === 'spotify') {
    return (
      <div className="w-full bg-[#111] border-t border-white/5 p-3 flex items-center gap-3 relative overflow-hidden">
        {/* Album Art with Spidr Overlay */}
        <div className="relative w-10 h-10 bg-gray-800 rounded overflow-hidden flex-shrink-0 group">
          <img 
            src={data.albumArt || "https://i.scdn.co/image/ab67616d0000b273444007a4a9d7018e69818815"} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
            alt="Album"
          />
          {/* The "Web" Overlay on Album Art */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9IndlYiIgeD0iMCIgeT0iMCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48bGluZSB4MT0iMzAiIHkxPSIwIiB4Mj0iMzAiIHkyPSI2MCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjAuNSIgb3BhY2l0eT0iMC4xIi8+PGxpbmUgeDE9IjAiIHkxPSIzMCIgeDI9IjYwIiB5Mj0iMzAiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCN3ZWIpIi8+PC9zdmc+')] opacity-30 mix-blend-overlay" />
        </div>

        <div className="flex-1 min-w-0 z-10">
          <h4 className="text-xs font-bold text-white truncate">{data.song || 'Metamorphosis'}</h4>
          <p className="text-[10px] text-gray-500 truncate">{data.artist || 'Interworld'}</p>
        </div>

        {/* THE SONIC THREAD (Visualizer) */}
        <div className="flex items-end gap-[2px] h-4 pr-2">
          {[1,2,3,4,5].map(i => (
             <motion.div
               key={i}
               className="w-[2px] bg-[#1DB954] rounded-full"
               animate={{ height: [4, 12, 6, 16, 4] }}
               transition={{ 
                 repeat: Infinity, 
                 duration: 0.5, 
                 delay: i * 0.1,
                 ease: "easeInOut"
               }} 
             />
          ))}
        </div>
        
        {/* Background "Pulse" */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1DB954]/5 to-transparent animate-pulse pointer-events-none" />
      </div>
    );
  }

  if (type === 'game') {
    return (
      <div className="w-full bg-[#111] border-t border-white/5 p-2 relative overflow-hidden">
         <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-[#FF3333] uppercase tracking-widest bg-[#FF3333]/10 px-1 rounded">
               SYSTEM OVERRIDE
            </span>
         </div>
         <div className="text-xs font-bold text-white pl-1">{data.gameName || 'Valorant'}</div>
         <div className="text-[10px] text-gray-500 pl-1">{data.gameDetails || 'Competitive • 12-11'}</div>
         
         {/* Glitch Overlay */}
         <div className="absolute top-0 right-0 p-2 opacity-20">
            <Gamepad2 size={32} />
         </div>
      </div>
    );
  }

  return null;
}