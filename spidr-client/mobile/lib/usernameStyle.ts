import { Platform } from 'react-native';

// Mobile port of spidr-client/src/lib/usernameStyle.js's buildUsernameStyle.
// Same field names, same color-resolution priority, so a style saved on
// mobile (Settings → Appearance → Username Style) or on web renders
// consistently everywhere a username appears — DMs, group chats, server
// channels, friends list, profile.
//
// RN can't do masked gradient-text without a native dependency (no
// expo-linear-gradient / @react-native-masked-view in this app), so
// gradient/rainbow/shimmer resolve to the plain color here — still saved
// and selectable from Settings, they just render fully wherever the web
// client draws the name.

export const USERNAME_FONTS = [
  { value: 'default', label: 'Default' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
  { value: 'display', label: 'Display' },
  { value: 'handwriting', label: 'Handwriting' },
  { value: 'rounded', label: 'Rounded' },
];

export const USERNAME_WEIGHTS = [
  { value: 'normal', label: 'Normal', css: '400' as const },
  { value: 'medium', label: 'Medium', css: '500' as const },
  { value: 'bold', label: 'Bold', css: '700' as const },
  { value: 'black', label: 'Black', css: '900' as const },
];

export const USERNAME_STYLES = [
  { value: 'normal', label: 'Normal' },
  { value: 'italic', label: 'Italic' },
];

export const USERNAME_EFFECTS = [
  { value: 'none', label: 'Solid' },
  { value: 'glow', label: 'Glow' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'shimmer', label: 'Shimmer' },
];

export const USERNAME_COLOR_SWATCHES = [
  '', '#ffffff', '#FF3333', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#ec4899', '#f97316', '#06b6d4',
];

// Built-in system font names only — no bundled font assets, so only names
// the OS already ships are safe to use cross-device.
export const FONT_FAMILY_MAP: Record<string, string | undefined> = (Platform.select({
  ios: {
    serif: 'Georgia',
    mono: 'Courier',
    display: 'Futura-CondensedExtraBold',
    handwriting: 'Bradley Hand',
    rounded: 'AvenirNextRounded-Bold',
  },
  android: {
    serif: 'serif',
    mono: 'monospace',
    display: 'sans-serif-condensed',
    handwriting: undefined,
    rounded: 'sans-serif-rounded',
  },
  default: {},
}) || {}) as Record<string, string | undefined>;

export interface UsernameStyleProfile {
  username_font?: string;
  username_weight?: string;
  username_style?: string;
  username_color?: string;
  username_effect?: string;
  accent_color?: string;
}

export interface BuiltUsernameStyle {
  style: Record<string, any>;
  pulse: boolean;
}

/**
 * Build an RN Text style from a UserProfile's username_* fields.
 * Color priority mirrors web exactly: username_color → accent_color → fallback.
 */
export function buildUsernameStyleRN(
  profile: UsernameStyleProfile | null | undefined,
  opts: { fallbackColor?: string } = {},
): BuiltUsernameStyle {
  const style: Record<string, any> = {};
  if (!profile) {
    if (opts.fallbackColor) style.color = opts.fallbackColor;
    return { style, pulse: false };
  }

  const mappedFont = profile.username_font ? FONT_FAMILY_MAP[profile.username_font] : undefined;
  if (mappedFont) style.fontFamily = mappedFont;
  // Android has no built-in cursive/handwriting generic — italicize as the
  // closest system-font approximation instead of silently ignoring the pick.
  if (profile.username_font === 'handwriting' && Platform.OS === 'android') {
    style.fontStyle = 'italic';
  }

  const weightEntry = USERNAME_WEIGHTS.find((w) => w.value === profile.username_weight);
  if (weightEntry) style.fontWeight = weightEntry.css;

  if (profile.username_style === 'italic') style.fontStyle = 'italic';

  const color = profile.username_color || profile.accent_color || opts.fallbackColor;
  if (color) style.color = color;

  const effect = profile.username_effect || 'none';
  let pulse = false;
  if (effect === 'glow' && color) {
    style.textShadowColor = color;
    style.textShadowOffset = { width: 0, height: 0 };
    style.textShadowRadius = 8;
  } else if (effect === 'pulse') {
    pulse = true;
  }
  // gradient / rainbow / shimmer: no masked-text support — `color` above is
  // the honest best-effort render.

  return { style, pulse };
}
