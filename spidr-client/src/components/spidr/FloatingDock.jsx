/**
 * ⚠️  UNUSED / ORPHANED COMPONENT — NOT RENDERED ANYWHERE.
 *
 * The desktop navigation rail is `components/spidr/Sidebar.jsx`; the mobile
 * one is `components/spidr/MobileBottomBar.jsx`. This dock was superseded
 * and nothing imports it (verified by grep across the whole client).
 *
 * Kept only for reference. Edits here have NO effect on the running app —
 * change Sidebar.jsx instead. (This banner exists because a UI change was
 * once implemented here and appeared to "not work" for exactly that reason.)
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Server, Settings, Film, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SpiderLogo from './SpiderLogo';
import { playSound } from './SoundEngine';
import spidrApexBadge from '@/assets/spidr-apex-badge.png';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * FloatingDock — the bottom quick-action bar.
 *
 * Two persisted user preferences (localStorage):
 *   - spidr_dock_enabled   : show or hide the dock entirely (toggle in Settings)
 *   - spidr_dock_collapsed : collapse to a small handle that expands on click
 *
 * The collapse/expand toggle lives on the dock itself (a small chevron handle
 * above it) so users can tuck it away without going into Settings.
 */
export default function FloatingDock({ activeTab, setActiveTab, onCreateServer }) {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('spidr_dock_enabled') !== 'false'; } catch { return true; }
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('spidr_dock_collapsed') === 'true'; } catch { return false; }
  });

  // Listen for preference changes from Settings so the dock reacts immediately.
  useEffect(() => {
    const handler = () => {
      try {
        setEnabled(localStorage.getItem('spidr_dock_enabled') !== 'false');
        setCollapsed(localStorage.getItem('spidr_dock_collapsed') === 'true');
      } catch {}
    };
    window.addEventListener('spidr-dock-pref-changed', handler);
    window.addEventListener('storage', handler); // sync across tabs
    return () => {
      window.removeEventListener('spidr-dock-pref-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('spidr_dock_collapsed', String(next)); } catch {}
      return next;
    });
  };

  if (!enabled) return null;

  const navItems = [
    { id: 'friends', icon: Users, label: 'Friends' },
    { id: 'servers', icon: Server, label: 'Servers' },
    { id: 'feed', icon: Film, label: 'Feed' },
    { id: 'ai', icon: null, label: 'Spidr AI' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <TooltipProvider>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5"
      >
        {/* Collapse handle — always visible above the dock */}
        <button
          onClick={toggleCollapsed}
          className="bg-zinc-900/80 backdrop-blur-2xl border border-red-900/30 rounded-full w-8 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:border-red-500/60 transition-colors shadow-lg"
          title={collapsed ? 'Expand dock' : 'Collapse dock'}
          aria-label={collapsed ? 'Expand dock' : 'Collapse dock'}
        >
          {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="dock-body"
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="bg-zinc-900/80 backdrop-blur-2xl border border-red-900/30 rounded-2xl px-3 py-3 shadow-2xl shadow-red-900/20"
            >
              <div className="flex items-center gap-2">
                {/* ── Spidr Core ──────────────────────────────────────────
                    The app's anchor point. Dormant it sits desaturated and
                    dim; hover lunges it to full color and scale; active it
                    breathes on a 3s loop with a live red aura. Clicking
                    fires a synthesized symbiote heartbeat (SoundEngine —
                    Web Audio, no MP3 to ship or 404). */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => { playSound('heartbeat'); setActiveTab('home'); }}
                      aria-label="Home"
                      aria-current={activeTab === 'home' ? 'page' : undefined}
                      className={`group relative w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border transition-all duration-500 ${
                        activeTab === 'home'
                          ? 'bg-red-950/40 border-red-500/40 shadow-[0_0_28px_rgba(220,38,38,0.28)]'
                          : 'bg-[#0a0a0a] border-white/5 hover:bg-[#141414] hover:border-white/10'
                      }`}
                      whileHover={{ y: -8 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Active background pulse */}
                      {activeTab === 'home' && (
                        <span className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                      )}
                      {/* Dormant glass sheen */}
                      {activeTab !== 'home' && (
                        <span className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none z-20" />
                      )}
                      <img
                        src="/spidr-mascot.png"
                        alt=""
                        draggable={false}
                        className={`w-full h-full object-contain p-1.5 relative z-10 transition-all duration-500 ${
                          activeTab === 'home'
                            ? 'animate-symbiote'
                            : 'grayscale-[60%] brightness-[0.6] group-hover:grayscale-0 group-hover:brightness-100 group-hover:scale-110'
                        }`}
                      />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-zinc-900 border-red-900/30">
                    <p>Home</p>
                  </TooltipContent>
                </Tooltip>

                <div className="w-px h-8 bg-red-900/30 mx-1" />

                {/* Nav Items */}
                {navItems.map((item) => (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        onClick={() => setActiveTab(item.id)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                          activeTab === item.id
                            ? 'bg-red-600 text-white scale-110'
                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                        }`}
                        whileHover={{ y: -8, scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {item.id === 'ai' ? (
                          <SpiderLogo size={20} />
                        ) : (
                          <item.icon className="w-5 h-5" />
                        )}
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-900 border-red-900/30">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}

                <div className="w-px h-8 bg-red-900/30 mx-1" />

                {/* APEX Tier — the shield badge IS the button. Routes to
                    Settings with ?apex=1 which auto-opens the APEX store. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => navigate('/settings?apex=1')}
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:bg-yellow-500/10"
                      whileHover={{ y: -8, scale: 1.12 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <img src={spidrApexBadge} alt="APEX Tier" draggable={false}
                        className="w-9 h-9 object-contain drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-zinc-900 border-yellow-500/30">
                    <p>APEX Tier</p>
                  </TooltipContent>
                </Tooltip>

                {/* Add Server */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={onCreateServer}
                      className="w-12 h-12 rounded-xl bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white flex items-center justify-center transition-all"
                      whileHover={{ y: -8, scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Plus className="w-5 h-5" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-zinc-900 border-red-900/30">
                    <p>Create Server</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
}
