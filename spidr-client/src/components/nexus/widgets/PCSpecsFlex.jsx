import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, HardDrive, MemoryStick, Monitor, Edit2, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Input } from '@/components/ui/input';

const SPEC_FIELDS = [
  { key: 'gpu', label: 'GPU', icon: Monitor, color: 'text-green-400', glow: 'rgba(74,222,128,0.2)' },
  { key: 'cpu', label: 'CPU', icon: Cpu, color: 'text-blue-400', glow: 'rgba(96,165,250,0.2)' },
  { key: 'ram', label: 'RAM', icon: MemoryStick, color: 'text-purple-400', glow: 'rgba(192,132,252,0.2)' },
  { key: 'storage', label: 'STORAGE', icon: HardDrive, color: 'text-amber-400', glow: 'rgba(251,191,36,0.2)' },
];

export default function PCSpecsFlex({ userId, isOwnProfile }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: userId });
      return profiles[0] || null;
    },
    enabled: !!userId,
  });

  const specs = profile?.pc_specs || profile?.theme?.pc_specs || {};

  const saveMutation = useMutation({
    mutationFn: async (newSpecs) => {
      if (!profile) return;
      await entities.UserProfile.update(profile.id, {
        pc_specs: newSpecs
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      setEditing(false);
    },
  });

  const startEditing = () => {
    setDraft({ ...specs });
    setEditing(true);
  };

  const hasAnySpecs = SPEC_FIELDS.some(f => specs[f.key]);

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">PC Specs Flex</span>
        </div>
        {isOwnProfile && !editing && (
          <button onClick={startEditing} className="text-gray-600 hover:text-white transition-colors">
            <Edit2 size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {SPEC_FIELDS.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="flex items-center gap-2">
              <Icon size={12} className={color + ' shrink-0'} />
              <span className="text-[9px] font-bold text-gray-500 uppercase w-14 shrink-0">{label}</span>
              <Input
                value={draft[key] || ''}
                onChange={(e) => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={key === 'gpu' ? 'RTX 4090' : key === 'cpu' ? 'i9-14900K' : key === 'ram' ? '64GB DDR5' : '2TB NVMe'}
                className="h-7 text-[10px] bg-black/50 border-white/10 px-2 text-white"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="px-2 py-1 text-[10px] text-gray-500 hover:text-white transition-colors">
              <X size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); saveMutation.mutate(draft); }}
              className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <Check size={10} /> Save
            </button>
          </div>
        </div>
      ) : hasAnySpecs ? (
        <div className="space-y-2">
          {SPEC_FIELDS.map(({ key, label, icon: Icon, color, glow }) => {
            const val = specs[key];
            if (!val) return null;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-2 bg-black/40 border border-white/5 rounded-lg"
                style={{ boxShadow: `0 0 12px ${glow}` }}
              >
                <Icon size={14} className={color} />
                <div className="min-w-0 flex-1">
                  <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">{label}</div>
                  <div className="text-[11px] text-white font-bold truncate">{val}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-[10px] text-gray-500 font-mono">
            {isOwnProfile ? 'No specs set — click edit to flex your rig.' : 'No specs configured yet.'}
          </p>
        </div>
      )}
    </div>
  );
}