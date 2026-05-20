import React, { useEffect, useState } from 'react';
import GhostOverlay from './GhostOverlay';

/**
 * GlobalGhostOverlay — wraps GhostOverlay so it can be mounted once at the
 * SpidrShell level and stay alive across route changes.
 *
 * Listens for two events:
 *   • `spidr-ghost-activate` { conversationName? } — turn on
 *   • `spidr-ghost-deactivate` — turn off
 *   • `spidr-ghost-message` { id, sender_name, sender_avatar, content } —
 *     append a message to the floating feed
 *
 * Chat panels (ServersPanel, KineticChat, DirectMessages) dispatch these
 * events instead of (or in addition to) mounting their own GhostOverlay.
 *
 * Keeps a rolling window of the most recent N messages so the overlay
 * doesn't grow unbounded.
 */
const MAX_MESSAGES = 30;

export default function GlobalGhostOverlay() {
  const [active, setActive] = useState(false);
  const [conversationName, setConversationName] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const onActivate = (e) => {
      setActive(true);
      if (e.detail?.conversationName) setConversationName(e.detail.conversationName);
    };
    const onDeactivate = () => setActive(false);
    const onMessage = (e) => {
      const msg = e.detail;
      if (!msg?.id) return;
      setMessages((prev) => {
        // De-dupe by id, then append, then cap at MAX_MESSAGES
        const next = prev.filter(m => m.id !== msg.id);
        next.push(msg);
        if (next.length > MAX_MESSAGES) next.shift();
        return next;
      });
    };

    window.addEventListener('spidr-ghost-activate', onActivate);
    window.addEventListener('spidr-ghost-deactivate', onDeactivate);
    window.addEventListener('spidr-ghost-message', onMessage);
    return () => {
      window.removeEventListener('spidr-ghost-activate', onActivate);
      window.removeEventListener('spidr-ghost-deactivate', onDeactivate);
      window.removeEventListener('spidr-ghost-message', onMessage);
    };
  }, []);

  if (!active) return null;

  return (
    <GhostOverlay
      messages={messages}
      active={active}
      conversationName={conversationName}
      onClose={() => setActive(false)}
    />
  );
}
