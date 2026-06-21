import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Gamepad2, X, Zap, AppWindow, Loader2 } from 'lucide-react';

// Mock entries used only on the web build (browsers show their own native
// picker, so these are just affordances — getDisplayMedia opens the real one).
const DETECTED_APPS = [
  { id: 'game_1', name: 'League of Legends', icon: '⚔️', type: 'game', status: 'Active' },
  { id: 'game_2', name: 'Valorant', icon: '🎮', type: 'game', status: 'Active' },
  { id: 'app_1', name: 'Visual Studio Code', icon: '📝', type: 'app', status: 'Running' },
  { id: 'app_2', name: 'Discord', icon: '💬', type: 'app', status: 'Running' },
];

export default function StreamSelector({ isOpen, onClose, onStartStream }) {
  const [activeTab, setActiveTab] = useState('screens');
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

        <div className="flex border-b border-white/5">
          <Tab label="SCREENS" active={activeTab === 'screens'} onClick={() => setActiveTab('screens')} icon={Monitor} />
          <Tab label={isElectron ? 'WINDOWS' : 'APPLICATIONS'} active={activeTab === 'games'} onClick={() => setActiveTab('games')} icon={isElectron ? AppWindow : Gamepad2} />
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

          {/* ── Web: mock affordances (real native picker opens on click) ───── */}
          {!isElectron && activeTab === 'games' && DETECTED_APPS.filter(app => app.type === 'game').map((app, idx) => (
            <div
              key={app.id}
              onClick={() => onStartStream(app.id)}
              className={`${idx === 0 ? 'col-span-2' : ''} bg-gradient-to-r from-[#FF3333]/20 to-transparent border border-[#FF3333] rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-[#FF3333]/10 transition-all group`}
            >
              <div className="w-12 h-12 bg-black rounded-lg border border-[#FF3333]/50 flex items-center justify-center text-2xl animate-pulse shrink-0">
                {app.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#FF3333] text-[10px] font-bold uppercase tracking-widest">Spidr Sense Detected</span>
                  <span className="w-2 h-2 bg-[#FF3333] rounded-full animate-ping shrink-0" />
                </div>
                <h3 className="text-white font-bold text-lg truncate">{app.name}</h3>
                <p className="text-gray-400 text-xs truncate">{app.status} • Ready to Stream</p>
              </div>
              <button className="bg-[#FF3333] text-white px-4 py-2 rounded-lg font-bold text-xs group-hover:scale-105 transition-transform shrink-0">
                GO LIVE
              </button>
            </div>
          ))}

          {!isElectron && activeTab === 'games' && DETECTED_APPS.filter(app => app.type === 'app').map(app => (
            <WindowCard key={app.id} name={app.name} icon={app.icon} status={app.status} onClick={() => onStartStream(app.id)} />
          ))}

          {!isElectron && activeTab === 'screens' && (
            <>
              <WindowCard name="Screen 1 (Primary)" icon="🖥️" status="Main Display" onClick={() => onStartStream('screen_1')} />
              <WindowCard name="Screen 2" icon="🖥️" status="Secondary" onClick={() => onStartStream('screen_2')} />
              <WindowCard name="Entire Desktop" icon="💻" status="All Screens" onClick={() => onStartStream('desktop')} />
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
}

const Tab = ({ label, active, onClick, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-bold transition-colors ${active ? 'bg-white/5 text-white border-b-2 border-[#FF3333]' : 'text-gray-500 hover:text-white'}`}
  >
    <Icon size={14} /> {label}
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

const WindowCard = ({ name, icon, status, onClick }) => (
  <div onClick={onClick} className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-white/20 hover:bg-[#1a1a1a] cursor-pointer transition-all">
    <div className="w-full h-24 bg-black rounded-lg flex items-center justify-center text-4xl grayscale opacity-50">
      {icon}
    </div>
    <div className="min-w-0">
      <span className="text-sm font-bold text-gray-300 truncate block">{name}</span>
      <span className="text-xs text-gray-500">{status}</span>
    </div>
  </div>
);
