import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Trash2, User, Edit3, Settings, Search, ChevronRight, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

function getLogStyle(action) {
  if (/BAN|KICK/.test(action)) return { Icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' };
  if (/DELETE/.test(action))   return { Icon: Trash2,      color: 'text-orange-400', bg: 'bg-orange-400/10' };
  if (/ROLE|NICK|MEMBER/.test(action)) return { Icon: User, color: 'text-blue-400', bg: 'bg-blue-400/10' };
  if (/CHANNEL/.test(action))  return { Icon: Edit3,        color: 'text-green-400', bg: 'bg-green-400/10' };
  return                               { Icon: Settings,    color: 'text-zinc-400',  bg: 'bg-zinc-400/10' };
}

function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false);
  const { Icon, color, bg } = getLogStyle(log.action);
  const timeAgo = log.created_date ? formatDistanceToNow(new Date(log.created_date), { addSuffix: true }) : '';

  return (
    <motion.div
      layout
      onClick={() => setExpanded(p => !p)}
      className={`rounded-lg border cursor-pointer overflow-hidden transition-all ${expanded ? 'bg-zinc-900 border-white/20' : 'bg-zinc-900/50 border-white/5 hover:border-white/10'}`}
    >
      <div className="flex items-center gap-3 p-3">
        <span className="text-[10px] font-mono text-zinc-600 w-20 text-right shrink-0">{timeAgo}</span>
        <div className={`p-2 rounded-md shrink-0 ${bg} ${color}`}>
          <Icon size={13} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold ${log.category === 'admin' ? 'text-red-400' : log.category === 'mod' ? 'text-yellow-400' : 'text-zinc-300'}`}>
            {log.actor_name || log.actor_id}
          </span>
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{log.action.replace(/_/g, ' ')}</span>
          {log.target_name && (
            <span className="text-xs text-zinc-400 truncate">→ <span className="text-white font-mono">{log.target_name}</span></span>
          )}
        </div>
        <ChevronRight size={14} className={`text-zinc-600 shrink-0 transition-transform ${expanded ? 'rotate-90 text-white' : ''}`} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-3"
          >
            <div className="p-3 bg-black rounded border border-white/10 font-mono text-[10px] text-green-400 space-y-1">
              {log.details && <div>&gt; {log.details}</div>}
              {log.before  && <div>&gt; BEFORE: <span className="text-red-400">{log.before}</span></div>}
              {log.after   && <div>&gt; AFTER: <span className="text-green-300">{log.after}</span></div>}
              <div className="text-zinc-600">&gt; EVENT_ID: {log.id}</div>
              <div className="text-zinc-600">&gt; END_OF_LINE</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ServerAuditLog({ serverId }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', serverId],
    queryFn: () => entities.ServerAuditLog.filter({ server_id: serverId }, '-created_date', 100),
    enabled: !!serverId,
    refetchInterval: 10000
  });

  const filtered = logs.filter(log => {
    const matchFilter = filter === 'all' || log.category === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || (log.actor_name || '').toLowerCase().includes(q) || log.action.toLowerCase().includes(q) || (log.target_name || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-500" /> System Manifest
          </h3>
          <p className="text-[10px] font-mono text-zinc-600 mt-1">&gt; TRACE_PROTOCOL_ACTIVE — monitoring all vectors</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search action, user, target..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-red-500/50"
          />
        </div>
        <div className="flex bg-zinc-900 border border-white/10 p-1 rounded-lg gap-1">
          {[
            { key: 'all', label: 'ALL' },
            { key: 'admin', label: 'ADMIN', cls: 'text-red-400' },
            { key: 'mod', label: 'MOD', cls: 'text-yellow-400' },
            { key: 'member', label: 'MEMBER', cls: 'text-blue-400' },
          ].map(({ key, label, cls }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${filter === key ? 'bg-white/10 text-white' : `text-zinc-500 hover:text-white ${cls || ''}`}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Stream */}
      <ScrollArea className="h-[280px]">
        <div className="space-y-2 pr-2">
          {isLoading && (
            <div className="text-center py-10 text-zinc-600 font-mono text-xs">// LOADING MANIFEST...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-10 text-zinc-600 font-mono text-xs">// NO ANOMALIES DETECTED</div>
          )}
          {filtered.map(log => <LogEntry key={log.id} log={log} />)}
        </div>
      </ScrollArea>
    </div>
  );
}