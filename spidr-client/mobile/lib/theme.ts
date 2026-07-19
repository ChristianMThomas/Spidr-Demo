import { useAppShell } from './appShellContext';

// ── Theme-derived colors ─────────────────────────────────────────────────────
// Turns the saved app theme (Theme Studio) into the dark surface palette the
// screens actually paint with, so a "Deep Ocean" user gets navy-black tabs
// instead of the hardcoded #050505. Backgrounds stay very dark for contrast —
// the theme color is blended in at low strength, mirroring how the web shell
// washes the gradient behind a dark scrim.

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function mixHex(hexA: string, hexB: string, weightA: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (shift: number) => {
    const va = (a >> shift) & 0xff;
    const vb = (b >> shift) & 0xff;
    return Math.round(va * weightA + vb * (1 - weightA));
  };
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}

export interface ThemeColors {
  accent: string;   // full-strength theme primary (active tints, highlights)
  bg: string;       // screen background (was #050505)
  surface: string;  // cards / grouped sections (was #0f0f0f–#111)
  tabBar: string;   // bottom tab bar (was #0a0a0a)
  border: string;   // hairline borders on surfaces
}

export function themeColors(primaryColor?: string): ThemeColors {
  const primary = primaryColor && HEX_RE.test(primaryColor) ? primaryColor : '#dc2626';
  return {
    accent: primary,
    bg: mixHex(primary, '#020202', 0.10),
    surface: mixHex(primary, '#0c0c0c', 0.12),
    tabBar: mixHex(primary, '#060606', 0.12),
    border: 'rgba(255,255,255,0.06)',
  };
}

export function useThemeColors(): ThemeColors {
  const { appTheme } = useAppShell();
  return themeColors(appTheme?.primaryColor);
}
