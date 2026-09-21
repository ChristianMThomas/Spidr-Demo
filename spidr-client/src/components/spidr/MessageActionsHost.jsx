import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { messageActions } from '@/api/messageActions';
import ForwardMessageModal from './ForwardMessageModal';
import SavedMessagesModal from './SavedMessagesModal';
import { toast } from 'sonner';

/** One owner for global save/share actions, regardless of which chat is open. */
export default function MessageActionsHost({ currentUser }) {
  const [forwarding, setForwarding] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const saving = useRef(new Set());
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!currentUser?.id) return;
    const onAction = async event => {
      const { action, type, data } = event.detail || {};
      if (type !== 'message' || !['share', 'save-msg'].includes(action)) return;
      if (!data?.id || !['dm', 'group', 'server'].includes(data.scope)) {
        toast.error('Reopen this conversation to use this message action.');
        return;
      }
      if (action === 'share') { setForwarding(data); return; }
      const key = `${data.scope}:${data.id}`;
      if (saving.current.has(key)) return;
      saving.current.add(key);
      try {
        await messageActions.save(data);
        queryClient.invalidateQueries({ queryKey: ['saved-messages', currentUser.id] });
        toast.success('Message saved', { action: { label: 'View saved', onClick: () => setShowSaved(true) } });
      } catch (error) { toast.error(error?.message || 'Could not save this message.'); }
      finally { saving.current.delete(key); }
    };
    const openSaved = () => setShowSaved(true);
    window.addEventListener('spidr-menu-action', onAction);
    window.addEventListener('spidr-open-saved-messages', openSaved);
    return () => {
      window.removeEventListener('spidr-menu-action', onAction);
      window.removeEventListener('spidr-open-saved-messages', openSaved);
    };
  }, [currentUser?.id, queryClient]);
  return <>
    {forwarding && <ForwardMessageModal key={`${forwarding.scope}:${forwarding.id}`} message={forwarding} currentUser={currentUser} onClose={() => setForwarding(null)} />}
    {showSaved && <SavedMessagesModal currentUser={currentUser} onClose={() => setShowSaved(false)} />}
  </>;
}
