import React from 'react';
import { Gamepad2, Sparkles } from 'lucide-react';

export default function GamingUplink() {
  return (
    <div
      className="bg-cover bg-center border border-yellow-500/50 rounded-xl relative overflow-hidden min-h-[120px] shadow-[0_0_25px_rgba(234,179,8,0.15)] group"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent" />

      <div className="relative z-10 p-4 h-full flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1 text-yellow-500">
          <Gamepad2 size={14} className="animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 px-2 rounded">Live Session</span>
        </div>

        <h3 className="text-xl font-black text-white italic tracking-tighter drop-shadow-lg uppercase">
          League of Legends
        </h3>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="bg-black/60 backdrop-blur border border-white/20 px-2 py-1 rounded flex items-center gap-1">
            <span className="text-[9px] text-gray-400 uppercase font-bold">Main:</span>
            <span className="text-[10px] text-white font-black uppercase">Sett</span>
          </div>
          <div className="bg-yellow-500/20 backdrop-blur border border-yellow-500/50 px-2 py-1 rounded flex items-center gap-1">
            <Sparkles size={10} className="text-yellow-500" />
            <span className="text-[10px] text-yellow-500 font-black uppercase">1M Mastery</span>
          </div>
        </div>
      </div>
    </div>
  );
}