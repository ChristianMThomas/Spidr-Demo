/**
 * Bubble Gradients — curated, premium-only DM chat-bubble themes.
 *
 * APEX users get to personalize their outgoing bubble color, but they pick
 * from this curated set rather than a free-form color picker. Every gradient
 * here is hand-tuned to:
 *
 *   1. Sit on top of the dark Spidr canvas as a TINT, not a solid neon block
 *      — alphas are clamped to the 0.10–0.22 range so the dark theme reads
 *      through. A blinding yellow has no path into this registry.
 *   2. Pair a luminous accent color (used for the border + subtle glow) with a
 *      deeper companion (used as the gradient's second stop) so each bubble
 *      reads with depth instead of flatness.
 *   3. Keep text legible — every gradient is intentionally low-contrast in
 *      the fill so the standard zinc-200 message text stays readable.
 *
 * Adding a new gradient: just append to BUBBLE_GRADIENTS. The picker UI and
 * the MessageItem renderer pick it up automatically.
 */

export const BUBBLE_GRADIENTS = [
  {
    id: 'default',
    label: 'Crimson Default',
    description: 'The classic Spidr red tint.',
    accent: '#FF3333',
    from:   'rgba(255, 51, 51, 0.07)',
    to:     'rgba(255, 51, 51, 0.07)',
    border: 'rgba(255, 51, 51, 0.18)',
    glow:   'rgba(255, 51, 51, 0.04)',
    apexOnly: false,
  },
  {
    id: 'crimson-fade',
    label: 'Crimson Fade',
    description: 'Blood-red bleeding into ember.',
    accent: '#ef4444',
    from:   'rgba(220, 38, 38, 0.22)',
    to:     'rgba(127, 29, 29, 0.18)',
    border: 'rgba(239, 68, 68, 0.55)',
    glow:   'rgba(239, 68, 68, 0.16)',
    apexOnly: true,
  },
  {
    id: 'deep-oceanic',
    label: 'Deep Oceanic',
    description: 'Sky surface to abyssal navy.',
    accent: '#3b82f6',
    from:   'rgba(56, 189, 248, 0.18)',
    to:     'rgba(30, 58, 138, 0.22)',
    border: 'rgba(59, 130, 246, 0.55)',
    glow:   'rgba(59, 130, 246, 0.15)',
    apexOnly: true,
  },
  {
    id: 'toxic-purple',
    label: 'Toxic Purple',
    description: 'Radioactive violet over deep purple.',
    accent: '#a855f7',
    from:   'rgba(168, 85, 247, 0.20)',
    to:     'rgba(88, 28, 135, 0.22)',
    border: 'rgba(168, 85, 247, 0.55)',
    glow:   'rgba(168, 85, 247, 0.16)',
    apexOnly: true,
  },
  {
    id: 'emerald-pulse',
    label: 'Emerald Pulse',
    description: 'Living emerald into forest deep.',
    accent: '#10b981',
    from:   'rgba(16, 185, 129, 0.18)',
    to:     'rgba(6, 78, 59, 0.22)',
    border: 'rgba(16, 185, 129, 0.50)',
    glow:   'rgba(16, 185, 129, 0.14)',
    apexOnly: true,
  },
  {
    id: 'sunset-burn',
    label: 'Sunset Burn',
    description: 'Magma orange smoldering into rust.',
    accent: '#f97316',
    from:   'rgba(249, 115, 22, 0.20)',
    to:     'rgba(124, 45, 18, 0.22)',
    border: 'rgba(249, 115, 22, 0.55)',
    glow:   'rgba(249, 115, 22, 0.15)',
    apexOnly: true,
  },
  {
    id: 'cyber-mint',
    label: 'Cyber Mint',
    description: 'Holographic mint over deep teal.',
    accent: '#06b6d4',
    from:   'rgba(34, 211, 238, 0.18)',
    to:     'rgba(8, 51, 68, 0.22)',
    border: 'rgba(6, 182, 212, 0.55)',
    glow:   'rgba(6, 182, 212, 0.15)',
    apexOnly: true,
  },
  {
    id: 'ghost-silver',
    label: 'Ghost Silver',
    description: 'Monochrome silk — for the minimalist.',
    accent: '#e5e5e5',
    from:   'rgba(244, 244, 245, 0.10)',
    to:     'rgba(63, 63, 70, 0.18)',
    border: 'rgba(228, 228, 231, 0.35)',
    glow:   'rgba(228, 228, 231, 0.08)',
    apexOnly: true,
  },
];

const BY_ID = Object.fromEntries(BUBBLE_GRADIENTS.map(g => [g.id, g]));

/** Look up a gradient by id; falls back to the default if unknown. */
export function getBubbleGradient(id) {
  return BY_ID[id] || BY_ID['default'];
}

/**
 * Read the gradient choice from a user profile. Returns the canonical
 * gradient object — non-APEX users (or users who haven't picked) get the
 * default. Centralizing this here means the rest of the app never has to
 * worry about the tier check.
 */
export function getBubbleGradientForProfile(profile) {
  if (!profile) return BY_ID['default'];
  const id = profile.apex_features?.bubble_gradient;
  if (!id) return BY_ID['default'];
  const g = BY_ID[id];
  if (!g) return BY_ID['default'];
  // Gate apex-only gradients behind the tier check so a stale profile with a
  // premium id can't bypass entitlements.
  if (g.apexOnly && profile.apex_tier !== 'apex') return BY_ID['default'];
  return g;
}

/**
 * Build the inline style for a bubble given the sender's chosen gradient.
 * Returns null if the gradient is the default (so callers can fall back to
 * their existing Tailwind classes and avoid a runtime style switch).
 *
 *   buildBubbleStyle(gradient, { variant: 'own' | 'incoming' })
 */
export function buildBubbleStyle(gradient, { variant = 'incoming' } = {}) {
  if (!gradient || gradient.id === 'default') return null;
  // Outgoing bubbles get a slight extra weight (the gradient runs from
  // bottom-right toward the message body), incoming gets the mirrored angle.
  const angle = variant === 'own' ? 225 : 135;
  return {
    background: `linear-gradient(${angle}deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
    borderColor: gradient.border,
    boxShadow: `0 0 22px ${gradient.glow}, inset 0 0 18px ${gradient.glow}`,
  };
}

/**
 * Build the small triangular accent overlay that hangs in the bubble's
 * corner (matching the existing APEX corner-glow effect, but tinted to the
 * sender's chosen gradient).
 */
export function buildBubbleCornerStyle(gradient, { variant = 'incoming' } = {}) {
  if (!gradient || gradient.id === 'default') return null;
  // Corner sits opposite the bubble's pointed tail.
  const corner = variant === 'own' ? 'to top left' : 'to bottom left';
  return {
    background: `linear-gradient(${corner}, ${gradient.from}, transparent)`,
  };
}
