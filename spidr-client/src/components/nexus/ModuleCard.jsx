import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Flag, CheckCircle, Loader2, Trash2, Lock } from 'lucide-react';
import { getModuleTheme } from './widgets/previews';

const COMING_SOON_MODULES = new Set(['Steam Now Playing', 'Daily Streak Counter']);

/**
 * ModuleCard — holographic glass card with a hover-preview crossfade.
 *
 * Card anatomy (fixed height so the grid never reflows):
 *
 *   ┌───────────────────────────────────────────┐
 *   │ [icon] Title                              │  ← header (FIXED)
 *   │        By @author                         │
 *   ├───────────────────────────────────────────┤
 *   │   Layer 1: description + stat pills       │  ← middle (CROSSFADES)
 *   │   Layer 2: live module preview            │
 *   ├───────────────────────────────────────────┤
 *   │ [ install / installed button ]            │  ← footer (FIXED)
 *   └───────────────────────────────────────────┘
 *
 * Hover behavior:
 *   - The border lights up in the module's theme color.
 *   - A faint radial glow fills the card background with the same color.
 *   - The middle Layer 1 fades out + slides down 8px.
 *   - The middle Layer 2 (preview) fades in + slides up from 16px below,
 *     with a 75ms delay so the text exits before the preview enters.
 *   - The Install button's hollow border fills in with the theme color.
 *
 * The Installed state is intentionally MUTED — a recessed gray pill with a
 * subtle checkmark — so the user's eye is drawn to the uninstalled options
 * instead of being shouted at by giant green bars.
 */
