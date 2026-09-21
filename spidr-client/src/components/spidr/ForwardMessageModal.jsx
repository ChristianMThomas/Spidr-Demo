import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Send, Users, User, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { messageActions } from '@/api/messageActions';
import { toast } from 'sonner';

export default function ForwardMessageModal({ message, currentUser, onClose }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const sendingRef = useRef(false);
  const queryClient = useQueryClient();
  const destinations = useQuery({
    queryKey: ['forward-destinations', currentUser?.id],
    queryFn: messageActions.destinations,
    enabled: !!message && !!currentUser?.id,
    staleTime: 30000,
  });
  const matches = (destinations.data || []).filter(destination => destination.name.toLowerCase().includes(search.trim().toLowerCase()));

  const forward = async () => {
    if (!selected || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      await messageActions.forward(message, selected);
      for (const key of ['dm-messages', 'all-dms', 'group-messages', 'unread-dms', 'sidebar-dms']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(`Forwarded to ${selected.name}`);
      onClose();
    } catch (failure) {
      setError(failure?.message || 'Could not forward this message. Please try again.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <Dialog open={!!message} onOpenChange={open => { if (!open && !sendingRef.current) onClose(); }}>
      <DialogContent className="max-w-lg border-white/10 bg-[#0b0b10] text-white rounded-2xl" overlayClassName="z-[200]" style={{ zIndex: 201 }}>
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription className="text-white/50">Choose a person or group, then send a copy with its attachments.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-white/45 mb-1">{message?.sender_name || message?.user_name || message?.author_name || 'Message'}</p>
          <p className="text-sm whitespace-pre-wrap line-clamp-3">{message?.content || 'Attachment'}</p>
          {!!message?.attachments?.length && <p className="text-xs text-white/40 mt-2">{message.attachments.length} attachment{message.attachments.length === 1 ? '' : 's'}</p>}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <Search size={16} className="text-white/40" />
          <input aria-label="Search recipients" autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people and groups" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="max-h-[36vh] min-h-24 overflow-y-auto space-y-1" role="radiogroup" aria-label="Forward recipient">
          {destinations.isLoading ? <p className="p-4 text-sm text-white/50 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading conversations…</p> :
            destinations.isError ? <div className="p-4 text-sm text-red-300">Could not load conversations. <button className="underline" onClick={() => destinations.refetch()}>Try again</button></div> :
            matches.length === 0 ? <p className="p-4 text-sm text-white/45">{search ? 'No matching conversations.' : 'Add a friend or join a group to forward messages.'}</p> :
            matches.map(destination => {
              const chosen = selected?.type === destination.type && selected?.id === destination.id;
              return (
                <button key={`${destination.type}:${destination.id}`} role="radio" aria-checked={chosen} onClick={() => setSelected(destination)} disabled={sending}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl text-left transition-colors ${chosen ? 'bg-red-500/15 ring-1 ring-red-400/50' : 'hover:bg-white/5'}`}>
                  {destination.avatar ? <img src={destination.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> :
                    <span className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">{destination.type === 'group' ? <Users size={17} /> : <User size={17} />}</span>}
                  <span className="min-w-0 flex-1"><span className="block text-sm truncate">{destination.name}</span><span className="block text-xs text-white/40">{destination.type === 'group' ? 'Group chat' : 'Direct message'}</span></span>
                  <span aria-hidden className={`h-4 w-4 rounded-full border ${chosen ? 'border-red-400 bg-red-400' : 'border-white/20'}`} />
                </button>
              );
            })}
        </div>
        {!!error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button onClick={onClose} disabled={sending} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:bg-white/5 disabled:opacity-40">Cancel</button>
          <button onClick={forward} disabled={!selected || sending} className="px-4 py-2 rounded-xl text-sm bg-red-600 hover:bg-red-500 disabled:opacity-40 flex items-center gap-2">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{sending ? 'Sending…' : 'Forward'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
