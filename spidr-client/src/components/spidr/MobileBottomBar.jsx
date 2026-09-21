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
 *
 * `onToggleSidebar` toggles the mobile menu drawer — tapping Menu while it's
 * open closes it (and vice versa). `menuOpen` drives the active styling so
 * the Menu button reads as "on" while the drawer is showing.
 */
export default function MobileBottomBar({ activeTab, setActiveTab, onToggleSidebar, menuOpen = false }) {
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
      {/* Each button uses flex-1 so the row's full width is divided evenly
          between hit targets — no gaps between them. py-2.5 gives a ≥48px
          tall target (icon 20 + gap 4 + label 12 + 20px padding) which
          comfortably clears iOS HIG (44px) and Material 3 (48px) guidance.
          touch-manipulation disables the 300ms tap delay on iOS. */}
      <div className="flex items-stretch px-1 py-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = activeTab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setActiveTab(it.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 px-1 py-2.5 rounded-lg touch-manipulation transition-colors ${
                active ? 'text-red-500' : 'text-zinc-500 hover:text-white active:bg-white/5'
              }`}
            >
              {it.id === 'home' ? <SpiderLogo size={24} /> : <Icon className="w-5 h-5" />}
              <span className="text-[9px] font-bold uppercase tracking-wide">{it.label}</span>
            </button>
          );
        })}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`flex-1 flex flex-col items-center justify-center gap-1 px-1 py-2.5 rounded-lg touch-manipulation transition-colors ${
              menuOpen ? 'text-red-500' : 'text-zinc-500 hover:text-white active:bg-white/5'
            }`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">Menu</span>
          </button>
        )}
      </div>
    </nav>
  );
}
