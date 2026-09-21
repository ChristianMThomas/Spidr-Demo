import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

import { NotificationBell } from './NotificationCenter';
import BiomassBalancePill from './BiomassBalancePill';
import UserStatusChip from './UserStatusChip';

/**
 * TitleBar — Electron-only top strip. The window uses `titleBarStyle:
 * 'hidden'` + `titleBarOverlay` (Windows/Linux) or `'hiddenInset'` (macOS)
 * in main.js, so the OS draws REAL minimize/maximize/close buttons directly
 * over this header — same behavior as VS Code and Discord — instead of us
 * hand-rolling window control buttons here.
 *
 * Layout (three flex zones):
 *   [SPIDR brand]        [drag zone: empty middle]        [right cluster]
 *     no-drag              drag (default)                    no-drag
 *
 * Right cluster holds the shell's floating top-right items (notifications,
 * biomass pill, status chip). Padding on the header reserves space so these
 * never sit underneath the OS-painted window controls (right edge on
 * Windows/Linux, left edge on macOS).
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
  // Platform detection drives which side we reserve for native window
  // controls: macOS traffic lights sit LEFT, Windows/Linux overlay RIGHT.
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onWindowMaximize) return;
    const offMax   = window.electronAPI.onWindowMaximize?.(() => setIsMaximized(true));
    const offUnmax = window.electronAPI.onWindowUnmaximize?.(() => setIsMaximized(false));
    return () => { offMax?.(); offUnmax?.(); };
  }, []);

  return (
    <header
      className="w-full h-10 flex items-center justify-between flex-shrink-0 select-none z-40"
      style={{
        WebkitAppRegion: 'drag',
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        // Windows/Linux: the OS paints min/max/close over the RIGHT edge
        // (titleBarOverlay). Reserve that width so our controls never sit
        // underneath them. macOS paints traffic lights on the LEFT, so we
        // pad the left instead.
        paddingLeft:  isMac ? 84 : 12,
        paddingRight: isMac ? 12 : 148,
      }}
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
          className="font-black text-[13px] tracking-[0.2em] uppercase"
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
          <div className="flex items-center gap-2">
            {window.electronAPI?.quickBrowser && <button title="Quick browser" aria-label="Quick browser"
              onClick={() => window.dispatchEvent(new Event('spidr-quick-browser-toggle'))}
              className="w-8 h-8 grid place-items-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10"><Globe size={16} /></button>}
            <NotificationBell />
            <BiomassBalancePill />
            <UserStatusChip />
          </div>
        )}

      </div>
    </header>
  );
}
