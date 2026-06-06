import React from 'react';
import { motion } from 'framer-motion';
import {
  Skull, Gamepad2, AudioLines, Cpu, Music,
  Blocks, MemoryStick, MonitorPlay, Wand2,
} from 'lucide-react';

/**
 * modulePreviews — module-themed accents + miniature hover-preview cards.
 *
 * Each builtin Spidr module gets its own visual identity here: a theme color
 * (drives the icon halo, hover border, install-button fill, and the corner
 * glow on the card), the lucide icon to display in the icon housing, and a
 * tiny preview component the card crossfades to on hover.
 *
 * Previews are intentionally LIGHTWEIGHT mocks — not the real widgets. They
 * exist to communicate "here's roughly what this module looks like" in the
 * ~120px middle slot of a card, with movement to draw the eye. No API calls,
 * no entity fetches, no user-data dependencies. The real widget renders once
 * the user installs and visits their profile.
 *
 * Adding a new builtin preview: drop a new entry in MODULE_THEMES keyed by
 * the exact module name in builtinWidgets.js. Modules not in the registry
 * fall through to GenericPreview with a sensible default theme.
 */

// ── Per-module themes ────────────────────────────────────────────────────
// `accent` drives the visible color; `accentRgb` is the same color as comma-
// separated RGB so we can build rgba() strings for translucent glows.
export const MODULE_THEMES = {
  'Symbiote Entity Pet': {
    accent: '#a855f7',
    accentRgb: '168, 85, 247',
    icon: Skull,
    Preview: SymbiotePreview,
  },
  'Gaming Uplink Card': {
    accent: '#ef4444',
    accentRgb: '239, 68, 68',
    icon: Gamepad2,
    Preview: GamingUplinkPreview,
  },
  'Audio Resonance Player': {
    accent: '#06b6d4',
    accentRgb: '6, 182, 212',
    icon: AudioLines,
    Preview: AudioResonancePreview,
  },
  'PC Specs Flex': {
    accent: '#f59e0b',
    accentRgb: '245, 158, 11',
    icon: Cpu,
    Preview: PCSpecsPreview,
  },
  'Spotify Now Playing': {
    accent: '#10b981',
    accentRgb: '16, 185, 129',
    icon: Music,
    Preview: SpotifyPreview,
  },
};

// Default theme — used for community-published modules where we don't have
// a curated preview. Falls back to a neutral white-ish glow and a generic
// "blueprint" preview so the hover affordance still works.
const DEFAULT_THEME = {
  accent: '#60a5fa',
  accentRgb: '96, 165, 250',
  icon: Blocks,
  Preview: GenericPreview,
};

const TYPE_DEFAULTS = {
  static_text:    { ...DEFAULT_THEME, accent: '#10b981', accentRgb: '16, 185, 129', icon: Wand2 },
  api_sync:       { ...DEFAULT_THEME, accent: '#60a5fa', accentRgb: '96, 165, 250', icon: MemoryStick },
  live_feed:      { ...DEFAULT_THEME, accent: '#a855f7', accentRgb: '168, 85, 247', icon: MonitorPlay },
  display_widget: { ...DEFAULT_THEME, accent: '#f59e0b', accentRgb: '245, 158, 11', icon: Blocks },
};

/**
 * Resolve a module's theme. Strict name match (only for `author_id ===
 * 'spidr-official'` modules, mirroring builtinWidgets.js's name-squat
 * defense), then a type-based default, then the universal fallback.
 */
export function getModuleTheme(mod) {
  if (!mod) return DEFAULT_THEME;
  const builtin = MODULE_THEMES[mod.name];
  if (builtin && mod.author_id === 'spidr-official') return builtin;
  return TYPE_DEFAULTS[mod.type] || DEFAULT_THEME;
}

// ─────────────────────────────────────────────────────────────────────────
// PREVIEWS — each is a small visual mock that fits in the card's ~120px tall
// middle slot. All share the same external contract: a self-contained tile
// with the module's accent color used as the visual anchor.
// ─────────────────────────────────────────────────────────────────────────

/** Symbiote Pet — a morphing purple blob with subtle pulse. */
function SymbiotePreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Halo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 110, height: 110,
          background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent 70%)',
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* The blob — morphs through soft asymmetric shapes */}
      <motion.div
        className="relative"
        style={{
          width: 64, height: 64,
          background: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
          boxShadow: '0 0 24px rgba(168,85,247,0.6), inset 0 -8px 18px rgba(0,0,0,0.45)',
        }}
        animate={{
          borderRadius: [
            '50% 50% 50% 50%',
            '40% 60% 70% 30% / 50% 50% 60% 40%',
            '60% 40% 30% 70% / 60% 30% 70% 40%',
            '50% 50% 50% 50%',
          ],
          rotate: [0, 6, -6, 0],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Two eyes */}
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          <div className="w-1.5 h-2.5 bg-white/95 rounded-full" />
          <div className="w-1.5 h-2.5 bg-white/95 rounded-full" />
        </div>
      </motion.div>
      <span className="absolute bottom-1 text-[9px] tracking-[0.32em] font-bold text-purple-300/90 uppercase">
        Interactive
      </span>
    </div>
  );
}

