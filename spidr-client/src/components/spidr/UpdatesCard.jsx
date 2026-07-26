import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';

// In-app updater UI for the Electron build. Talks to window.electronAPI
// (checkForUpdates / downloadUpdate / quitAndInstall / onUpdateStatus), which
// is wired to electron-updater in electron/main.js against the GitHub Releases
// feed configured in package.json → build.publish.
//
// Web build never sees this — SettingsPanel gates the whole tab on isElectron.
export default function UpdatesCard() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  const [phase, setPhase] = useState('idle'); // idle | checking | available | up-to-date | downloading | downloaded | error
  const [percent, setPercent] = useState(0);
  const [availableVersion, setAvailableVersion] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    if (!api?.onUpdateStatus) return;
    const off = api.onUpdateStatus((payload) => {
      if (!payload?.phase) return;
      setPhase(payload.phase);
      if (payload.phase === 'available')    setAvailableVersion(payload.version || null);
      if (payload.phase === 'downloaded')   { setAvailableVersion(payload.version || null); setPercent(100); }
      if (payload.phase === 'downloading')  setPercent(payload.percent || 0);
      if (payload.phase === 'error')        setErrorMsg(payload.message || 'Update failed.');
      else                                  setErrorMsg('');
    });
    return off;
  }, [api]);

  const check = async () => {
    if (!api?.checkForUpdates) return;
    setErrorMsg('');
    setPhase('checking');
    const res = await api.checkForUpdates();
    if (res?.current) setCurrentVersion(res.current);
    if (!res?.ok) {
      setPhase('error');
      setErrorMsg(res?.error || 'Could not reach the update server.');
      return;
    }
    // Event stream (update-available / update-not-available) will drive phase from here.
  };

  const download = async () => {
    if (!api?.downloadUpdate) return;
    setPercent(0);
    setPhase('downloading');
    const res = await api.downloadUpdate();
    if (!res?.ok) {
      setPhase('error');
      setErrorMsg(res?.error || 'Download failed.');
    }
  };

  const restart = () => api?.quitAndInstall?.();

  // Discover the running version once, so the user always sees "You're on X"
  // even before pressing Check.
  useEffect(() => {
    (async () => {
      if (!api?.checkForUpdates || currentVersion) return;
      // Ping the handler with no side effects to grab { current }; if the
      // packaged build is offline this still returns the version.
      try {
        const res = await api.checkForUpdates();
        if (res?.current) setCurrentVersion(res.current);
        if (res?.ok && res?.update?.version && res.update.version !== res.current) {
          setPhase('available');
          setAvailableVersion(res.update.version);
        } else if (res?.ok) {
          setPhase('up-to-date');
        }
      } catch { /* non-fatal */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const busy = phase === 'checking' || phase === 'downloading';

  return (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl p-5 max-w-lg">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-white font-semibold">Spidr Desktop</p>
          <p className="text-zinc-400 text-sm">
            {currentVersion ? <>You're on <span className="text-white font-mono">v{currentVersion}</span></> : 'Fetching version…'}
          </p>
        </div>
        {phase === 'up-to-date' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
        {phase === 'error'      && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
      </div>

      {phase === 'available' && availableVersion && (
        <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/40 px-3 py-2 text-sm text-red-200">
          Update available: <span className="font-mono text-white">v{availableVersion}</span>
        </div>
      )}

      {phase === 'downloading' && (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
          </div>
          <p className="text-xs text-zinc-500 mt-1">Downloading… {Math.round(percent)}%</p>
        </div>
      )}

      {phase === 'downloaded' && (
        <div className="mb-4 rounded-lg bg-emerald-950/40 border border-emerald-900/40 px-3 py-2 text-sm text-emerald-200">
          Update ready. Restart Spidr to install <span className="font-mono text-white">v{availableVersion}</span>.
        </div>
      )}

      {phase === 'error' && errorMsg && (
        <div className="mb-4 rounded-lg bg-amber-950/40 border border-amber-900/40 px-3 py-2 text-xs text-amber-200 break-words">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={check} disabled={busy}>
          <RefreshCw className={`w-4 h-4 mr-1 ${phase === 'checking' ? 'animate-spin' : ''}`} />
          {phase === 'checking' ? 'Checking…' : 'Check for updates'}
        </Button>
        {phase === 'available' && (
          <Button size="sm" onClick={download}>
            <Download className="w-4 h-4 mr-1" /> Download update
          </Button>
        )}
        {phase === 'downloaded' && (
          <Button size="sm" onClick={restart} className="bg-emerald-600 hover:bg-emerald-500">
            <RotateCcw className="w-4 h-4 mr-1" /> Restart & install
          </Button>
        )}
      </div>
    </div>
  );
}
