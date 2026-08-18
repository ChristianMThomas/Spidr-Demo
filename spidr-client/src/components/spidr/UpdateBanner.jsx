import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RotateCcw, X } from 'lucide-react';

/**
 * UpdateBanner — app-wide "Update Now" prompt for the Electron build.
 *
 * electron/main.js runs a silent background check shortly after launch and
 * every few hours after that (see UPDATE_RECHECK_INTERVAL_MS), broadcasting
 * phase changes over the same 'updater:status' channel Settings → Updates
 * (UpdatesCard.jsx) already listens to. This banner is the other consumer of
 * that same event stream — it's how a user finds out about (and installs) an
 * update WITHOUT having to go dig through Settings.
 *
 * One button, label follows the phase:
 *   available   → "Update Now"        (starts the download)
 *   downloading → disabled, shows %
 *   downloaded  → "Restart & Install" (quits and relaunches into the new build)
 *
 * Dismissing hides the banner for the CURRENT phase only — if the phase
 * advances (e.g. available → downloaded) it reappears, so a user who
 * dismissed "an update exists" still gets told when it's actually ready to
 * install. 'checking' / 'up-to-date' / 'error' never show a banner; errors
 * from a silent background check aren't worth interrupting someone over; a
 * manual check surfaces its own error inline in Settings.
 */
export default function UpdateBanner() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  const [phase, setPhase] = useState('idle');
  const [version, setVersion] = useState(null);
  const [percent, setPercent] = useState(0);
  const [dismissedKey, setDismissedKey] = useState(null);

  useEffect(() => {
    if (!api?.onUpdateStatus) return;
    const off = api.onUpdateStatus((payload) => {
      if (!payload?.phase) return;
      setPhase(payload.phase);
      if (payload.version) setVersion(payload.version);
      if (payload.phase === 'downloading') setPercent(payload.percent || 0);
    });
    return off;
  }, [api]);

  if (!api?.isElectron) return null;

  const visiblePhases = new Set(['available', 'downloading', 'downloaded']);
  const key = `${phase}:${version || ''}`;
  if (!visiblePhases.has(phase) || dismissedKey === key) return null;

  const download = async () => {
    if (!api?.downloadUpdate) return;
    setPercent(0);
    setPhase('downloading');
    await api.downloadUpdate();
  };

  const restart = () => api?.quitAndInstall?.();

  return createPortal((
    <AnimatePresence>
      <motion.div
        key="update-banner"
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={`fixed left-0 right-0 z-[250] flex items-center justify-center gap-3 px-4 py-2 text-sm bg-[#0b0b0d]/95 backdrop-blur-xl border-b border-red-900/40 shadow-[0_4px_20px_rgba(0,0,0,0.4)] ${
          api.isElectron ? 'top-10' : 'top-0'
        }`}
      >
        {phase === 'available' && (
          <>
            <span className="text-zinc-300">
              Spidr <span className="text-white font-mono">v{version}</span> is available.
            </span>
            <button
              onClick={download}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Update Now
            </button>
          </>
        )}

        {phase === 'downloading' && (
          <>
            <span className="text-zinc-300">Downloading update…</span>
            <div className="w-32 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
            </div>
            <span className="text-zinc-500 text-xs font-mono">{Math.round(percent)}%</span>
          </>
        )}

        {phase === 'downloaded' && (
          <>
            <span className="text-emerald-300">
              Spidr <span className="text-white font-mono">v{version}</span> is ready to install.
            </span>
            <button
              onClick={restart}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restart & Install
            </button>
          </>
        )}

        <button
          onClick={() => setDismissedKey(key)}
          className="text-zinc-500 hover:text-white transition-colors ml-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  ), document.body);
}
