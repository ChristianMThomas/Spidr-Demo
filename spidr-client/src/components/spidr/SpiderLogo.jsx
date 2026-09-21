import React from 'react';

/**
 * SpiderLogo — uses the real Spidr logo image.
 * withBackground=true  → app icon with its supplied background
 * withBackground=false → transparent home-button symbol
 */
export default function SpiderLogo({ size = 40, className = '', withBackground = false }) {
  return (
    <img
      src={withBackground ? '/brand/spidr-app-icon.png' : '/brand/spidr-symbol.png'}
      alt="Spidr"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ imageRendering: 'auto' }}
    />
  );
}

export const LOGO_URL      = '/brand/spidr-symbol.png';
export const LOGO_WITH_BG_URL = '/brand/spidr-app-icon.png';
