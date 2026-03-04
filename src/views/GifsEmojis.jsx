import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Layers, Globe, Plus, Sparkles, Image } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SystemArchive from '@/components/gifs/SystemArchive';
import HivePanel from '@/components/gifs/HivePanel';
import Fabricator from '@/components/gifs/Fabricator';

const TABS = [
  { id: 'system', label: 'SYSTEM CORE', icon: Layers, desc: 'Built-in GIFs & Emojis' },
  { id: 'hive', label: 'THE HIVE', icon: Globe, desc: 'Community uploads', color: 'blue' },
  { id: 'fabricator', label: 'FABRICATE', icon: Plus, desc: 'Upload your own', color: 'red' },
];

export default function GifsEmojis() {
  const [activeTab, setActiveTab] = useState('system');
  const [subTab, setSubTab] = useState('gifs');
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/5 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-[#FF3333] rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] font-mono">EXPRESSION_ENGINE</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Signal <span className="text-[#FF3333]">Archive</span>
              </h1>
            </div>
            
            {/* Search */}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input
                type="text"
                placeholder="Search signals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:border-[#FF3333]/50 outline-none font-mono"
              />
            </div>
          </div>

          {/* Main Tabs */}
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const accentColor = tab.color === 'blue' ? '#3B82F6' : tab.color === 'red' ? '#FF3333' : '#fff';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-[#0a0a0a] text-white border-t border-x border-white/10'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <tab.icon size={13} style={{ color: isActive ? accentColor : undefined }} />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          
          {/* System tab has sub-tabs */}
          {activeTab === 'system' && (
            <>
              <div className="flex gap-2 mb-5">
                {[{ id: 'gifs', label: 'GIFs', icon: Image }, { id: 'emojis', label: 'Emojis', icon: Sparkles }].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setSubTab(st.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      subTab === st.id
                        ? 'bg-[#FF3333]/15 text-[#FF3333] border border-[#FF3333]/30'
                        : 'bg-white/5 text-zinc-500 border border-white/5 hover:text-white'
                    }`}
                  >
                    <st.icon size={13} />
                    {st.label}
                  </button>
                ))}
              </div>
              <SystemArchive activeSubTab={subTab} search={search} />
            </>
          )}

          {activeTab === 'hive' && (
            <HivePanel currentUser={currentUser} search={search} />
          )}

          {activeTab === 'fabricator' && (
            <Fabricator currentUser={currentUser} />
          )}
        </div>
      </div>
    </div>
  );
}