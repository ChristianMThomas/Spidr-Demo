import React from 'react';
import { motion } from 'framer-motion';
import { Link2, Globe } from 'lucide-react';

const platformConfig = {
  twitter: { label: 'Twitter / X', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' },
  youtube: { label: 'YouTube', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  twitch: { label: 'Twitch', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
  github: { label: 'GitHub', color: 'text-gray-300', bg: 'bg-gray-300/10', border: 'border-gray-300/30' },
  discord: { label: 'Discord', color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/30' },
};

export default function LinksTab({ socialLinks, website }) {
  const links = socialLinks || {};
  const entries = Object.entries(links).filter(([, val]) => val);
  const hasAnything = entries.length > 0 || website;

  if (!hasAnything) {
    return (
      <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-6 text-center">
        <Link2 size={24} className="text-gray-700 mb-2" />
        <p className="text-xs text-gray-600">No external connections linked</p>
      </motion.div>
    );
  }

  return (
    <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
      {website && (
        <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between p-2.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-emerald-400" />
            <div>
              <div className="text-[10px] font-bold uppercase text-emerald-400">Website</div>
              <div className="text-xs text-white truncate max-w-[200px]">{website}</div>
            </div>
          </div>
          <Link2 size={12} className="text-gray-500" />
        </a>
      )}
      {entries.map(([platform, value]) => {
        const cfg = platformConfig[platform] || { label: platform, color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/30' };
        return (
          <div key={platform} className={`flex items-center justify-between p-2.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${cfg.color}`}>
                {platform.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className={`text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</div>
                <div className="text-xs text-white truncate max-w-[200px]">{value}</div>
              </div>
            </div>
            <Link2 size={12} className="text-gray-500" />
          </div>
        );
      })}
    </motion.div>
  );
}