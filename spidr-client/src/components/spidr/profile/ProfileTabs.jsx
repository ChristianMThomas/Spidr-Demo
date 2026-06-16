import React from 'react';
import { Terminal, Users, Link2, Blocks } from 'lucide-react';

const ALL_TABS = [
  { key: 'bio', label: 'BIO', icon: Terminal },
  { key: 'modules', label: 'MODS', icon: Blocks },
  { key: 'mutuals', label: 'MUTUALS', icon: Users },
  { key: 'links', label: 'LINKS', icon: Link2 },
];

export default function ProfileTabs({ activeTab, onTabChange, isOwnProfile = false }) {
  // Mutuals = friends/servers you share with the profile owner. On your own
  // profile that's a contradiction (you can't share with yourself), so hide it.
  const tabs = isOwnProfile ? ALL_TABS.filter(t => t.key !== 'mutuals') : ALL_TABS;
  return (
    <div className="flex gap-1 border-b border-white/10 pb-0">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black tracking-widest uppercase transition-colors rounded-t-lg ${
            activeTab === key
              ? 'bg-white/10 text-white border-b-2 border-[#FF3333]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          }`}
        >
          <Icon size={12} /> {label}
        </button>
      ))}
    </div>
  );
}