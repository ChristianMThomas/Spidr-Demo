import React from 'react';
import { motion } from 'framer-motion';

export default function SpiderWeb({ position = 'top-left', size = 'medium', opacity = 0.1 }) {
  const sizes = {
    small: 'w-32 h-32',
    medium: 'w-48 h-48',
    large: 'w-64 h-64'
  };

  const positions = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0 rotate-90',
    'bottom-left': 'bottom-0 left-0 -rotate-90',
    'bottom-right': 'bottom-0 right-0 rotate-180'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity, scale: 1 }}
      transition={{ duration: 1 }}
      className={`absolute ${positions[position]} ${sizes[size]} pointer-events-none`}
    >
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Radial threads */}
        <line x1="100" y1="0" x2="100" y2="200" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        <line x1="20" y1="20" x2="180" y2="180" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        <line x1="180" y1="20" x2="20" y2="180" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        <line x1="100" y1="0" x2="180" y2="180" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        <line x1="100" y1="0" x2="20" y2="180" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        <line x1="0" y1="100" x2="180" y2="20" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        <line x1="0" y1="100" x2="180" y2="180" stroke="currentColor" strokeWidth="0.5" className="text-red-500" />
        
        {/* Circular threads */}
        <circle cx="100" cy="100" r="20" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-red-500" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-red-500" />
        <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-red-500" />
        <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-red-500" />
        <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-red-500" />
      </svg>
    </motion.div>
  );
}