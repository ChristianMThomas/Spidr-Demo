import React from 'react';
import { motion } from 'framer-motion';
import { Send, Play, Trash2, CheckCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webMessages, getSocket } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * WebSignalsInbox — THE WEB's own DM lane ("Sling to DM").
 *
 * Deliberately SEPARATE from the app's real DMs: posts slung from the feed
 * land here as "signals" instead of flooding actual conversations. Each
 * signal is a clip card + optional note; tapping it jumps the feed to that
 * clip, tapping the sender opens their WEB profile.
 */
export default function WebSignalsInbox({ currentUser, onOpenClip, onOpenProfile }) {
  const queryClient = useQueryClient();

  const { data: inbox = [], isLoading } = useQuery({
    queryKey: ['web-signals', currentUser?.id],
    queryFn: () => webMessages.inbox(),
    enabled: !!currentUser?.id,
    refetchInterval: 45000,
  });

  // Live badge/list refresh when someone slings us a post.
  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onSignal = (data) => {
      if (data?.recipient_id === currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: ['web-signals'] });
      }
    };
    socket.on('web:signal-received', onSignal);
    return () => socket.off('web:signal-received', onSignal);
  }, [currentUser?.id, queryClient]);

  const markRead = useMutation({
    mutationFn: (id) => webMessages.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['web-signals'] }),
  });
  const remove = useMutation({
    mutationFn: (id) => webMessages.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['web-signals'] }); toast('Signal dismissed'); },
  });

  if (isLoading) {
    return <div className="text-zinc-600 text-xs font-mono uppercase tracking-widest">Scanning frequencies…</div>;
  }

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Send size={16} className="text-[#FF3333]" />
          <h2 className="font-black italic tracking-tighter text-white text-lg">INCOMING SIGNALS</h2>
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest ml-2">
            posts slung to you · separate from DMs
          </span>
        </div>

        {inbox.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[#FF3333]/5 border border-[#FF3333]/20 flex items-center justify-center">
              <Send size={20} className="text-[#FF3333]/60" />
            </div>
            <p className="text-zinc-400 text-sm font-bold">No signals yet</p>
            <p className="text-zinc-600 text-xs max-w-[280px]">
              When someone slings a strand to you from THE WEB, it lands here — not in your DMs.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {inbox.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  m.read ? 'bg-white/[0.02] border-white/5' : 'bg-[#FF3333]/[0.05] border-[#FF3333]/25'
                }`}
              >
                {/* Sender */}
                <button
                  type="button"
                  onClick={() => onOpenProfile?.({ id: m.sender_id, full_name: m.sender_name, avatar_url: m.sender_avatar })}
                  className="shrink-0"
                  title={`Open ${m.sender_name || 'sender'}'s web`}
                >
                  <img
                    src={m.sender_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.sender_id}`}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
                  />
                </button>

                {/* Clip preview + note */}
                <button
                  type="button"
                  onClick={() => { if (!m.read) markRead.mutate(m.id); onOpenClip?.(m.clip_id); }}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left group"
                >
                  <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                    {m.clip_thumb ? (
                      <img src={m.clip_thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Play size={14} className="text-zinc-700" /></div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <Play size={14} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-bold truncate">
                      <span className="text-[#FF3333]">{m.sender_name || 'A node'}</span> slung a strand
                    </p>
                    {m.clip_title && <p className="text-[11px] text-zinc-400 truncate">{m.clip_title}</p>}
                    {m.note && <p className="text-[11px] text-zinc-500 italic truncate">“{m.note}”</p>}
                  </div>
                </button>

                {/* Meta + actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {m.read && <CheckCheck size={13} className="text-zinc-600" title="Seen" />}
                  <button
                    type="button"
                    onClick={() => remove.mutate(m.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors"
                    title="Dismiss"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
