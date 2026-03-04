import React from 'react';
import { motion } from 'framer-motion';
import { Blocks, Trash2, Search } from 'lucide-react';
import SymbiotePet from './widgets/SymbiotePet';
import AudioResonance from './widgets/AudioResonance';
import GamingUplink from './widgets/GamingUplink';
import PCSpecsFlex from './widgets/PCSpecsFlex';
import DynamicModuleWidget from './widgets/DynamicModuleWidget';

// Built-in hardcoded widgets for specific module names
const BUILTIN_WIDGETS = {
  'Symbiote Entity Pet': SymbiotePet,
  'Audio Resonance Player': AudioResonance,
  'Gaming Uplink Card': GamingUplink,
  'PC Specs Flex': PCSpecsFlex,
};

export default function InstalledModules({ modules, installedIds, onUninstall, onNavigateDiscover, currentUserId }) {
  const installed = modules.filter(m => installedIds.includes(m.id));

  if (installed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Blocks size={48} className="opacity-20 mb-4" />
        <p className="text-sm font-mono">NO MODULES INSTALLED</p>
        <p className="text-xs mt-1 mb-6">Browse Global Architecture to discover modules.</p>
        {onNavigateDiscover && (
          <button
            onClick={onNavigateDiscover}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-colors flex items-center gap-2"
          >
            <Search size={14} /> Discover New Modules
          </button>
        )}
      </div>
    );
  }

  // Separate built-in interactive widgets from dynamic user-created modules
  const builtinModules = installed.filter(m => BUILTIN_WIDGETS[m.name]);
  const dynamicModules = installed.filter(m => !BUILTIN_WIDGETS[m.name]);

  return (
    <div className="space-y-8">
      {/* Built-in Interactive Widgets */}
      {builtinModules.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-gray-500 border-b border-white/5 pb-2 mb-6">
            {'>'} BUILT_IN_WIDGETS: {builtinModules.length}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {builtinModules.map(mod => {
              const Widget = BUILTIN_WIDGETS[mod.name];
              return (
                <motion.div key={mod.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{mod.name}</span>
                    <button onClick={() => onUninstall(mod.id)} className="text-gray-600 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                  </div>
                  <Widget userId={currentUserId} isOwnProfile={true} />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic User-Created Modules (fully functional) */}
      {dynamicModules.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-gray-500 border-b border-white/5 pb-2 mb-6">
            {'>'} ACTIVE_MODULES: {dynamicModules.length}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dynamicModules.map(mod => (
              <motion.div key={mod.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{mod.name}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      mod.type === 'api_sync' ? 'bg-blue-500/10 text-blue-400' :
                      mod.type === 'live_feed' ? 'bg-purple-500/10 text-purple-400' :
                      mod.type === 'display_widget' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-green-500/10 text-green-400'
                    }`}>
                      {mod.type?.replace('_', ' ') || 'static'}
                    </span>
                  </div>
                  <button onClick={() => onUninstall(mod.id)} className="text-gray-600 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                </div>
                <DynamicModuleWidget mod={mod} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Discover more */}
      {onNavigateDiscover && (
        <div className="text-center pt-4">
          <button
            onClick={onNavigateDiscover}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Search size={14} /> Discover More Modules
          </button>
        </div>
      )}
    </div>
  );
}