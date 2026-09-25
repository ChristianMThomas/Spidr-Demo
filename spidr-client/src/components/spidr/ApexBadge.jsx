import React from 'react';
import apexCrest from '@/assets/spidr-apex-subscriber.png';

const SIZE_CLASSES = {
  md: 'w-[132px] h-[44px]',
};

export default function ApexBadge({ size = 'md', className = '' }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return (
    <div title="Spidr APEX subscriber" className={`inline-flex shrink-0 max-w-full items-center ${className}`}>
      <img
        src={apexCrest}
        alt="Spidr APEX subscriber"
        className={`${sizeClass} max-w-full object-contain select-none`}
        draggable={false}
      />
    </div>
  );
}