export default function ModuleCard({ mod, isInstalled, onInstall, onUninstall, onReport, installing }) {
  const [showReportInput, setShowReportInput] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [hovered, setHovered] = useState(false);

  const theme = getModuleTheme(mod);
  const Icon = theme.icon;
  const Preview = theme.Preview;
  const accentRgb = theme.accentRgb;
  const isComingSoon = COMING_SOON_MODULES.has(mod.name);

  const handleReport = () => {
    if (!reportReason.trim()) return;
    onReport(mod.id, reportReason.trim());
    setReportReason('');
    setShowReportInput(false);
  };

  // Human-friendly stat label for the type pill
  const typeLabel = (mod.type || 'static_text').replace('_', ' ').toUpperCase();

  // Install-count formatter: 1.2K / 208K / 1.4M
  const formatCount = (n) => {
    const x = n || 0;
    if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1)}M`;
    if (x >= 1_000)     return `${(x / 1_000).toFixed(x >= 10_000 ? 0 : 1)}K`;
    return String(x);
  };

  return (
    <motion.div
      onHoverStart={() => !isComingSoon && setHovered(true)}
      onHoverEnd={()   => setHovered(false)}
      whileHover={isComingSoon ? {} : { y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="group relative h-[300px] rounded-2xl overflow-hidden flex flex-col p-5 transition-colors duration-300"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid',
        borderColor: hovered ? `rgba(${accentRgb}, 0.45)` : 'rgba(255, 255, 255, 0.05)',
        boxShadow: hovered
          ? `0 12px 32px rgba(0, 0, 0, 0.45), 0 0 28px rgba(${accentRgb}, 0.18)`
          : '0 6px 20px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Background glow — illuminates the card with the module's theme on
          hover. Sits BEHIND content via absolute + z-index. */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          opacity: hovered ? 1 : 0,
          background:
            `radial-gradient(ellipse 90% 70% at 50% 50%, rgba(${accentRgb}, 0.10), transparent 70%),` +
            `linear-gradient(180deg, rgba(${accentRgb}, 0.04) 0%, transparent 100%)`,
        }}
      />

      {/* ── HEADER (FIXED) ───────────────────────────────────────────── */}
      <div className="relative z-10 flex items-start justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon housing — gradient-filled rounded square */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb}, 0.18) 0%, rgba(${accentRgb}, 0.04) 100%)`,
              border: `1px solid rgba(${accentRgb}, ${hovered ? 0.5 : 0.25})`,
              boxShadow: hovered
                ? `0 0 18px rgba(${accentRgb}, 0.45), inset 0 0 10px rgba(${accentRgb}, 0.15)`
                : `inset 0 0 8px rgba(${accentRgb}, 0.08)`,
            }}
          >
            {mod.icon_url ? (
              <img src={mod.icon_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Icon size={22} style={{ color: theme.accent, filter: `drop-shadow(0 0 6px rgba(${accentRgb}, 0.6))` }} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">{mod.name}</h3>
            <div className="text-[11px] text-white/40 font-mono truncate">
              By <span className="text-white/60">@{mod.author_name || 'Unknown'}</span>
            </div>
          </div>
        </div>
        {onReport && (
          <button
            onClick={() => setShowReportInput(!showReportInput)}
            className="text-white/20 hover:text-red-400 transition-colors p-1 shrink-0"
            title="Report Module"
          >
            <Flag size={13} />
          </button>
        )}
      </div>

      {/* ── MIDDLE (CROSSFADES) ──────────────────────────────────────── */}
      {/* flex-1 to take all remaining vertical space; relative so the two
          layers can stack via absolute positioning. min-h-0 so flex children
          can shrink below their content height. */}
      <div className="relative flex-1 min-h-0 z-10">

        {/* Layer 1 — description + stat pills (default visible) */}
        <div
          className="absolute inset-0 flex flex-col justify-between transition-all duration-300 ease-out"
          style={{
            opacity: hovered ? 0 : 1,
            transform: hovered ? 'translateY(8px)' : 'translateY(0)',
          }}
        >
          {mod.description ? (
            <p className="text-[12px] text-white/55 leading-relaxed line-clamp-3 pr-1">
              {mod.description}
            </p>
          ) : (
            <p className="text-[12px] text-white/30 italic">No description provided.</p>
          )}
          {/* Glass stat pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatPill>
              <Download size={10} className="opacity-70" />
              {formatCount(mod.install_count)} Installs
            </StatPill>
            <StatPill accent={theme.accent} accentRgb={accentRgb}>
              {typeLabel}
            </StatPill>
          </div>
        </div>

        {/* Layer 2 — live preview (default hidden, delayed in) */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out pointer-events-none"
          style={{
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(16px)',
            transitionDelay: hovered ? '75ms' : '0ms',
          }}
        >
          {/* Preview canvas — subtle accent-tinted border so the preview
              reads as a "display case" not raw artwork. */}
          <div
            className="relative w-full h-full rounded-xl flex items-center justify-center overflow-hidden"
            style={{
              background: `radial-gradient(ellipse at center, rgba(${accentRgb}, 0.05), transparent 75%)`,
              border: `1px solid rgba(${accentRgb}, 0.15)`,
            }}
          >
            {Preview ? <Preview theme={theme} mod={mod} /> : null}
          </div>
        </div>
      </div>

      {/* Inline report input — pops above the footer when active */}
      {showReportInput && (
        <div className="relative z-10 mt-3 mb-2 flex gap-2 shrink-0">
          <input
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason for report..."
            className="flex-1 bg-black/60 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500"
          />
          <button
            onClick={handleReport}
            className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg font-bold hover:bg-red-500"
          >
            Send
          </button>
        </div>
      )}

      {/* ── FOOTER (FIXED) ───────────────────────────────────────────── */}
      <div className="relative z-10 mt-4 shrink-0">
        {isComingSoon ? (
          <div
            className="w-full py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 cursor-not-allowed select-none"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.18)',
            }}
          >
            <Lock size={11} className="opacity-50" /> Locked
          </div>
        ) : isInstalled ? (
          <div className="flex gap-2">
            {/* Recessed muted "installed" pill — doesn't shout. */}
            <div
              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 cursor-default"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid transparent',
                color: 'rgba(255, 255, 255, 0.3)',
              }}
            >
              <CheckCircle size={12} className="opacity-50" /> Installed
            </div>
            {onUninstall && (
              <button
                onClick={() => onUninstall(mod.id)}
                className="py-2.5 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  e.currentTarget.style.color = '#fca5a5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                }}
                title="Uninstall"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onInstall(mod.id)}
            disabled={installing}
            className="w-full py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
            style={{
              background: hovered ? `rgba(${accentRgb}, 0.85)` : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${hovered ? `rgba(${accentRgb}, 1)` : 'rgba(255, 255, 255, 0.1)'}`,
              color: hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
              boxShadow: hovered ? `0 0 22px rgba(${accentRgb}, 0.5)` : 'none',
            }}
          >
            {installing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <>
                <Download size={12} /> Install Module
              </>
            )}
          </button>
        )}
      </div>

      {/* ── COMING-SOON overlay: chains + padlock ──────────────────────── */}
      {isComingSoon && <ComingSoonOverlay accentRgb={accentRgb} accent={theme.accent} />}

    </motion.div>
  );
}

// ── Coming Soon overlay ───────────────────────────────────────────────────
function ChainBand({ angle }) {
  // Alternating wide (horizontal) and narrow (vertical/edge-on) links
  const links = Array.from({ length: 18 });
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: '50%', top: '50%',
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        display: 'flex', alignItems: 'center',
        width: '160%',
        gap: 1,
        zIndex: 0,
      }}
    >
      {links.map((_, i) => {
        const wide = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width:  wide ? 20 : 5,
              height: wide ? 11 : 17,
              borderRadius: wide ? 5 : 3,
              border: '1.8px solid rgba(190,190,220,0.45)',
              background: wide
                ? 'linear-gradient(135deg, rgba(40,40,60,0.92), rgba(20,20,35,0.92))'
                : 'linear-gradient(180deg, rgba(55,55,80,0.92), rgba(30,30,50,0.92))',
              boxShadow: '0 0 3px rgba(150,150,220,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          />
        );
      })}
    </div>
  );
}

function ComingSoonOverlay({ accentRgb, accent }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center"
      style={{ zIndex: 25 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Frosted dark veil */}
      <div className="absolute inset-0 bg-black/72" style={{ backdropFilter: 'blur(1px)' }} />

      {/* Chain band 1 */}
      <ChainBand angle={-38} />
      {/* Chain band 2 */}
      <ChainBand angle={38} />

      {/* Padlock + label */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* Lock housing */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          {/* Outer glow ring */}
          <div
            className="absolute -inset-3 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(${accentRgb},0.22) 0%, transparent 70%)`,
              filter: 'blur(6px)',
            }}
          />
          {/* Lock icon container */}
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb},0.18), rgba(0,0,0,0.85))`,
              border: `1.5px solid rgba(${accentRgb},0.5)`,
              boxShadow: `0 0 28px rgba(${accentRgb},0.45), 0 0 60px rgba(${accentRgb},0.12), inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            <Lock
              size={28}
              style={{
                color: accent,
                filter: `drop-shadow(0 0 10px rgba(${accentRgb},0.9))`,
              }}
            />
          </div>
        </motion.div>

        {/* Label */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-[10px] font-black uppercase tracking-[0.28em]"
            style={{
              color: `rgba(${accentRgb}, 0.9)`,
              textShadow: `0 0 14px rgba(${accentRgb},0.7)`,
            }}
          >
            Coming Soon
          </span>
          <span className="text-[8.5px] font-mono uppercase tracking-[0.15em] text-white/30">
            Module locked
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Glass stat pill ───────────────────────────────────────────────────────
function StatPill({ children, accent, accentRgb }) {
  if (accent) {
    // Type pill — tinted with the module's theme color
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider"
        style={{
          background: `rgba(${accentRgb}, 0.10)`,
          border: `1px solid rgba(${accentRgb}, 0.30)`,
          color: accent,
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        color: 'rgba(255, 255, 255, 0.50)',
      }}
    >
      {children}
    </span>
  );
}
