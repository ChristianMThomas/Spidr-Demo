import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Skull } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';

// Derive a display mood from the persisted last-action + timestamp
function computeMood(symbiote) {
  if (!symbiote?.last_action_at) return 'idle';
  const elapsed = Date.now() - new Date(symbiote.last_action_at).getTime();
  if (symbiote.last_action === 'feed' && elapsed < 5 * 60 * 1000) return 'happy';
  if (symbiote.last_action === 'poke' && elapsed < 60 * 1000) return 'angry';
  return 'idle';
}

export default function SymbiotePet({ userId, isOwnProfile }) {
  const queryClient = useQueryClient();
  const [mood, setMood] = useState('idle');
  const [moodTimer, setMoodTimer] = useState(null);

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const results = await entities.UserProfile.filter({ user_id: userId });
      return results?.[0] ?? null;
    },
    enabled: !!userId,
  });

  // Sync mood from backend on profile load
  useEffect(() => {
    if (!profile) return;
    setMood(computeMood(profile.neural_links?.symbiote));
  }, [profile?.neural_links?.symbiote?.last_action_at]);

  const persistAction = async (action) => {
    if (!profile?.id) return;
    const symbiote = { last_action: action, last_action_at: new Date().toISOString() };
    await entities.UserProfile.update(profile.id, {
      neural_links: { ...(profile.neural_links || {}), symbiote },
    });
    queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
  };

  const triggerMood = (newMood, duration, action) => {
    if (moodTimer) clearTimeout(moodTimer);
    setMood(newMood);
    if (isOwnProfile) persistAction(action);
    const t = setTimeout(() => setMood('idle'), duration);
    setMoodTimer(t);
  };

  const pokePet  = () => triggerMood('angry', 1000, 'poke');
  const feedPet  = () => triggerMood('happy', 2000, 'feed');

  return (
    <div className="bg-[#0a0a0a] border border-purple-500/30 rounded-xl p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[160px] group">
      <div className="absolute top-2 left-3 flex items-center gap-1 text-purple-500">
        <Skull size={12} />
        <span className="text-[9px] font-black uppercase tracking-widest">Entity Companion</span>
      </div>

      <motion.div
        onClick={pokePet}
        animate={{
          borderRadius: mood === 'angry'
            ? ['20%', '50%', '10%']
            : ['40% 60% 70% 30%', '60% 40% 30% 70%', '40% 60% 70% 30%'],
          scale: mood === 'happy' ? [1, 1.2, 1] : mood === 'angry' ? [1, 0.9, 1.1, 1] : 1,
          rotate: mood === 'idle' ? [0, 10, -10, 0] : 0,
          backgroundColor: mood === 'happy' ? '#a855f7' : mood === 'angry' ? '#ef4444' : '#111',
        }}
        transition={{ repeat: mood === 'idle' ? Infinity : 0, duration: mood === 'idle' ? 4 : 0.3 }}
        className="w-16 h-16 border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer mt-4 flex items-center justify-center"
      >
        <div className="flex gap-2">
          <div className={`w-2 bg-white rounded-full transition-all ${mood === 'angry' ? 'h-1 rotate-45' : 'h-3'}`} />
          <div className={`w-2 bg-white rounded-full transition-all ${mood === 'angry' ? 'h-1 -rotate-45' : 'h-3'}`} />
        </div>
      </motion.div>

      <div className="text-[10px] text-gray-500 font-mono mt-4">
        {mood === 'idle' ? 'Awaiting interaction...' : mood === 'angry' ? '*Hisses*' : '*Purrs*'}
      </div>

      <div className="absolute bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button onClick={feedPet} className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500 text-purple-400 hover:text-white rounded-lg text-[9px] font-bold uppercase transition-colors">Feed</button>
        <button onClick={pokePet} className="px-3 py-1 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg text-[9px] font-bold uppercase transition-colors">Poke</button>
      </div>
    </div>
  );
}
