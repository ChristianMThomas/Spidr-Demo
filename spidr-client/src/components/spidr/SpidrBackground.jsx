import React from 'react';

/**
 * SpidrBackground — the deep-crimson layered backdrop for the expanded voice
 * deck (and anywhere else that wants the signature look). Two static layers:
 * a radial crimson core glow + a faint tiled spidr-web vector. Kept as plain
 * CSS (no animation, no backdrop-filter) so it's cheap to paint.
 */
export default function SpidrBackground({ children, className = '' }) {
  return (
    <div className={`relative w-full h-full bg-[#020202] overflow-hidden font-sans text-white ${className}`}>
      {/* LAYER 1: The Deep Crimson Core Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_60%,_rgba(153,27,27,0.12)_0%,_rgba(0,0,0,1)_60%)]" />
      {/* LAYER 2: The Faint Spidr Web Vector Overlay */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-screen"
        style={{
          opacity: 0.15,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0L120 30L120 90L60 120L0 90L0 30Z' stroke='%23ef4444' stroke-width='0.5' fill='none'/%3E%3Cpath d='M60 30L90 45L90 75L60 90L30 75L30 45Z' stroke='%23ef4444' stroke-width='0.5' fill='none'/%3E%3Cline x1='60' y1='0' x2='60' y2='120' stroke='%23ef4444' stroke-width='0.5'/%3E%3Cline x1='0' y1='30' x2='120' y2='90' stroke='%23ef4444' stroke-width='0.5'/%3E%3Cline x1='0' y1='90' x2='120' y2='30' stroke='%23ef4444' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '400px 400px',
          backgroundPosition: 'center',
        }}
      />
      {/* FOREGROUND */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
