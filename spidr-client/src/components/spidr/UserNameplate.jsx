import React from 'react';

/**
 * UserNameplate (Patch 2.4) — renders a user's display name with an optional
 * APEX nameplate style. Falls back to plain text for non-APEX / 'default'.
 *
 * Props:
 *   name              the display name string
 *   style             'default' | 'glitch' | 'neon' | 'terminal'
 *   apexColor         the user's APEX thread color (used by 'neon')
 *   className         extra classes for the wrapper
 */
export default function UserNameplate({ name, style = 'default', apexColor = '#FF3333', className = '' }) {
  const base = `truncate ${className}`;

  if (style === 'glitch') {
    // Chromatic aberration / RGB split via layered text-shadow.
    return (
      <span
        className={base}
        style={{ textShadow: '1.5px 0 0 rgba(255,0,80,0.7), -1.5px 0 0 rgba(0,234,255,0.7)' }}
      >
        {name}
      </span>
    );
  }

  if (style === 'neon') {
    return (
      <span
        className={base}
        style={{ color: '#fff', textShadow: `0 0 6px ${apexColor}, 0 0 12px ${apexColor}` }}
      >
        {name}
      </span>
    );
  }

  if (style === 'terminal') {
    return (
      <span
        className={`${base} font-mono font-bold`}
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)',
          backgroundClip: 'padding-box',
          padding: '0 2px',
          borderRadius: '2px',
        }}
      >
        {name}
      </span>
    );
  }

  return <span className={base}>{name}</span>;
}
