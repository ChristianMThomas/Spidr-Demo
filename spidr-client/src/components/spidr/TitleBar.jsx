import React, { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { NotificationBell } from './NotificationCenter';
import BiomassBalancePill from './BiomassBalancePill';
import UserStatusChip from './UserStatusChip';

/**
 * TitleBar — Electron-only top strip, redesigned as a TRANSPARENT overlay:
 * the bar itself has no fill or border, so whatever app background the user
 * set flows straight through it — it reads as OS chrome floating ABOVE the
 * app rather than a component of it. Controls sit in small self-contained
 * glass chips for legibility on any backdrop.
 *
 * The window uses `frame: false` in main.js, so we render our own title
 * strip here. Design goal: no solid opaque bar cutting off the app; a
 * lightly-tinted glass panel that lets custom user backgrounds bleed
 * through and blur into a subtle, premium look.
 *
 * Layout (three flex zones):
 *   [SPIDR brand]        [drag zone: empty middle]        [right cluster]
 *     no-drag              drag (default)                    no-drag
 *
 * Right cluster combines what used to be the shell's floating top-right
 * items (notifications, biomass pill, status chip) plus the Windows-style
 * window controls (min / max / close). Combining them into one strip
 * fixes the earlier bug where the floating cluster and window controls
 * both anchored to the right edge and covered each other.
 *
 * Drag rules — the CRITICAL Electron gotcha:
 *   • `-webkit-app-region: drag` on a parent disables click/hover events
 *     for its children unless we explicitly override to `no-drag`.
 *   • We put `drag` on the <header> so the empty middle acts as a
 *     window-drag handle (native OS behavior).
 *   • We put `no-drag` on the brand block and the right cluster so every
 *     interactive control inside them stays clickable.
 */
export default function TitleBar({ currentUser }) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onWindowMaximize) return;
    const offMax   = window.electronAPI.onWindowMaximize?.(() => setIsMaximized(true));
    const offUnmax = window.electronAPI.onWindowUnmaximize?.(() => setIsMaximized(false));
    return () => { offMax?.(); offUnmax?.(); };
  }, []);

  return (
    <header
      className="w-full h-12 flex items-center justify-between px-3 flex-shrink-0 select-none bg-transparent z-40"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* ── Brand (left) ─────────────────────────────────────────────
          Marked no-drag so a future click handler (e.g. Home nav)
          would work — right now it's decorative. The red drop-shadow
          lifts the wordmark off any background color the user picks. */}
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <h1
          className="font-black text-sm tracking-[0.2em] uppercase px-2.5 py-1 rounded-lg bg-black/25 backdrop-blur-md border border-white/5"
          style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}
        >
          <span className="text-white">SPID</span><span className="text-red-500">R</span>
        </h1>
      </div>

      {/* ── Right cluster: user controls + window controls ──────────
          All no-drag so clicks land on the buttons instead of dragging
          the window. The floating shell cluster is hidden on Electron
          (see SpidrShell.jsx) so these are the single source of truth
          for notifications / wallet / profile on desktop-app users. */}
      <div
        className="flex items-center gap-2 h-full"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {currentUser && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-black/25 backdrop-blur-md border border-white/5">
            <NotificationBell />
            <BiomassBalancePill />
            <UserStatusChip />
          </div>
        )}

        <div className="flex items-center gap-1 px-1 py-1 rounded-lg bg-black/25 backdrop-blur-md border border-white/5">
          <button
            onClick={() => window.electronAPI.minimize()}
            className="flex items-center justify-center w-8 h-7 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() => window.electronAPI.maximize()}
            className="flex items-center justify-center w-8 h-7 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => window.electronAPI.close()}
            className="flex items-center justify-center w-8 h-7 rounded-md text-white/80 hover:text-white hover:bg-red-600 transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
