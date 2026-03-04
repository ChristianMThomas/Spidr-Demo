import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, MonitorUp, Mic, MicOff, Wand2, Bot, PhoneOff
} from 'lucide-react';

export default function CallDeck({ channelName, participants = [], onDisconnect, onToggleMute, isMuted }) {
  const [activeFilter, setActiveFilter] = useState('none');
  const [voiceChanger, setVoiceChanger] = useState('none');
  const [aiActive, setAiActive] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
      
      {/* HEADER */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h2 className="font-black text-white uppercase italic tracking-widest text-sm">{channelName || 'Voice Channel'}</h2>
        </div>
        <div className="text-[10px] text-gray-500 font-mono">ENCRYPTED P2P CONNECTION</div>
      </div>

      {/* VIDEO GRID */}
      <div className="flex-1 p-4 grid grid-cols-2 gap-4 content-start overflow-y-auto relative">
        {participants.length > 0 ? participants.map((p, i) => (
          <div key={p.id || i} className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#111] aspect-video">
            <div className="w-full h-full flex items-center justify-center">
              {p.user_avatar ? (
                <img src={p.user_avatar} className="w-16 h-16 rounded-full object-cover border-2 border-white/10" alt="" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-900 flex items-center justify-center text-white text-2xl font-bold border-2 border-white/10">
                  {p.user_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span className="bg-black/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold text-white border border-white/10">
                {p.user_name || 'User'}
              </span>
              {p.is_muted && <MicOff size={12} className="text-red-500" />}
            </div>
          </div>
        )) : (
          <>
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#111] aspect-video flex items-center justify-center">
              <div className="text-gray-600 text-xs font-mono">Waiting for participants...</div>
            </div>
          </>
        )}

        {/* AI OVERLAY */}
        <AnimatePresence>
          {aiActive && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-4 right-4 w-64 bg-black/90 backdrop-blur-xl border border-[#FF3333]/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(255,51,51,0.2)] z-20"
            >
              <div className="flex items-center gap-2 mb-2 text-[#FF3333]">
                <Bot size={16} /> <span className="text-xs font-black uppercase tracking-widest">Spidr_AI Active</span>
              </div>
              <div className="h-8 flex items-center gap-1">
                {[...Array(6)].map((_, i) => (
                  <motion.div key={i} animate={{ height: ['20%', '100%', '20%'] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }} className="w-1.5 bg-[#FF3333] rounded-full" />
                ))}
              </div>
              <div className="mt-2 text-[10px] text-gray-400 font-mono">Listening... Say "Hey Spidr" to command.</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CONTROL CONSOLE */}
      <div className="h-24 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-center gap-4 px-6">
        <CallButton icon={MonitorUp} label="Share" active={false} />
        <CallButton icon={Video} label="Camera" active={false} />
        
        {/* Effects Menu */}
        <div className="relative group">
          <CallButton icon={Wand2} label="Effects" active={activeFilter !== 'none' || voiceChanger !== 'none'} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 bg-[#111] border border-white/10 rounded-xl p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto shadow-2xl z-50">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Visual Filters</div>
            <div className="flex gap-1 mb-2">
              <EffectBtn label="Glitch" onClick={() => setActiveFilter('glitch')} active={activeFilter === 'glitch'} />
              <EffectBtn label="Neon" onClick={() => setActiveFilter('neon')} active={activeFilter === 'neon'} />
              <EffectBtn label="Off" onClick={() => setActiveFilter('none')} active={activeFilter === 'none'} />
            </div>
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Voice Modulator</div>
            <div className="flex gap-1">
              <EffectBtn label="Venom" onClick={() => setVoiceChanger('symbiote')} active={voiceChanger === 'symbiote'} />
              <EffectBtn label="Anon" onClick={() => setVoiceChanger('anon')} active={voiceChanger === 'anon'} />
              <EffectBtn label="Off" onClick={() => setVoiceChanger('none')} active={voiceChanger === 'none'} />
            </div>
          </div>
        </div>

        <CallButton icon={isMuted ? MicOff : Mic} label="Mic" active={!isMuted} onClick={onToggleMute} />
        
        {/* Summon AI */}
        <button onClick={() => setAiActive(!aiActive)} className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${aiActive ? 'bg-[#FF3333]/20 text-[#FF3333]' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}`}>
          <Bot size={24} />
          <span className="text-[9px] font-bold uppercase">Spidr AI</span>
        </button>

        <div className="w-[1px] h-10 bg-white/10 mx-2" />
        
        <button onClick={onDisconnect} className="bg-red-600 hover:bg-red-500 text-white p-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]">
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}

const CallButton = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${active ? 'bg-white/10 text-white' : 'bg-[#111] hover:bg-white/5 text-gray-500 hover:text-white border border-white/5'}`}>
    <Icon size={24} />
    <span className="text-[9px] font-bold uppercase">{label}</span>
  </button>
);

const EffectBtn = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`flex-1 py-1 text-[9px] font-bold rounded ${active ? 'bg-[#FF3333] text-white' : 'bg-black text-gray-400 hover:text-white border border-white/10'}`}>
    {label}
  </button>
);