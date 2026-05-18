/**
 * Shared username style constants and helpers.
 *
 * USED EVERYWHERE a username is rendered. Two main entry points:
 *
 *   buildUsernameStyle(profile)
 *     For places where there's no server context (HolographicProfile, DMs,
 *     group chats, settings preview). Just applies the user's saved style.
 *
 *   resolveServerUsername({ profile, server, userId })
 *     For server channels. Returns { name, style, effect, hasRoleColor }
 *     after applying server-level overrides:
 *       • nickname (server.members[].nickname) overrides the display name
 *       • role color (server.roles[].color for the user's role) overrides the
 *         user's saved username_color
 *     The user's font / weight / italic settings still apply — only the color
 *     gets overridden by the role.
 *
 * These features are free for all users.
 */

export const USERNAME_FONTS = [
  { value: 'default',     label: 'Default',     css: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
  { value: 'serif',       label: 'Serif',       css: "'Playfair Display', Georgia, serif" },
  { value: 'mono',        label: 'Mono',        css: "'JetBrains Mono', 'Courier New', monospace" },
  { value: 'display',     label: 'Display',     css: "'Bebas Neue', 'Impact', sans-serif" },
  { value: 'handwriting', label: 'Handwriting', css: "'Caveat', 'Comic Sans MS', cursive" },
  { value: 'rounded',     label: 'Rounded',     css: "'Quicksand', 'Nunito', sans-serif" },
];

export const USERNAME_WEIGHTS = [
  { value: 'normal', label: 'Normal', css: 400 },
  { value: 'medium', label: 'Medium', css: 500 },
  { value: 'bold',   label: 'Bold',   css: 700 },
  { value: 'black',  label: 'Black',  css: 900 },
];

export const USERNAME_STYLES = [
  { value: 'normal', label: 'Normal' },
  { value: 'italic', label: 'Italic' },
];

/**
 * Visual effects palette.
 *
 *   none      — plain solid color
 *   glow      — solid color with a colored text-shadow halo
 *   gradient  — two-color linear gradient (user's color → second color)
 *   rainbow   — animated horizontal rainbow sweep
 *   pulse     — color pulses brighter and dimmer
 *   shimmer   — slow horizontal light shimmer across the text
 */
export const USERNAME_EFFECTS = [
  { value: 'none',     label: 'Solid' },
  { value: 'glow',     label: 'Glow' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'rainbow',  label: 'Rainbow' },
  { value: 'pulse',    label: 'Pulse' },
  { value: 'shimmer',  label: 'Shimmer' },
];

/**
 * Build a style object for a username given a profile (or partial form data).
 * Falls back gracefully when fields are missing.
 *
 * @param {object} profile   { username_font, username_weight, username_style,
 *                             username_color, username_effect, accent_color }
 * @param {object} [opts]
 * @param {string} [opts.fallbackColor]  used when username_color and accent_color are both empty
 * @param {string} [opts.overrideColor]  forces this color, bypassing username_color and accent_color
 *                                       (used for server role color overrides)
 * @returns {React.CSSProperties}
 */
export function buildUsernameStyle(profile, opts = {}) {
  if (!profile) return {};
  const font = USERNAME_FONTS.find(f => f.value === profile.username_font);
  const weight = USERNAME_WEIGHTS.find(w => w.value === profile.username_weight);

  const style = {};
  if (font && font.value !== 'default') style.fontFamily = font.css;
  if (weight) style.fontWeight = weight.css;
  if (profile.username_style === 'italic') style.fontStyle = 'italic';

  // Color resolution priority:
  //   1. Caller override (server role color)
  //   2. User's explicit username_color
  //   3. User's accent_color
  //   4. Caller fallback
  const color = opts.overrideColor || profile.username_color || profile.accent_color || opts.fallbackColor;

  const effect = opts.overrideColor
    ? 'none' // role colors always render as solid — never animated
    : (profile.username_effect || 'none');

  if (effect === 'none' || !effect) {
    if (color) style.color = color;
    return style;
  }

  if (effect === 'glow') {
    if (color) style.color = color;
    style.textShadow = `0 0 8px ${color || '#FF3333'}, 0 0 16px ${color || '#FF3333'}90`;
    return style;
  }

  if (effect === 'gradient') {
    const c1 = color || '#FF3333';
    // Second color shifts hue by 50 degrees toward purple
    style.background = `linear-gradient(90deg, ${c1}, #a855f7)`;
    style.WebkitBackgroundClip = 'text';
    style.backgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.color = 'transparent';
    return style;
  }

  if (effect === 'rainbow') {
    style.backgroundImage = 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #a855f7, #ec4899, #ef4444)';
    style.backgroundSize = '200% auto';
    style.WebkitBackgroundClip = 'text';
    style.backgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.color = 'transparent';
    style.animation = 'username-rainbow 4s linear infinite';
    return style;
  }

  if (effect === 'pulse') {
    if (color) style.color = color;
    style.animation = 'username-pulse 2s ease-in-out infinite';
    return style;
  }

  if (effect === 'shimmer') {
    const c1 = color || '#FF3333';
    style.backgroundImage = `linear-gradient(90deg, ${c1} 0%, #ffffff 50%, ${c1} 100%)`;
    style.backgroundSize = '200% auto';
    style.WebkitBackgroundClip = 'text';
    style.backgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.color = 'transparent';
    style.animation = 'username-shimmer 3s linear infinite';
    return style;
  }

  if (color) style.color = color;
  return style;
}

/**
 * Resolve a username for display inside a server channel.
 * Server-level overrides take precedence over the user's saved style.
 *
 * @param {object} args
 * @param {object} args.profile     The author's UserProfile (or null if not loaded yet)
 * @param {object} args.server      The current Server document (with .members and .roles)
 * @param {string} args.userId      The author's user_id
 * @param {string} [args.fallbackName]  used when no nickname and no profile.display_name
 * @returns {{
 *   name: string,
 *   style: React.CSSProperties,
 *   roleName: string|null,
 *   roleColor: string|null,
 *   hasNickname: boolean
 * }}
 */
export function resolveServerUsername({ profile, server, userId, fallbackName }) {
  const member = server?.members?.find(m => m.user_id === userId);

  // 1. Nickname > profile.display_name > member.user_name > fallback
  const name =
    (member?.nickname && member.nickname.trim()) ||
    profile?.display_name ||
    member?.user_name ||
    fallbackName ||
    'User';

  // 2. Find the member's role and its color (if any)
  let roleName = null;
  let roleColor = null;
  if (member?.role && server?.roles?.length) {
    const role = server.roles.find(r => r.name === member.role || r.id === member.role);
    if (role) {
      roleName = role.name;
      // Skip grey "default" role colors — they shouldn't override anything
      if (role.color && role.color !== '#6b7280' && role.color !== '#666' && role.color.toLowerCase() !== '#808080') {
        roleColor = role.color;
      }
    }
  }

  // 3. Build style with role color forcing solid (no animated effects on role names)
  const style = buildUsernameStyle(profile || {}, {
    overrideColor: roleColor,
    fallbackColor: '#fff',
  });

  return {
    name,
    style,
    roleName,
    roleColor,
    hasNickname: !!(member?.nickname && member.nickname.trim()),
  };
}
