import React from 'react';
import apexCrest from '@/assets/spidr-apex-logo.png';

const SIZE_CLASSES = {
  md: 'w-7 h-7',
};

export default function ApexBadge({ size = 'md', className = '' }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return (
    <div className={`relative group inline-flex items-center ${className}`}>
      <img
        src={apexCrest}
        alt="APEX"
        className={`${sizeClass} object-contain drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] group-hover:scale-110 transition-transform cursor-help select-none`}
        draggable={false}
      />
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#050505] border border-[#d4af37]/40 text-[#d4af37] text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded shadow-[0_5px_15px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 flex items-center gap-1.5">
        <svg className="w-3 h-3 text-[#d4af37]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
        APEX Protocol
      </div>
    </div>
  );
}
