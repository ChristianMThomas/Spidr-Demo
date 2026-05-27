import React from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { LayoutPanelLeft, Plus, Trash2, Loader2, Blocks } from 'lucide-react';
import { toast } from 'sonner';

export default function TelemetryDeck({ currentUser, onDiscoverModules }) {
  const queryClient = useQueryClient();

  const { data: installed = [], isLoading: loadingInstalled } = useQuery({
    queryKey: ['installed-modules', currentUser?.id],
    queryFn: () => entities.InstalledModule.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
  });

  const { data: allModules = [], isLoading: loadingModules } = useQuery({
    queryKey: ['modules'],
    queryFn: () => entities.Module.list('-install_count', 200),
  });

  const installedIds = installed.map(i => i.module_id);
  const installedModules = allModules.filter(m => installedIds.includes(m.id));

  const handleUninstall = async (moduleId) => {
    const record = installed.find(i => i.module_id === moduleId);
    if (record) {
      await entities.InstalledModule.delete(record.id);
      const mod = allModules.find(m => m.id === moduleId);
      if (mod) await entities.Module.update(moduleId, { install_count: Math.max(0, (mod.install_count || 1) - 1) });
      queryClient.invalidateQueries({ queryKey: ['installed-modules', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['profile-modules'] });
      toast.success('Module removed');
    }
  };

  const isLoading = loadingInstalled || loadingModules;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 border-b border-white/5 pb-6">
        <h2 className="text-2xl font-black text-white uppercase flex items-center gap-3">
          <LayoutPanelLeft className="text-blue-500" /> Telemetry Widgets
        </h2>
        <p className="text-xs text-gray-500 mt-2 font-mono">
          {'>'} INSTALLED_MODULES: {installedModules.length}<br />
          {'>'} These modules are active on your profile card.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} /> Loading modules...
        </div>
      ) : installedModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Blocks size={48} className="opacity-20 mb-4" />
          <p className="text-sm font-mono">NO MODULES INSTALLED</p>
          <p className="text-xs mt-1 mb-6">Install modules from the Module Nexus to see them here.</p>
          {onDiscoverModules && (
            <button
              onClick={onDiscoverModules}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-colors flex items-center gap-2"
            >
              <Plus size={14} /> Browse Modules
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {installedModules.map((mod) => {
            const typeColors = {
              'api_sync': { bg: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-400', glow: 'bg-blue-500/10' },
              'live_feed': { bg: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-400', glow: 'bg-purple-500/10' },
              'display_widget': { bg: 'border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400', glow: 'bg-amber-500/10' },
              'static_text': { bg: 'border-green-500/30', badge: 'bg-green-500/20 text-green-400', glow: 'bg-green-500/10' },
            };
            const colors = typeColors[mod.type] || typeColors['static_text'];

            return (
              <motion.div
                key={mod.id}
                whileHover={{ scale: 1.01 }}
                className={`relative p-5 rounded-2xl border bg-[#111] ${colors.bg} shadow-lg overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 ${colors.glow} blur-[50px] pointer-events-none`} />
                
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-black border border-white/10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                      {mod.icon_url ? (
                        <img src={mod.icon_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Blocks size={18} className="text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{mod.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${colors.badge}`}>
                          {mod.type?.replace('_', ' ') || 'static'}
                        </span>
                        <span className="text-[9px] text-gray-600">by @{mod.author_name || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUninstall(mod.id)}
                    className="text-gray-600 hover:text-red-500 transition-colors shrink-0 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <p className="text-[11px] text-gray-400 mb-3 line-clamp-2">{mod.description}</p>

                <div className="bg-black/50 border border-white/5 p-3 rounded-xl">
                  <div className="text-[8px] font-black text-gray-600 uppercase mb-1 tracking-widest">Status</div>
                  <div className="text-[10px] text-gray-300 font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    ACTIVE — Visible on your profile
                  </div>
                </div>
              </motion.div>
            );
          })}

          <button
            onClick={() => onDiscoverModules?.()}
            className="h-full min-h-[160px] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-white/30 hover:bg-white/5 transition-colors group"
          >
            <div className="w-10 h-10 bg-[#111] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={20} className="text-gray-500" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Discover New Modules</span>
          </button>
        </div>
      )}
    </div>
  );
}