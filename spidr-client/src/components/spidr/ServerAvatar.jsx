import React, { useState, useEffect } from 'react';

/**
 * ServerAvatar — a server icon that can never render the browser's broken-image
 * glyph.
 *
 * User-uploaded icon URLs die: blobs get pruned, CDNs expire links, a server
 * owner deletes the source. When that happens a raw <img> shows the torn-page
 * icon, which looks worse than having no image at all.
 *
 * This component swaps to a clean initials tile on failure. It's a deliberate
 * upgrade over the app-wide broken-image net in lib/imageFallback.js: that one
 * catches EVERY <img> globally and substitutes a generic spider mark, which is
 * the right default but tells you nothing. Here we know the server's name, so
 * "Anime Haven" degrades to a tidy "AN" tile that still identifies the server
 * at a glance.
 *
 * Also resets its failure state when `src` changes, so a server that gets a
 * fresh icon uploaded stops showing initials without a remount.
 */
export default function ServerAvatar({
  src,
  name,
  size = 40,
  className = '',
  rounded = 'rounded-xl',
  fallbackClassName = '',
  letters = 2,
}) {
  const [failed, setFailed] = useState(false);

  // A new URL deserves a fresh attempt — otherwise re-uploading an icon would
  // leave the tile stuck on initials until the component unmounted.
  useEffect(() => { setFailed(false); }, [src]);

  const initials = (name || '')
    .trim()
    .slice(0, letters)
    .toUpperCase() || 'SP';

  const box = { width: size, height: size };

  if (!src || failed) {
    // fallbackClassName lets each call site keep its established look (the
    // red gradient tiles in NerveCenter/EngagementHub, the glass tile in the
    // Server Matrix) instead of every server icon in the app snapping to one
    // style. Defaults to the glass treatment when not specified.
    const skin = fallbackClassName || 'bg-white/5 border border-white/10 text-white/60';
    return (
      <div
        style={box}
        aria-label={name || 'Server'}
        className={`${rounded} shrink-0 flex items-center justify-center font-black tracking-widest select-none ${skin} ${className}`}
      >
        <span style={{ fontSize: Math.max(9, Math.round(size * 0.3)) }}>{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || ''}
      style={box}
      draggable={false}
      // data-fallback is read by the global handler in lib/imageFallback.js;
      // setting it to nothing here is fine because our own onError fires first
      // and swaps to the initials tile via state.
      onError={() => setFailed(true)}
      className={`${rounded} shrink-0 object-cover bg-[#111] ${className}`}
    />
  );
}
