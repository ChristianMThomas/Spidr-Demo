import React from 'react';

export function SpidrWordmark({ className = '' }) {
  return <img src="/brand/spidr-wordmark.png" alt="Spidr" width={1448} height={1086} draggable={false} className={`object-contain ${className}`} />;
}

export function BrandLoading() {
  return <div role="status" aria-label="Loading Spidr" className="flex-1 min-h-[240px] w-full flex flex-col items-center justify-center gap-6 bg-[#08090b]">
    <SpidrWordmark className="w-56 max-w-[65%] h-auto" />
    <div aria-hidden="true" className="h-1 w-28 rounded bg-red-500 motion-safe:animate-pulse" />
    <span className="sr-only">Loading Spidr</span>
  </div>;
}
