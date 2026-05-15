/**
 * Shared username style constants and helpers.
 * Used by SettingsPanel (to render the picker) and any component that
 * renders a user's display name (HolographicProfile, MessageItem, etc).
 *
 * These features used to be APEX-gated. They are now free for all users.
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
 * Build a style object for a username given a profile (or partial form data).
 * Falls back gracefully when fields are missing.
 *
 * @param {object} profile  { username_font, username_weight, username_style, username_color, accent_color }
 * @param {object} [opts]
 * @param {string} [opts.fallbackColor]  used when username_color and accent_color are both empty
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

  const color = profile.username_color || profile.accent_color || opts.fallbackColor;
  if (color) style.color = color;

  return style;
}
