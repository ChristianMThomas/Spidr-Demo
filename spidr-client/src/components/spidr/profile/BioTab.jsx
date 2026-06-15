import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Clock, Terminal, Edit2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ProfileAnthem from '../ProfileAnthem';

export default function BioTab({ userProfile, isOwnProfile, onWidgetSave, currentUser }) {
  const [localTime, setLocalTime] = useState('');
  const [tzLabel, setTzLabel] = useState('');
  const [editingActivity, setEditingActivity] = useState(false);
  const [editingPronouns, setEditingPronouns] = useState(false);
  const [activityVal, setActivityVal] = useState('');
  const [pronounsVal, setPronounsVal] = useState('');

  // ── Timezone widget ────────────────────────────────────────────────────
  // Renders THE PROFILE OWNER's local time, not the viewer's. The IANA tz
  // (e.g. 'America/Los_Angeles') lives on userProfile.timezone. If the
  // viewer is looking at their OWN profile and no tz is saved yet, we
  // auto-detect from the browser and persist it once so subsequent viewers
  // see the right time. The previous implementation used new Date()
  // .toLocaleTimeString() with no timeZone option, which always showed the
  // VIEWER's clock — making every profile look like it was in your zone.
  const ownerTz = userProfile?.timezone || null;
  useEffect(() => {
    // Auto-detect + persist once, only on own profile when no tz is saved.
    if (isOwnProfile && !ownerTz) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) onWidgetSave?.('timezone', detected);
      } catch {}
    }
    // onWidgetSave intentionally excluded — it's a stable useCallback now but
    // this effect must only re-run when the tz state actually changes, not on
    // every render cycle. Adding it would cause a save loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnProfile, ownerTz]);

  useEffect(() => {
    const tz = ownerTz || undefined; // undefined falls back to viewer's tz
    const update = () => {
      try {
        setLocalTime(new Date().toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit', timeZone: tz,
        }));
      } catch {
        // Invalid tz — fall back to plain local
        setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };
    update();
    const interval = setInterval(update, 30000); // 30s — minute precision is enough
    return () => clearInterval(interval);
  }, [ownerTz]);

  useEffect(() => {
    // Friendly label: prefer a saved location string if the user set one,
    // otherwise extract the city out of the IANA tz ("America/Los_Angeles"
    // → "Los Angeles"). Falls back to "Local" if neither is available.
    if (userProfile?.location) { setTzLabel(userProfile.location); return; }
    if (ownerTz) {
      const city = ownerTz.split('/').slice(-1)[0]?.replace(/_/g, ' ');
      setTzLabel(city || ownerTz);
    } else {
      setTzLabel('Local');
    }
  }, [userProfile?.location, ownerTz]);

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
          <Globe size={12} className="text-blue-400" /> LOCAL TIME ({tzLabel})
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

      {/* Profile Anthem — autoplay-muted on visitor profile views, with a
          one-click unmute/play. On own profile, falls through to an
          upload-prompt empty state when no anthem is set. */}
      <ProfileAnthem
        userProfile={userProfile}
        isOwnProfile={isOwnProfile}
        currentUser={currentUser}
      />

      {/* Activity & Pronouns mini grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
          <div className="text-[9px] text-[#FF3333] uppercase font-bold tracking-widest">Vibe Check</div>
          {editingActivity && isOwnProfile ? (
            <div className="flex gap-1 mt-0.5">
              <Input
                autoFocus
                value={activityVal}
                onChange={(e) => setActivityVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveActivity(); else if (e.key === 'Escape') setEditingActivity(false); }}
                className="h-5 text-[10px] bg-black/50 border-red-900/30 px-1"
                placeholder="Playing..."
              />
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
              <Input
                autoFocus
                value={pronounsVal}
                onChange={(e) => setPronounsVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') savePronouns(); else if (e.key === 'Escape') setEditingPronouns(false); }}
                className="h-5 text-[10px] bg-black/50 border-red-900/30 px-1"
                placeholder="he/him"
              />
              <button onClick={savePronouns} className="text-green-500 hover:text-green-400"><Check size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs font-bold text-pink-500" style={{ textShadow: '0 0 8px rgba(236,72,153,0.6)' }}>{userProfile?.pronouns || '✨ Set sign'}</span>
              {isOwnProfile && <Edit2 className="w-3 h-3 text-pink-800 cursor-pointer hover:text-pink-400 flex-shrink-0" onClick={() => { setEditingPronouns(true); setPronounsVal(userProfile?.pronouns || ''); }} />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}