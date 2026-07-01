import React from 'react';
import { Label } from '@/components/ui/label';
import { Ghost, Pin, RotateCcw } from 'lucide-react';

// Spidr Protocol = the OS-level transparent HUD spawned by Electron. This
// panel only drives the Electron protocol window — there is nothing
// configurable in a web context.
export default function SpidrProtocolSettings() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

  if (!isElectron) {
    return (
      <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-red-900/20 text-zinc-400 text-sm">
        Spidr Protocol is a desktop-only feature. Download the Electron app to
        configure the gaming overlay.
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-red-900/20">
      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Ghost className="w-5 h-5 text-red-500" />
        Spidr Protocol (Gaming Overlay)
      </h3>
      <p className="text-zinc-500 text-sm mb-5">
        A transparent always-on-top HUD that floats over any app on your
        computer. Toggle it from any chat header.
      </p>

      <Label className="text-zinc-300 mb-1 block flex items-center gap-2">
        <Pin className="w-4 h-4 text-red-500" /> Pin Anywhere
      </Label>
      <p className="text-zinc-500 text-xs mb-3">
        Snap the overlay to a corner or center of your screen. Its position is
        saved automatically and restored next time you open it.
      </p>
      <div className="grid grid-cols-5 gap-2 mb-2">
        {[
          { label: 'TL', value: 'top-left' },
          { label: 'TR', value: 'top-right' },
          { label: '◎',  value: 'center' },
          { label: 'BL', value: 'bottom-left' },
          { label: 'BR', value: 'bottom-right' },
        ].map(p => (
          <button
            key={p.value}
            onClick={() => window.electronAPI?.setProtocolPreset?.(p.value)}
            className="px-2 py-2 rounded-md text-xs font-mono tracking-wider bg-black/60 border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:shadow-[0_0_12px_rgba(220,38,38,0.35)] transition-all"
            title={`Pin to ${p.value.replace('-', ' ')}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => window.electronAPI?.resetProtocolPosition?.()}
        className="w-full px-3 py-2 rounded-md text-xs font-mono tracking-wider bg-black/60 border border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400 transition-all flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-3 h-3" /> Reset to Default Position
      </button>
      <p className="text-zinc-600 text-xs mt-3">
        Tip: press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">Shift+Enter</kbd> while
        gaming to grab the overlay, then drag from the red rail at the top.
        Resize from any edge.
      </p>
    </div>
  );
}
