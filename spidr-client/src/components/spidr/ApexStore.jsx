import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { entities, auth } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { Zap, Crown, Wifi, HardDrive, X, Users, PaintBucket, Settings } from 'lucide-react';
import ApexCommand from './ApexCommand';

export default function ApexStore({ isOpen, onClose, currentTier = 'free', currentUser: propUser, profile: propProfile }) {
  const [showCommand, setShowCommand] = useState(false);
  const { data: fetchedUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => auth.me(), staleTime: 120000 });
  const currentUser = propUser || fetchedUser;
  const { data: fetchedProfile } = useQuery({ queryKey: ['userProfile', currentUser?.id], queryFn: () => entities.UserProfile.filter({ user_id: currentUser.id }).then(r => r[0]), enabled: !!currentUser?.id, staleTime: 60000 });
  const profile = propProfile || fetchedProfile;
  
  if (!isOpen) return null;

  // Render via a portal to document.body so the modal escapes the Sidebar's
  // stacking context (the sidebar wrapper now has an opacity style, which
  // would otherwise trap position:fixed inside the bar — that's why APEX was
  // showing cramped in the sidebar instead of as a full-screen popup).
  return createPortal((
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full max-w-4xl bg-[#0a0a0a] border border-[#FF3333]/30 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(255,51,51,0.2)] flex ${showCommand ? 'pointer-events-none opacity-30' : ''}`}
      >
        
        {/* LEFT: THE PITCH */}
        <div className="w-1/3 bg-[#111] p-8 border-r border-white/5 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF3333] to-transparent animate-pulse" />
          
          <div className="mb-8">
             <h1 className="text-4xl font-black text-white italic tracking-tighter">
               SPIDR <span className="text-[#FF3333]">APEX</span>
             </h1>
             <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest">
               Evolutionary Status: <span className="text-white">UNLOCKED</span>
             </p>
          </div>

          <div className="space-y-6 flex-1">
             <FeatureRow icon={PaintBucket} title="Expression is Free" desc="Everyone gets GIFs, Banners, and Emojis. We don't gatekeep fun." active={true} />
             <FeatureRow icon={Crown} title="Infrastructure is Paid" desc="Support the servers, get massive power in return." active={false} />
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="text-2xl font-bold text-white">$7.99<span className="text-sm text-gray-500 font-normal">/mo</span></div>
            <button 
              onClick={() => setShowCommand(true)}
              className="w-full mt-4 py-3 bg-[#FF3333] text-white font-black rounded-xl hover:scale-105 transition-transform shadow-lg shadow-red-900/20"
            >
              {currentTier === 'apex' ? 'MANAGE SUBSCRIPTION' : 'INITIATE UPGRADE'}
            </button>
          </div>
        </div>

        {/* RIGHT: THE FEATURE GRID */}
        <div className="flex-1 p-8 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-[#050505]">
           <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold text-white">System Capabilities</h2>
             <div className="flex items-center gap-2">
               {currentTier === 'apex' && (
                 <button 
                   onClick={() => setShowCommand(true)}
                   className="p-2 text-[#FF3333] hover:bg-[#FF3333]/20 rounded-lg transition-colors"
                   title="Manage Subscription"
                 >
                   <Settings size={20} />
                 </button>
               )}
               <button onClick={onClose}><X className="text-gray-500 hover:text-white" /></button>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             {/* 1. SQUAD OVERCLOCK (The Hero Feature) */}
             <ApexCard 
               icon={Users}
               title="Squad Overclock"
               desc="Boost an entire voice call to 4K/60FPS for all friends. Be the hero."
               color="text-yellow-400"
               borderColor="border-yellow-400/20"
             />

             {/* 2. THREAD SKINS */}
             <ApexCard 
               icon={PaintBucket}
               title="Thread Skins"
               desc="Customize your hanging silk in calls. RGB, Venom, Glitch, and Invisible."
               color="text-purple-400"
               borderColor="border-purple-400/20"
             />

             {/* 3. ENTRY PROTOCOLS */}
             <ApexCard 
               icon={Zap}
               title="Entry Protocols"
               desc="Custom entrance SFX and visual screen shake when joining channels."
               color="text-blue-400"
               borderColor="border-blue-400/20"
             />

             {/* 4. DEEP STORAGE */}
             <ApexCard 
               icon={HardDrive}
               title="Deep Storage"
               desc="5GB File Upload limit per file. Archive your entire digital life."
               color="text-green-400"
               borderColor="border-green-400/20"
             />
           </div>

           {/* PREVIEW AREA */}
           <div className="mt-6 p-4 bg-[#111] rounded-xl border border-white/5 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                <strong className="text-white block mb-1">Visual Preview: RGB Thread</strong>
                Hover to test physics
              </div>
              <div className="h-16 w-32 relative flex justify-center border-t border-gray-700">
                 {/* RGB Thread Animation */}
                 <div className="w-[2px] h-full bg-gradient-to-b from-red-500 via-green-500 to-blue-500 animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                 <div className="absolute bottom-0 w-8 h-8 rounded-full bg-gray-800 border-2 border-white/20" />
              </div>
           </div>

        </div>

      </motion.div>

      {/* Subscription Management */}
      <ApexCommand 
        isOpen={showCommand} 
        onClose={() => setShowCommand(false)}
        currentTier={currentTier}
        currentUser={currentUser}
        profile={profile}
      />
    </div>
  ), document.body);
}

// Sub-components
function FeatureRow({ icon: Icon, title, desc, active }) {
  return (
    <div className={`flex gap-4 ${active ? 'opacity-100' : 'opacity-50'}`}>
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-[10px] text-gray-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ApexCard({ icon: Icon, title, desc, color, borderColor }) {
  return (
    <div className={`p-4 rounded-xl bg-[#0a0a0a] border ${borderColor} hover:bg-[#111] transition-colors group cursor-default`}>
       <div className={`mb-3 ${color} group-hover:scale-110 transition-transform`}>
         <Icon size={24} />
       </div>
       <h3 className="font-bold text-white text-sm mb-1">{title}</h3>
       <p className="text-[10px] text-gray-500">{desc}</p>
    </div>
  );
}