/** Gaming Uplink Card — a mini "now playing" card with thumbnail + status. */
function GamingUplinkPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center px-3">
      <div
        className="relative w-full max-w-[240px] rounded-xl px-3 py-2.5 flex items-center gap-2.5"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.85), rgba(8, 8, 8, 0.95))',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          boxShadow: '0 0 18px rgba(239, 68, 68, 0.18), inset 0 0 12px rgba(239, 68, 68, 0.04)',
        }}
      >
        {/* "Live" tick in the corner */}
        <motion.span
          className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-red-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' }}
        />
        {/* Game thumbnail tile */}
        <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden border border-red-500/30"
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #7f1d1d 100%)',
            boxShadow: 'inset 0 0 10px rgba(239,68,68,0.3)',
          }}
        >
          {/* Faux pixel-art crest */}
          <svg viewBox="0 0 24 24" className="w-full h-full p-1.5">
            <path d="M12 2 L20 8 L18 18 L6 18 L4 8 Z" fill="rgba(239,68,68,0.55)" stroke="#fecaca" strokeWidth="0.8" />
            <circle cx="12" cy="11" r="2.4" fill="#fecaca" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-white truncate">League of Legends</div>
          <div className="text-[8px] font-mono tracking-[0.18em] text-red-400 uppercase truncate">
            Playing as Sett
          </div>
        </div>
      </div>
    </div>
  );
}

/** Audio Resonance Player — animated equalizer bars with a play knob. */
function AudioResonancePreview() {
  // 12 bars that pulse on a staggered phase
  const bars = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="relative w-full h-full flex items-center justify-center gap-3 px-4">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: 'radial-gradient(circle, #06b6d4 0%, #164e63 70%)',
          boxShadow: '0 0 16px rgba(6, 182, 212, 0.55)',
        }}
      >
        <div className="w-0 h-0 ml-0.5"
          style={{ borderLeft: '6px solid white', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }} />
      </div>
      <div className="flex items-center gap-1 h-12">
        {bars.map((i) => (
          <motion.div
            key={i}
            className="w-1 rounded-sm"
            style={{
              background: 'linear-gradient(180deg, #22d3ee 0%, #0e7490 100%)',
              boxShadow: '0 0 4px rgba(6, 182, 212, 0.6)',
            }}
            animate={{
              height: ['25%', `${30 + (Math.sin(i) + 1) * 30}%`, '40%', `${50 + (Math.cos(i) + 1) * 20}%`, '25%'],
            }}
            transition={{
              duration: 1.2 + (i % 4) * 0.15,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.04,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** PC Specs Flex — three faux spec bars with progress fills. */
function PCSpecsPreview() {
  const rows = [
    { label: 'GPU', value: '92%', pct: 92 },
    { label: 'CPU', value: '68%', pct: 68 },
    { label: 'RAM', value: '54%', pct: 54 },
  ];
  return (
    <div className="relative w-full h-full flex items-center justify-center px-5">
      <div className="w-full max-w-[220px] space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.label}>
            <div className="flex justify-between text-[9px] font-mono tracking-[0.2em] mb-1">
              <span className="text-amber-300/90">{r.label}</span>
              <span className="text-white/70 tabular-nums">{r.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  boxShadow: '0 0 6px rgba(245, 158, 11, 0.5)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${r.pct}%` }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Spotify Now Playing — album tile + track + bouncing progress bar. */
function SpotifyPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center px-3">
      <div className="flex items-center gap-2.5 w-full max-w-[240px]">
        {/* Album */}
        <motion.div
          className="w-12 h-12 rounded-md shrink-0"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
            boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
          }}
          animate={{ rotate: [0, 4, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox="0 0 24 24" className="w-full h-full p-2">
            <circle cx="12" cy="12" r="9" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.5" />
            <circle cx="12" cy="12" r="5" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.5" />
            <circle cx="12" cy="12" r="1.5" fill="white" fillOpacity="0.8" />
          </svg>
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-white truncate">Midnight Symbiote</div>
          <div className="text-[8px] text-emerald-300/80 truncate">SPIDR_OST · vol. III</div>
          {/* Progress bar */}
          <div className="mt-1.5 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full"
              style={{ background: '#10b981', boxShadow: '0 0 5px #10b981' }}
              animate={{ width: ['0%', '100%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * GenericPreview — used when there's no curated preview for a module name.
 * Pulses the module's actual icon with a colored halo so the hover state still
 * communicates "this is a visual thing", even for unknown community modules.
 */
function GenericPreview({ theme = DEFAULT_THEME, mod }) {
  const Icon = theme.icon || Blocks;
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 110, height: 110,
          background: `radial-gradient(circle, rgba(${theme.accentRgb}, 0.32), transparent 70%)`,
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="relative w-14 h-14 rounded-xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, rgba(${theme.accentRgb}, 0.22), rgba(${theme.accentRgb}, 0.04))`,
          border: `1px solid rgba(${theme.accentRgb}, 0.45)`,
          boxShadow: `0 0 22px rgba(${theme.accentRgb}, 0.35)`,
        }}
      >
        {mod?.icon_url ? (
          <img src={mod.icon_url} alt="" className="w-full h-full object-cover rounded-xl" />
        ) : (
          <Icon size={26} style={{ color: theme.accent }} />
        )}
      </div>
      <span
        className="mt-3 text-[9px] tracking-[0.32em] font-bold uppercase"
        style={{ color: theme.accent }}
      >
        Preview
      </span>
    </div>
  );
}

export default MODULE_THEMES;
