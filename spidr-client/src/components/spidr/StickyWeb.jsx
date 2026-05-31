import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, X, Eye } from 'lucide-react';

export default function StickyWeb({ isOpen, onClose, pinnedMessages = [], onJump }) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col shadow-2xl">
      
      {/* HEADER */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#111]">
        <div className="flex items-center gap-2">
           <Pin size={16} className="text-[#FF3333]" />
           <span className="font-bold text-white text-sm tracking-wider">MEMORY WEB</span>
        </div>
        <button onClick={onClose}><X className="text-gray-500 hover:text-white" /></button>
      </div>

      {/* THE WEB CONTAINER */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden p-6">
        {/* Background Web SVG */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <svg width="100%" height="100%">
              <path d="M0,0 Q150,150 300,0 M0,150 Q150,0 300,150 M150,0 V300 M0,150 H300" stroke="white" strokeWidth="1" fill="none" />
           </svg>
        </div>

        {/* THE COCOONS (Pinned Items) */}
        <div className="space-y-8 relative z-10">
          {pinnedMessages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-12">
              <Pin size={32} className="mx-auto mb-2 opacity-30" />
              <p>No memories preserved yet.</p>
              <p className="text-xs mt-2">Drag messages here to wrap them in silk.</p>
            </div>
          ) : (
            pinnedMessages.map((item, index) => (
              <StickyCocoon key={item.id} item={item} index={index} onJump={onJump} />
            ))
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 text-center text-[10px] text-gray-500 border-t border-white/5">
        DRAG MESSAGES HERE TO PRESERVE
      </div>

    </div>
  );
}

function StickyCocoon({ item, index, onJump }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onJump?.(item.id)}
      className="relative cursor-pointer group"
    >
      {/* 1. THE SILK WRAPPING (Visual Overlay) */}
      <div className={`absolute -inset-2 bg-white/5 rounded-xl border border-white/10 transition-all duration-500 ${isHovered ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}>
         {/* Procedural "Silk" Lines */}
         <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/20 rotate-12" />
         <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/20 -rotate-6" />
         <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white/20 rotate-45" />
      </div>

      {/* 2. THE CONTENT (Hidden until hover) */}
      <div className={`
        relative bg-[#111] border border-[#FF3333]/20 rounded-lg overflow-hidden transition-all duration-300
        ${isHovered ? 'brightness-100 shadow-[0_0_20px_rgba(255,51,51,0.2)]' : 'brightness-50 blur-[1px]'}
      `}>
         {item.attachments && item.attachments.length > 0 ? (
           <img src={item.attachments[0]} className="w-full h-32 object-cover" alt="pinned" />
         ) : (
           <div className="p-4 text-xs text-gray-300 font-mono break-words">
             {item.content}
           </div>
         )}
         
         {/* Metadata Tag */}
         <div className="absolute bottom-0 left-0 w-full bg-black/80 p-1 px-2 flex justify-between items-center">
            <span className="text-[9px] font-bold text-[#FF3333] uppercase">{item.author_name || item.sender_name}</span>
            <span className="text-[9px] text-gray-500">{new Date(item.created_date).toLocaleDateString()}</span>
         </div>
      </div>

      {/* 3. THE "THREAD" HOLDING IT */}
      <div className="absolute -top-8 left-1/2 w-[1px] h-8 bg-white/20 -z-10 group-hover:bg-[#FF3333] transition-colors" />

    </motion.div>
  );
}