import React from 'react';
import { motion } from 'framer-motion';
import {
  Skull, Gamepad2, Cpu, Music, Monitor, CloudSun,
  Headphones, Flame, Tv2, Quote,
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
  'Steam Now Playing': {
    accent: '#66c0f4',
    accentRgb: '102, 192, 244',
    icon: Monitor,
    Preview: SteamPreview,
  },
  'Weather Hex': {
    accent: '#06b6d4',
    accentRgb: '6, 182, 212',
    icon: CloudSun,
    Preview: WeatherPreview,
  },
  'Custom Quote Box': {
    accent: '#c084fc',
    accentRgb: '192, 132, 252',
    icon: Quote,
    Preview: QuoteBoxPreview,
  },
  'Lo-fi Radio': {
    accent: '#a855f7',
    accentRgb: '168, 85, 247',
    icon: Headphones,
    Preview: LofiRadioPreview,
  },
  'Daily Streak Counter': {
    accent: '#f97316',
    accentRgb: '249, 115, 22',
    icon: Flame,
    Preview: DailyStreakPreview,
  },
  'Anime Watchlist': {
    accent: '#ec4899',
    accentRgb: '236, 72, 153',
    icon: Tv2,
    Preview: AnimeWatchlistPreview,
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

/** Steam Now Playing — faux game card with header banner + stat pills. */
function SteamPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center px-3">
      <div
        className="w-full max-w-[240px] rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(13,17,23,0.95), rgba(27,40,56,0.95))',
          border: '1px solid rgba(102,192,244,0.25)',
          boxShadow: '0 0 16px rgba(102,192,244,0.12)',
        }}
      >
        {/* Faux game header banner */}
        <div
          className="h-10 w-full relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1b2838 0%, #2a475e 60%, #1b2838 100%)' }}
        >
          {/* Scanline shimmer */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(102,192,244,0.12) 50%, transparent 100%)',
            }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
          />
          {/* Game title stub */}
          <div className="absolute bottom-1.5 left-2.5 flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#66c0f4]/30 border border-[#66c0f4]/40" />
            <div className="h-1.5 w-16 rounded-full bg-white/20" />
          </div>
        </div>

        {/* Stats row */}
        <div className="px-2.5 py-2 grid grid-cols-2 gap-1.5">
          {[
            { label: 'HOURS', val: '247.3' },
            { label: 'RECENT', val: '12.5 hrs' },
          ].map(({ label, val }) => (
            <div key={label} className="bg-black/40 rounded-md px-2 py-1.5">
              <div className="text-[10px] font-black text-white tabular-nums">{val}</div>
              <div className="text-[7px] font-mono text-[#66c0f4]/60 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* Achievement bar */}
        <div className="px-2.5 pb-2.5">
          <div className="flex justify-between text-[7px] font-mono text-[#66c0f4]/50 mb-1">
            <span>ACHIEVEMENTS</span><span>47 / 83</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #66c0f4, #4a9fb5)' }}
              initial={{ width: 0 }}
              animate={{ width: '57%' }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Custom Quote Box — floating quote with animated quotation marks. */
function QuoteBoxPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center px-4">
      <div
        className="w-full max-w-[230px] rounded-xl p-4 relative"
        style={{
          background: 'linear-gradient(135deg, rgba(192,132,252,0.08), rgba(126,34,206,0.06))',
          border: '1px solid rgba(192,132,252,0.22)',
        }}
      >
        {/* Opening quote mark */}
        <motion.div
          className="text-4xl font-black leading-none select-none"
          style={{ color: 'rgba(192,132,252,0.35)', fontFamily: 'Georgia, serif', lineHeight: 1 }}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          "
        </motion.div>
        <p className="text-[11px] text-white/75 leading-relaxed mt-1 italic">
          The web is woven from light.
        </p>
        <div className="flex justify-end mt-2">
          <motion.div
            className="text-4xl font-black leading-none select-none"
            style={{ color: 'rgba(192,132,252,0.35)', fontFamily: 'Georgia, serif', lineHeight: 1 }}
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          >
            "
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** Lo-fi Radio — vinyl record spinning with ambient glow and waveform. */
function LofiRadioPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center gap-4 px-4">
      {/* Spinning vinyl */}
      <div className="relative shrink-0">
        <motion.div
          className="w-14 h-14 rounded-full"
          style={{
            background: 'radial-gradient(circle at 40% 40%, #4c1d95, #1e1b4b 60%, #0a0a0a)',
            boxShadow: '0 0 18px rgba(168,85,247,0.4)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          {/* Grooves */}
          {[20, 28, 36].map(r => (
            <div
              key={r}
              className="absolute rounded-full border border-white/5"
              style={{ inset: `${(56 - r * 2) / 2}px` }}
            />
          ))}
          {/* Center hole */}
          <div className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-[#0a0a0a] border border-purple-500/40" />
        </motion.div>
        {/* Tonearm */}
        <motion.div
          className="absolute w-0.5 h-8 rounded-full origin-bottom"
          style={{
            background: 'linear-gradient(to top, rgba(168,85,247,0.6), rgba(168,85,247,0.2))',
            top: -8, right: 0,
          }}
          animate={{ rotate: [-18, -12, -18] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Track info + waveform */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-[10px] font-bold text-white truncate">beats to study to</div>
        <div className="text-[8px] text-purple-400/70 font-mono uppercase tracking-wider">Live · lo-fi</div>
        <div className="flex items-end gap-[2px] h-5">
          {Array.from({ length: 12 }, (_, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ background: 'linear-gradient(to top, #a855f7, #7c3aed)' }}
              animate={{ height: ['25%', `${35 + Math.sin(i * 0.9) * 40 + 25}%`, '25%'] }}
              transition={{ duration: 0.9 + i * 0.07, repeat: Infinity, ease: 'easeInOut', delay: i * 0.05 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Daily Streak Counter — flame + three stat tiles with a counting animation. */
function DailyStreakPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center px-4">
      <div className="w-full max-w-[230px] space-y-3">
        {/* Flame + streak number */}
        <div className="flex items-center justify-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [-4, 4, -4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="text-2xl"
          >
            🔥
          </motion.div>
          <motion.span
            className="text-3xl font-black text-white"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            7
          </motion.span>
          <span className="text-[10px] text-orange-400/70 font-mono uppercase tracking-widest self-end pb-1">days</span>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Current', val: '7',  color: 'text-orange-400' },
            { label: 'Best',    val: '23', color: 'text-white' },
            { label: 'Active',  val: '15', color: 'text-gray-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-black/50 border border-white/5 rounded-lg p-1.5 text-center">
              <div className={`text-sm font-black ${color}`}>{val}</div>
              <div className="text-[7px] text-gray-600 uppercase font-bold">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Anime Watchlist — two faux anime entries with episode progress bars. */
function AnimeWatchlistPreview() {
  const shows = [
    { title: 'Jujutsu Kaisen',  ep: 18, total: 24, pct: 75 },
    { title: 'Chainsaw Man',    ep:  9, total: 12, pct: 75 },
    { title: 'Frieren',         ep: 20, total: 28, pct: 71 },
  ];
  return (
    <div className="relative w-full h-full flex items-center justify-center px-4">
      <div className="w-full max-w-[230px] space-y-2">
        {shows.map((s, i) => (
          <div key={s.title}>
            <div className="flex justify-between text-[9px] font-mono mb-0.5">
              <span className="text-white/80 truncate pr-2">{s.title}</span>
              <span className="text-pink-400/70 shrink-0">{s.ep}/{s.total}</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #ec4899, #db2777)' }}
                initial={{ width: 0 }}
                animate={{ width: `${s.pct}%` }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.15, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Weather Hex — live-style weather card with animated temperature and stat pills. */
function WeatherPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center px-3">
      <div className="w-full max-w-[240px] space-y-2">
        {/* Main temp card */}
        <div
          className="rounded-xl p-3"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(14,116,144,0.08) 100%)',
            border: '1px solid rgba(6,182,212,0.25)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <motion.div
                className="text-2xl font-black text-white leading-none"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                24°C
              </motion.div>
              <div className="text-[9px] text-cyan-400/70 mt-0.5">Feels like 22°C</div>
            </div>
            <motion.div
              className="text-3xl"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              ⛅
            </motion.div>
          </div>
          <div className="text-[10px] text-white/60 font-medium mt-1.5">Partly Cloudy</div>
          <div className="text-[9px] text-white/30 mt-0.5">📍 Your Location</div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'Humidity', val: '68%' },
            { label: 'Wind',     val: '14 km/h' },
          ].map(({ label, val }) => (
            <div key={label} className="bg-black/40 border border-white/5 rounded-lg p-1.5 text-center">
              <div className="text-[10px] font-bold text-cyan-400">{val}</div>
              <div className="text-[7px] text-gray-500 uppercase font-bold">{label}</div>
            </div>
          ))}
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
