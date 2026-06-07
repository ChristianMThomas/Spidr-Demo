import React from 'react';

/**
 * NameplateBackground — paints an APEX user's custom nameplate image as the
 * background of a list row (sidebar member, friend, group member, DM).
 *
 * Usage pattern:
 *   <div className="relative ...row classes...">
 *     <NameplateBackground url={user.apex_features?.nameplate_url} />
 *     ...row content (must have its own z-index / be naturally above
 *        absolute-positioned siblings via the stacking context)
 *   </div>
 *
 * Renders nothing when `url` is falsy, so it's safe to drop in
 * unconditionally — the cheap render means non-APEX users (or APEX users
 * who haven't uploaded artwork yet) get a single boolean check.
 *
 * The Spidr Legibility Engine
 * ───────────────────────────
 * Users will upload anything: neon-yellow memes, blinding GIFs, busy art.
 * To keep usernames readable no matter what they uploaded, every nameplate
 * is composited with a fixed dark-to-transparent gradient mask on top.
 * The avatar + username live on the left third of a row, which is exactly
 * where the gradient is darkest (≈90% black). The right two-thirds fade
 * out so the user's artwork stays visible. This is the "secret sauce"
 * that lets us give people total creative freedom without breaking the UI.
 *
 * Props:
 *   url          the nameplate image URL (jpg / png / gif). Falsy = no-op.
 *   className    extra classes on the wrapper (rounding inherits by default)
 *   intensity    "subtle" (default; ~55% opacity image, normal gradient)
 *                | "strong" (full opacity image, stronger gradient anchor).
 *                "subtle" suits dense list rows; "strong" suits hover/active
 *                or larger banner-style rows.
 */
export default function NameplateBackground({ url, className = '', intensity = 'subtle' }) {
  if (!url) return null;

  const imageOpacity = intensity === 'strong' ? 0.85 : 0.55;
  // The gradient is intentionally darker on the left. The two named stops
  // are tuned for typical row layouts where avatar + name occupy the first
  // ~40% of the row width. Pure black at the start fades through the
  // username area, then drops to transparent so the artwork shows on the
  // right side.
  const gradient = intensity === 'strong'
    ? 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.60) 50%, rgba(0,0,0,0.05) 100%)'
    : 'linear-gradient(to right, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.50) 50%, rgba(0,0,0,0.00) 100%)';

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ borderRadius: 'inherit' }}
      aria-hidden="true"
    >
      <img
        src={url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: imageOpacity }}
        loading="lazy"
        // If a user's image 404s, vanish quietly rather than render a
        // broken-image icon in the middle of every list row.
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div
        className="absolute inset-0"
        style={{ background: gradient }}
      />
    </div>
  );
}
