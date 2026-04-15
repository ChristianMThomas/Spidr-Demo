import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Flag, Blocks, CheckCircle, Users, ShieldCheck, Loader2, Trash2 } from 'lucide-react';

export default function ModuleCard({ mod, isInstalled, onInstall, onUninstall, onReport, installing }) {
  const [showReportInput, setShowReportInput] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const handleReport = () => {
    if (!reportReason.trim()) return;
    onReport(mod.id, reportReason.trim());
    setReportReason('');
    setShowReportInput(false);
  };

  const typeColors = {
    static_text: 'text-green-400 bg-green-500/10',
    api_sync: 'text-blue-400 bg-blue-500/10',
    live_feed: 'text-purple-400 bg-purple-500/10',
    display_widget: 'text-amber-400 bg-amber-500/10',
  };

  return (
    <motion.div whileHover={{ y: -2 }} className="p-5 bg-[#111] border border-white/5 rounded-2xl hover:border-white/20 transition-all group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-transparent transition-colors" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black border border-white/10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
              {mod.icon_url ? (
                <img src={mod.icon_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Blocks className="text-blue-500" size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{mod.name}</h3>
              <div className="text-[10px] text-gray-500 font-mono">By @{mod.author_name || 'Unknown'}</div>
            </div>
          </div>
          <button onClick={() => setShowReportInput(!showReportInput)} className="text-gray-600 hover:text-red-500 transition-colors p-1 shrink-0" title="Report Module">
            <Flag size={14} />
          </button>
        </div>

        {mod.description && (
          <p className="text-[11px] text-gray-400 mb-3 line-clamp-2">{mod.description}</p>
        )}

        <div className="flex items-center gap-4 mb-4">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500 uppercase font-bold">Installs</span>
            <span className="text-xs text-white font-mono flex items-center gap-1"><Users size={10} /> {mod.install_count || 0}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500 uppercase font-bold">Status</span>
            <span className="text-xs text-green-400 font-mono flex items-center gap-1"><ShieldCheck size={10} /> Verified</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500 uppercase font-bold">Type</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${typeColors[mod.type] || typeColors.static_text}`}>{mod.type?.replace('_', ' ')?.toUpperCase()}</span>
          </div>
        </div>

        {showReportInput && (
          <div className="mb-3 flex gap-2">
            <input value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Reason for report..." className="flex-1 bg-black border border-red-500/30 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500" />
            <button onClick={handleReport} className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg font-bold hover:bg-red-500">Send</button>
          </div>
        )}

        {isInstalled ? (
          <div className="flex gap-2">
            <div className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20 flex items-center justify-center gap-2">
              <CheckCircle size={14} /> Installed
            </div>
            {onUninstall && (
              <button
                onClick={() => onUninstall(mod.id)}
                className="py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onInstall(mod.id)}
            disabled={installing}
            className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 bg-white/5 hover:bg-white text-gray-300 hover:text-black disabled:opacity-50"
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <><Download size={14} /> Install Module</>}
          </button>
        )}
      </div>
    </motion.div>
  );
}