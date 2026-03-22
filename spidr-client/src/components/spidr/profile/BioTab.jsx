import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Clock, Terminal, Edit2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function BioTab({ userProfile, isOwnProfile, onWidgetSave }) {
  const [localTime, setLocalTime] = useState('');
  const [editingActivity, setEditingActivity] = useState(false);
  const [editingPronouns, setEditingPronouns] = useState(false);
  const [activityVal, setActivityVal] = useState('');
  const [pronounsVal, setPronounsVal] = useState('');

  useEffect(() => {
    const update = () => setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const saveActivity = () => {
    onWidgetSave('activity', activityVal);
    setEditingActivity(false);
  };

  const savePronouns = () => {
    onWidgetSave('pronouns', pronounsVal);
    setEditingPronouns(false);
  };

  return (
    <motion.div key="bio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      {/* Timezone Widget */}
      <div className="flex items-center justify-between p-2.5 bg-[#111]/80 rounded-lg border border-white/5">
        <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase font-bold tracking-widest">
          <Globe size={12} className="text-blue-400" /> LOCAL TIME ({userProfile?.location || 'EST'})
        </div>
        <div className="text-xs font-mono text-white flex items-center gap-1">
          <Clock size={12} className="text-gray-500" /> {localTime}
        </div>
      </div>

      {/* Bio */}
      <div className="p-3 bg-black/30 rounded-lg border border-white/5">
        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
          <Terminal size={10} /> Signal Bio
        </div>
        <p className="text-[12px] text-gray-300 leading-relaxed">
          {userProfile?.bio || "No bio data transmitted."}
        </p>
      </div>

      {/* Activity & Pronouns mini grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
          <div className="text-[9px] text-[#FF3333] uppercase font-bold tracking-widest">Vibe Check</div>
          {editingActivity && isOwnProfile ? (
            <div className="flex gap-1 mt-0.5">
              <Input value={activityVal} onChange={(e) => setActivityVal(e.target.value)} className="h-5 text-[10px] bg-black/50 border-red-900/30 px-1" placeholder="Playing..." />
              <button onClick={saveActivity} className="text-green-500 hover:text-green-400"><Check size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-white truncate">{userProfile?.activity?.name ? `🎵 ${userProfile.activity.name}` : '🎵 –'}</span>
              {isOwnProfile && <Edit2 className="w-3 h-3 text-gray-600 cursor-pointer hover:text-white flex-shrink-0" onClick={() => { setEditingActivity(true); setActivityVal(userProfile?.activity?.name || ''); }} />}
            </div>
          )}
        </div>
        <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
          <div className="text-[9px] text-[#FF3333] uppercase font-bold tracking-widest">Neon Sign</div>
          {editingPronouns && isOwnProfile ? (
            <div className="flex gap-1 mt-0.5">
              <Input value={pronounsVal} onChange={(e) => setPronounsVal(e.target.value)} className="h-5 text-[10px] bg-black/50 border-red-900/30 px-1" placeholder="he/him" />
              <button onClick={savePronouns} className="text-green-500 hover:text-green-400"><Check size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs font-bold text-pink-500" style={{ textShadow: '0 0 8px rgba(236,72,153,0.6)' }}>{userProfile?.pronouns || '✨ Vibe'}</span>
              {isOwnProfile && <Edit2 className="w-3 h-3 text-pink-800 cursor-pointer hover:text-pink-400 flex-shrink-0" onClick={() => { setEditingPronouns(true); setPronounsVal(userProfile?.pronouns || ''); }} />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}