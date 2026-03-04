import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import SpiderLogo from './SpiderLogo';

export default function SpidrBot() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'spidr-system-bot',
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: 999,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="relative">
      {/* Spider Thread */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 -top-8 w-0.5 h-8 bg-gradient-to-b from-transparent via-red-500/50 to-red-500"
        animate={{
          height: isDragging ? 32 : 20,
          opacity: isDragging ? 1 : 0.7
        }}
      />
      
      {/* Pulsing Rings when dragging */}
      {isDragging && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-500"
            animate={{
              scale: [1, 1.5],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-500"
            animate={{
              scale: [1, 1.5],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: 0.3,
              ease: "easeOut"
            }}
          />
        </>
      )}
      
      {/* Spider Body */}
      <motion.div
        className="relative w-12 h-12 bg-zinc-950 border-2 border-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50"
        animate={{
          boxShadow: isDragging 
            ? '0 0 30px rgba(239, 68, 68, 0.8)' 
            : '0 0 15px rgba(239, 68, 68, 0.5)',
          scale: isDragging ? 1.1 : 1
        }}
        whileHover={{ scale: 1.05 }}
      >
        <SpiderLogo size={24} />
      </motion.div>
      
      {/* Ghost Web Trail Effect */}
      {isDragging && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" style={{ overflow: 'visible' }}>
            <motion.circle
              cx="50%"
              cy="50%"
              r="20"
              stroke="#ef4444"
              strokeWidth="1"
              fill="none"
              initial={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: 0, scale: 2 }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </svg>
        </div>
      )}
    </div>
  );
}