import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { detectPlatform, audioSupportFor, bestAudioRoute } from '@/lib/shareAudioSupport';
import { Monitor, Gamepad2, X, Zap, AppWindow, Loader2, Volume2, VolumeX } from 'lucide-react';

// NOTE: this file used to carry a hardcoded DETECTED_APPS list — League of
// Legends, Valorant, VS Code, Discord — rendered on the web build with
// "SPIDR SENSE DETECTED" badges. None of it was real. Those entries showed
// whether or not the games were installed, let alone running, and clicking
// any of them just opened the browser's own picker regardless. It has been
// deleted rather than rewritten: a browser CANNOT enumerate your running
// applications (that would be a serious privacy hole), so the honest web
// flow is to hand straight off to the native picker and explain what to
// choose there.

export default function StreamSelector({ isOpen, onClose, onStartStream }) {
  const [activeTab, setActiveTab] = useState('screens');
  // Which sources can actually carry sound here — see lib/shareAudioSupport
  // for the full platform matrix. Surfaced up front because the most common
  // failure is picking a source that is silently mute and only finding out
  // when someone says they can't hear the music.
  const platform = detectPlatform();
  const route = bestAudioRoute(platform);
  const screenAudio = audioSupportFor('screen', platform);
  const windowAudio = audioSupportFor('window', platform);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Electron: pull the real screen/window capture sources from the main process.
  const [sources, setSources] = useState(null); // null = loading, [] = none
  useEffect(() => {
    if (!isOpen || !isElectron || !window.electronAPI?.getDesktopSources) return;
    let alive = true;
    setSources(null);
    window.electronAPI.getDesktopSources()
      .then(list => { if (alive) setSources(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setSources([]); });
    return () => { alive = false; };
  }, [isOpen, isElectron]);

  if (!isOpen) return null;

  const screens = (sources || []).filter(s => s.kind === 'screen');
  const windows = (sources || []).filter(s => s.kind === 'window');

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl bg-[#050505] border border-[#FF3333]/30 rounded-2xl shadow-[0_0_50px_rgba(255,51,51,0.1)] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="text-[#FF3333]" size={20} />
            <h2 className="font-bold text-white tracking-wider">ESTABLISH NEURAL LINK</h2>
          </div>
          <button onClick={onClose}><X className="text-gray-500 hover:text-white" /></button>
        </div>

        {/* Audio routing guidance — tells you the one thing that actually
            works in THIS environment before you pick something silent. */}
        <div className="px-6 py-3 border-b border-white/5 flex items-start gap-2.5 bg-white/[0.02]">
          <Volume2 className="w-4 h-4 text-[#1DB954] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white/80">Sharing music?</p>
            <p className="text-[11px] text-white/45 leading-snug">{route.label}</p>
          </div>
        </div>

        <div className="flex border-b border-white/5">
          <Tab
            label="SCREENS"
            active={activeTab === 'screens'}
            onClick={() => setActiveTab('screens')}
            icon={Monitor}
            muted={!screenAudio.audio}
            mutedHint={screenAudio.why}
          />
          <Tab
            label={isElectron ? 'WINDOWS' : 'APPLICATIONS'}
            active={activeTab === 'games'}
            onClick={() => setActiveTab('games')}
            icon={isElectron ? AppWindow : Gamepad2}
            muted={!windowAudio.audio}
            mutedHint={windowAudio.why}
          />
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 min-h-[300px] max-h-[500px] overflow-y-auto content-start">

          {/* ── Electron: real desktopCapturer sources ─────────────────────── */}
          {isElectron && sources === null && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
              <Loader2 className="animate-spin text-[#FF3333]" size={28} />
              <span className="text-xs font-mono uppercase tracking-widest">Scanning displays…</span>
            </div>
          )}

          {isElectron && sources !== null && activeTab === 'screens' && screens.map(src => (
            <SourceCard key={src.id} src={src} onClick={() => onStartStream(src.id)} />
          ))}
          {isElectron && sources !== null && activeTab === 'games' && windows.map(src => (
            <SourceCard key={src.id} src={src} onClick={() => onStartStream(src.id)} />
          ))}
          {isElectron && sources !== null &&
            ((activeTab === 'screens' && screens.length === 0) || (activeTab === 'games' && windows.length === 0)) && (
            <div className="col-span-2 text-center py-16 text-gray-600 text-xs font-mono uppercase tracking-widest">
              No {activeTab === 'screens' ? 'displays' : 'windows'} detected
            </div>
          )}

          {/* ── Web: hand off to the browser's own picker ──────────────────
              A browser cannot list your running apps or screens — only the
              native picker can, and it appears the moment we call
              getDisplayMedia. So instead of a fake grid, we explain what to
              pick and open the real thing. */}
          {!isElectron && (
            <div className="col-span-2 flex flex-col items-center justify-center py-10 px-4 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-white/40" />
              </div>
              <div>
                <p className="text-white font-bold text-sm mb-1">Your browser handles the picking</p>
                <p className="text-white/45 text-xs leading-relaxed max-w-sm">
                  {route.label}
                </p>
              </div>

              <button
                onClick={() => onStartStream('browser')}
                className="px-5 py-2.5 rounded-xl bg-[#FF3333] hover:bg-red-500 text-white text-xs font-black tracking-widest uppercase transition-colors"
              >
                Choose what to share
              </button>

              <div className="w-full max-w-sm text-left mt-2 space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">In the picker</p>
                <ul className="text-[11px] text-white/45 space-y-1 list-disc list-inside">
                  <li>Pick <strong className="text-white/70">Chrome Tab</strong> for music — window shares never carry audio.</li>
                  <li>Tick the <strong className="text-white/70">Share tab audio</strong> box, bottom-left of the dialog.</li>
                  <li>Desktop app users can share the Spotify app directly with system audio.</li>
                </ul>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}

const Tab = ({ label, active, onClick, icon: Icon, muted = false, mutedHint = '' }) => (
  <button
    onClick={onClick}
    title={muted ? mutedHint : undefined}
    className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-bold transition-colors ${active ? 'bg-white/5 text-white border-b-2 border-[#FF3333]' : 'text-gray-500 hover:text-white'}`}
  >
    <Icon size={14} /> {label}
    {/* A crossed-speaker marks source kinds that CANNOT carry audio in this
        environment — so the DJ learns before broadcasting silence, not after. */}
    {muted && <VolumeX size={12} className="text-amber-500/80" />}
  </button>
);

// Real capture-source tile with a live thumbnail from the OS.
const SourceCard = ({ src, onClick }) => (
  <div onClick={onClick} className="bg-[#111] border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:border-[#FF3333]/60 hover:bg-[#1a1a1a] cursor-pointer transition-all group">
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
      {src.thumbnail
        ? <img src={src.thumbnail} alt="" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
        : <Monitor size={28} className="text-zinc-700" />}
    </div>
    <div className="flex items-center gap-2 min-w-0">
      {src.appIcon && <img src={src.appIcon} alt="" className="w-4 h-4 shrink-0 rounded-sm" />}
      <span className="text-xs font-bold text-gray-300 truncate">{src.name || 'Source'}</span>
    </div>
  </div>
);


