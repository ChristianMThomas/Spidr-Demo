import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { messageActions } from '@/api/messageActions';
import { toast } from 'sonner';

const attachmentUrl = attachment => {
  const raw = typeof attachment === 'string' ? attachment : attachment?.url;
  try { const url = new URL(raw); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};

export default function SavedMessagesModal({ currentUser, onClose }) {
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState(null);
  const saved = useInfiniteQuery({
    queryKey: ['saved-messages', currentUser?.id],
    queryFn: ({ pageParam }) => messageActions.saved(pageParam),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.next_cursor || undefined,
    enabled: !!currentUser?.id,
  });
  const remove = useMutation({
    mutationFn: messageActions.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-messages', currentUser?.id] }),
    onError: error => toast.error(error?.message || 'Could not remove this saved message.'),
    onSettled: () => setRemovingId(null),
  });
  const messages = saved.data?.pages.flatMap(page => page.items) || [];
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl border-white/10 bg-[#0b0b10] text-white rounded-2xl" overlayClassName="z-[200]" style={{ zIndex: 201 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bookmark size={19} className="text-red-400" />Saved Messages</DialogTitle>
          <DialogDescription className="text-white/50">Your private copies from DMs, groups, and servers. Available from Saved Messages in the sidebar.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] min-h-40 overflow-y-auto space-y-3 pr-1">
          {saved.isLoading ? <p className="p-4 flex items-center gap-2 text-white/50 text-sm"><Loader2 size={16} className="animate-spin" /> Loading saved messages…</p> :
            saved.isError ? <p role="alert" className="text-red-300 text-sm">Could not load saved messages. <button className="underline" onClick={() => saved.refetch()}>Try again</button></p> :
            messages.length === 0 ? <div className="py-10 text-center"><Bookmark className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/65">No saved messages yet</p><p className="text-xs text-white/40 mt-2">Right-click a message and choose Save Message.</p></div> :
            messages.map(message => (
              <article key={message.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div><p className="text-sm font-medium">{message.sender_name || 'User'}</p><p className="text-xs text-white/40 mt-0.5">{message.context_name || 'Conversation'} · Saved {new Date(message.createdAt).toLocaleDateString()}</p></div>
                  <button aria-label={`Remove saved message from ${message.sender_name || 'User'}`} title="Remove from Saved Messages" disabled={remove.isPending}
                    onClick={() => { setRemovingId(message.id); remove.mutate(message.id); }} className="p-2 rounded-lg text-white/35 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40">
                    {removingId === message.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
                <p className="text-sm text-white/85 whitespace-pre-wrap break-words">{message.content}</p>
                {!!message.attachments?.length && <div className="flex flex-wrap gap-2 mt-3">{message.attachments.map((attachment, index) => {
                  const url = attachmentUrl(attachment);
                  return url ? <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-300 bg-red-500/10 rounded-lg px-2 py-1.5"><ExternalLink size={12} />Attachment {index + 1}</a> : null;
                })}</div>}
              </article>
            ))}
          {saved.hasNextPage && <button onClick={() => saved.fetchNextPage()} disabled={saved.isFetchingNextPage} className="w-full p-3 text-sm text-white/60 rounded-xl hover:bg-white/5">{saved.isFetchingNextPage ? 'Loading…' : 'Load more'}</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
