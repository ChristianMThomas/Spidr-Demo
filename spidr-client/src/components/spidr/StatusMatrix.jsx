import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Moon, ShieldAlert, EyeOff } from 'lucide-react';

const STATUS_TYPES = [
  { id: 'online', label: 'SIGNAL: ACTIVE', color: '#10B981', icon: Activity },
  { id: 'idle', label: 'SIGNAL: DORMANT', color: '#F59E0B', icon: Moon },
  { id: 'dnd', label: 'SIGNAL: JAMMED', color: '#FF3333', icon: ShieldAlert },
  { id: 'offline', label: 'SIGNAL: CLOAKED', color: '#6B7280', icon: EyeOff },
];

export default function StatusMatrix({ currentStatus, onSetStatus }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* THE TRIGGER (Your Pulse) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center group"
      >
        <div className={`w-3 h-3 rounded-full ${getStatusColor(currentStatus)} animate-pulse shadow-[0_0_10px_currentColor]`} />
        {/* Web Ring Animation */}
        <div className="absolute inset-0 rounded-full border border-white/5 group-hover:scale-125 transition-transform duration-500" />
      </button>

      {/* THE RADIAL MATRIX (Spins out) */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click backdrop to close */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <div className="absolute bottom-14 left-0 w-48 h-48 -translate-x-1/4 z-50 pointer-events-none">
               {STATUS_TYPES.map((status, index) => {
                 // Calculate radial position (Fan out upwards)
                 const angle = -90 + (index * 30); // Start at -90deg (top)
                 const radius = 80;
                 const x = Math.cos((angle * Math.PI) / 180) * radius; 
                 const y = Math.sin((angle * Math.PI) / 180) * radius;

                 return (
                   <motion.button
                     key={status.id}
                     onClick={() => { onSetStatus(status.id); setIsOpen(false); }}
                     initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                     animate={{ x, y, scale: 1, opacity: 1 }}
                     exit={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                     transition={{ type: "spring", delay: index * 0.05 }}
                     className="absolute left-1/2 top-1/2 -ml-5 -mt-5 w-10 h-10 bg-[#111] border border-white/20 rounded-full flex items-center justify-center pointer-events-auto hover:scale-125 hover:border-white transition-all shadow-xl group"
                   >
                     <status.icon size={16} style={{ color: status.color }} />
                     
                     {/* Hover Label */}
                     <div className="absolute bottom-full mb-2 bg-black text-[9px] font-bold text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10">
                       {status.label}
                     </div>
                   </motion.button>
                 );
               })}
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function getStatusColor(status) {
  switch(status) {
    case 'online': return 'bg-emerald-500 text-emerald-500';
    case 'idle': return 'bg-amber-500 text-amber-500';
    case 'dnd': return 'bg-red-500 text-red-500';
    default: return 'bg-gray-500 text-gray-500';
  }
}