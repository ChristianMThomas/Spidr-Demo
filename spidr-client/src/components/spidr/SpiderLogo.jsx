import React from 'react';

/**
 * SpiderLogo — uses the real Spidr logo image.
 * withBackground=true  → uses logo-bg.png (gradient background version)
 * withBackground=false → uses logo.png (transparent background)
 */
export default function SpiderLogo({ size = 40, className = '', withBackground = false }) {
  return (
    <img
      src={withBackground ? '/logo-bg.png' : '/logo.png'}
      alt="Spidr"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ imageRendering: 'auto' }}
    />
  );
}

export const LOGO_URL      = '/logo.png';
export const LOGO_WITH_BG_URL = '/logo-bg.png';
