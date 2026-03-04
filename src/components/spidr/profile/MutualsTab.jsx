import React from 'react';
import { motion } from 'framer-motion';

export default function MutualsTab({ mutualServers, mutualFriends }) {
  return (
    <motion.div key="mutuals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      {/* Shared Servers */}
      <div>
        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2 tracking-widest">Shared Nodes (Servers)</div>
        {mutualServers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {mutualServers.map(server => (
              <div key={server.id} className="flex items-center gap-2 p-1.5 pr-3 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                {server.icon_url ? (
                  <img src={server.icon_url} className="w-7 h-7 rounded-[8px] object-cover bg-black" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-[8px] bg-[#FF3333]/20 border border-[#FF3333]/40 flex items-center justify-center text-[#FF3333] text-[10px] font-black">
                    {server.name?.charAt(0)}
                  </div>
                )}
                <span className="text-xs text-white font-medium truncate max-w-[100px]">{server.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-600 font-mono">No shared servers</div>
        )}
      </div>

      {/* Mutual Friends */}
      <div>
        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2 tracking-widest">Mutual Connections</div>
        {mutualFriends.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {mutualFriends.map(f => (
              <div key={f.id} className="flex items-center gap-2 p-1.5 pr-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                {f.friend_avatar ? (
                  <img src={f.friend_avatar} className="w-6 h-6 rounded-full object-cover bg-black" alt="" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                    {f.friend_name?.charAt(0) || '?'}
                  </div>
                )}
                <span className="text-xs text-white">{f.friend_name || 'Unknown'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-600 font-mono">No mutual friends</div>
        )}
      </div>
    </motion.div>
  );
}