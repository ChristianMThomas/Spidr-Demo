const DEFAULTS = { type: 'gradient', primaryColor: '#dc2626', secondaryColor: '#991b1b', backgroundImage: '', blur: 0, opacity: 90 };
const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value) ? value : /^#[\da-f]{3}$/i.test(value) ? '#' + value.slice(1).split('').map(c => c + c).join('') : fallback;
const bounded = (value, fallback, max) => value != null && Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Number(value))) : fallback;

export function normalizeTheme(value = {}) {
  const theme = value || {};
  return {
    type: ['solid', 'gradient', 'image'].includes(theme.type) ? theme.type : DEFAULTS.type,
    primaryColor: color(theme.primaryColor, DEFAULTS.primaryColor),
    secondaryColor: color(theme.secondaryColor, DEFAULTS.secondaryColor),
    backgroundImage: typeof theme.backgroundImage === 'string' ? theme.backgroundImage : '',
    blur: bounded(theme.blur, DEFAULTS.blur, 20),
    opacity: bounded(theme.opacity, DEFAULTS.opacity, 100),
  };
}

export function themeVariables(value) {
  const { primaryColor } = normalizeTheme(value);
  const rgb = [1, 3, 5].map(i => parseInt(primaryColor.slice(i, i + 2), 16));
  const luminance = rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const lightness = luminance[0] * .2126 + luminance[1] * .7152 + luminance[2] * .0722;
  return {
    '--spidr-accent': primaryColor,
    '--spidr-accent-ink': lightness > .179 ? '#08090b' : '#ffffff',
    '--spidr-glow': `rgba(${rgb.join(', ')}, 0.18)`,
    '--spidr-surface': 'rgba(8, 9, 11, 0.72)',
  };
}

// Conversation appearance stays local, including when nested beneath Friends.
export const CHAT_THEME_VARIABLES = Object.freeze({ ...themeVariables({ primaryColor: '#ff3333' }), '--spidr-surface': '#000000' });

export function themeBackground(value) {
  const theme = normalizeTheme(value);
  if (theme.type === 'solid') return { backgroundColor: theme.primaryColor };
  if (theme.type === 'image' && theme.backgroundImage) return {
    backgroundColor: '#08090b', backgroundImage: `url(${JSON.stringify(theme.backgroundImage)})`, backgroundSize: 'cover', backgroundPosition: 'center',
  };
  if (theme.type === 'image') return { backgroundColor: '#08090b' };
  return { backgroundImage: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` };
}

export function themeOverlay(value) {
  const theme = normalizeTheme(value);
  return { backgroundColor: `rgba(0, 0, 0, ${(100 - theme.opacity) / 100})`, backdropFilter: `blur(${theme.blur}px)`, WebkitBackdropFilter: `blur(${theme.blur}px)` };
}
