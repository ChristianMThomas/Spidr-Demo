import React from 'react';
import { motion } from 'framer-motion';
import { Users, Server, Settings, Film, Plus } from 'lucide-react';
import SpiderLogo from './SpiderLogo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function FloatingDock({ activeTab, setActiveTab, onCreateServer }) {
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
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-zinc-900/80 backdrop-blur-2xl border border-red-900/30 rounded-2xl px-3 py-3 shadow-2xl shadow-red-900/20">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => setActiveTab('home')}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    activeTab === 'home' ? 'bg-red-600 scale-110' : 'bg-zinc-800/50 hover:bg-zinc-700'
                  }`}
                  whileHover={{ y: -8, scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <SpiderLogo size={28} />
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
        </div>
      </motion.div>
    </TooltipProvider>
  );
}