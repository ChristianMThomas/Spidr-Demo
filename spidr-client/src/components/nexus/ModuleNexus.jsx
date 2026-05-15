import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Blocks, Search, Plus, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ModuleCard from './ModuleCard';
import ModuleFabricator from './ModuleFabricator';
import InstalledModules from './InstalledModules';

export default function ModuleNexus() {
  const { currentUser } = useOutletContext();
  const [activeTab, setActiveTab] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [installingId, setInstallingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: () => entities.Module.list('-install_count', 200),
  });

  // Show public modules (approved or newly published)
  const approvedModules = modules.filter(m => m.is_public !== false);

  const { data: installed = [] } = useQuery({
    queryKey: ['installed-modules', currentUser?.id],
    queryFn: () => entities.InstalledModule.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
  });
  const installedIds = installed.map(i => i.module_id);

  const installMutation = useMutation({
    mutationFn: async (moduleId) => {
      // Prevent duplicate installs
      if (installedIds.includes(moduleId)) return;
      setInstallingId(moduleId);
      await entities.InstalledModule.create({ user_id: currentUser.id, module_id: moduleId });
      const mod = modules.find(m => m.id === moduleId);
      if (mod) await entities.Module.update(moduleId, { install_count: (mod.install_count || 0) + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installed-modules', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['profile-modules'] });
      toast.success('Module installed!');
      setInstallingId(null);
    },
    onError: () => setInstallingId(null),
  });

  const uninstallMutation = useMutation({
    mutationFn: async (moduleId) => {
      const record = installed.find(i => i.module_id === moduleId);
      if (record) await entities.InstalledModule.delete(record.id);
      const mod = modules.find(m => m.id === moduleId);
      if (mod) await entities.Module.update(moduleId, { install_count: Math.max(0, (mod.install_count || 1) - 1) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installed-modules', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['profile-modules'] });
      toast.success('Module removed');
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ moduleId, reason }) => {
      const mod = modules.find(m => m.id === moduleId);
      const existing = mod?.reports || [];
      const newReports = [...existing, { reporter_id: currentUser.id, reason, date: new Date().toISOString() }];
      const update = { reports: newReports };
      // Auto-flag if 3+ reports
      if (newReports.length >= 3) update.status = 'flagged';
      await entities.Module.update(moduleId, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      toast.success('Report submitted — thank you for keeping Spidr safe.');
    },
  });

  const filtered = approvedModules.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.name?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q) || m.tags?.some(t => t.toLowerCase().includes(q));
  });

  const tabs = [
    { id: 'discover', label: 'Global Architecture', icon: Search },
    { id: 'installed', label: 'My Repository', icon: Download },
    { id: 'fabricate', label: 'Fabricate', icon: Plus, color: 'text-[#FF3333]' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#020202] text-white overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/5 bg-[#0a0a0a] relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <Blocks className="text-blue-500" size={28} /> Module Nexus
            </h1>
            <p className="text-[10px] text-gray-500 font-mono mt-1">{'>'}  DISCOVER // FABRICATE // INJECT_TELEMETRY</p>
          </div>
          <div className="relative w-64 group">
            <Search size={16} className="absolute left-4 top-3 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
            <input type="text" placeholder="Search modules..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none font-mono transition-colors" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-8 border-b border-white/5 bg-[#050505] shrink-0">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 py-3.5 mr-8 text-[10px] font-black uppercase tracking-widest transition-colors relative ${activeTab === tab.id ? (tab.color || 'text-white') : 'text-gray-500 hover:text-gray-300'}`}>
            <tab.icon size={14} /> {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="nexustab" className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.color ? 'bg-[#FF3333] shadow-[0_0_10px_#FF3333]' : 'bg-white shadow-[0_0_10px_white]'}`} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'discover' && (
            <motion.div key="discover" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-500 font-mono text-sm">
                  {searchQuery ? 'No modules match your search.' : 'No modules yet. Be the first to fabricate one!'}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filtered.map(mod => (
                    <ModuleCard
                      key={mod.id}
                      mod={mod}
                      isInstalled={installedIds.includes(mod.id)}
                      onInstall={(id) => installMutation.mutate(id)}
                      onUninstall={(id) => uninstallMutation.mutate(id)}
                      onReport={(id, reason) => reportMutation.mutate({ moduleId: id, reason })}
                      installing={installingId === mod.id}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'installed' && (
            <motion.div key="installed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <InstalledModules
                modules={modules}
                installedIds={installedIds}
                onUninstall={(id) => uninstallMutation.mutate(id)}
                onNavigateDiscover={() => setActiveTab('discover')}
                currentUserId={currentUser?.id}
              />
            </motion.div>
          )}

          {activeTab === 'fabricate' && (
            <motion.div key="fabricate" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
              <ModuleFabricator currentUser={currentUser} onPublished={() => { queryClient.invalidateQueries({ queryKey: ['modules'] }); setActiveTab('discover'); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}