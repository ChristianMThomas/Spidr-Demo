import React from 'react';
import { motion } from 'framer-motion';
import { Home, Users, Server, Film, Settings, Menu } from 'lucide-react';
import SpiderLogo from './SpiderLogo';

/**
 * MobileBottomBar — fixed bottom navigation for mobile viewports (<768px).
 *
 * Replaces the desktop FloatingDock and serves as the primary navigation
 * surface when the sidebar is hidden. Five primary destinations + a "menu"
 * button that opens the full sidebar drawer.
 *
 * Active state is driven by `activeTab` (same tokens the desktop sidebar uses)
 * so highlighting stays consistent across both navs.
 */
export default function MobileBottomBar({ activeTab, setActiveTab, onOpenSidebar }) {
  const items = [
    { id: 'home',     icon: Home,     label: 'Home' },
    { id: 'friends',  icon: Users,    label: 'Friends' },
    { id: 'servers',  icon: Server,   label: 'Servers' },
    { id: 'feed',     icon: Film,     label: 'Feed' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/85 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = activeTab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setActiveTab(it.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[52px] transition-colors ${
                active ? 'text-red-500' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wide">{it.label}</span>
            </button>
          );
        })}
        {onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[52px] text-zinc-500 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">Menu</span>
          </button>
        )}
      </div>
    </nav>
  );
}
