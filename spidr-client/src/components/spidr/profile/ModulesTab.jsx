import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Blocks, Loader2 } from 'lucide-react';
import DynamicModuleWidget from '@/components/nexus/widgets/DynamicModuleWidget';
import { getBuiltinWidget } from '@/components/nexus/widgets/builtinWidgets';

export default function ModulesTab({ userId, isOwnProfile }) {
  const { data: installed = [], isLoading: loadingInstalled } = useQuery({
    queryKey: ['profile-modules', userId],
    queryFn: () => entities.InstalledModule.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const { data: allModules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: () => entities.Module.list('-install_count', 200),
  });

  const installedIds = installed.map(i => i.module_id);
  const modules = allModules.filter(m => installedIds.includes(m.id));

  if (loadingInstalled) {
    return (
      <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading...
      </motion.div>
    );
  }

  if (modules.length === 0) {
    return (
      <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Blocks size={24} className="opacity-20 mb-2" />
        <p className="text-[10px] font-mono">NO MODULES INSTALLED</p>
      </motion.div>
    );
  }

  return (
    <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="space-y-3">
      {modules.map((mod) => {
        const BuiltinWidget = getBuiltinWidget(mod);
        return (
          <div key={mod.id} className="transform scale-[0.85] origin-top-left w-[118%]">
            {BuiltinWidget ? <BuiltinWidget userId={userId} isOwnProfile={isOwnProfile} /> : <DynamicModuleWidget mod={mod} />}
          </div>
        );
      })}
    </motion.div>
  );
}