import React, { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onWindowMaximize) return;
    const offMax  = window.electronAPI.onWindowMaximize?.(() => setIsMaximized(true));
    const offUnmax = window.electronAPI.onWindowUnmaximize?.(() => setIsMaximized(false));
    return () => { offMax?.(); offUnmax?.(); };
  }, []);

  return (
    <div
      className="flex items-center justify-between w-full flex-shrink-0 select-none"
      style={{ height: '32px', WebkitAppRegion: 'drag', backgroundColor: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* App name */}
      <span
        className="pl-3 text-[11px] font-black tracking-[0.2em] text-red-500/70 uppercase"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        SPIDR
      </span>

      {/* Window controls */}
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.electronAPI.minimize()}
          className="flex items-center justify-center h-full px-4 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => window.electronAPI.maximize()}
          className="flex items-center justify-center h-full px-4 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.electronAPI.close()}
          className="flex items-center justify-center h-full px-4 text-zinc-500 hover:text-white hover:bg-red-600 transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
