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
  // When pinned, the overlay stays active across navigation and ignores
  // deactivate events. Persisted so a pin survives a full page reload.
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem('spidr_ghost_pinned') === 'true'; } catch { return false; }
  });

  // If the overlay was pinned in a previous session, show it on mount.
  useEffect(() => {
    if (pinned) setActive(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onActivate = (e) => {
      setActive(true);
      if (e.detail?.conversationName) setConversationName(e.detail.conversationName);
    };
    // Honor deactivate only when NOT pinned — pinning keeps the overlay alive
    // even as the user navigates away from the chat that opened it.
    const onDeactivate = () => { if (!pinned) setActive(false); };
    const onMessage = (e) => {
      const msg = e.detail;
      if (!msg?.id) return;
      setMessages((prev) => {
        const next = prev.filter(m => m.id !== msg.id);
        next.push(msg);
        if (next.length > MAX_MESSAGES) next.shift();
        return next;
      });
    };
    const onTogglePin = () => {
      setPinned((p) => {
        const next = !p;
        try { localStorage.setItem('spidr_ghost_pinned', String(next)); } catch {}
        if (next) setActive(true);
        return next;
      });
    };

    window.addEventListener('spidr-ghost-activate', onActivate);
    window.addEventListener('spidr-ghost-deactivate', onDeactivate);
    window.addEventListener('spidr-ghost-message', onMessage);
    window.addEventListener('spidr-ghost-toggle-pin', onTogglePin);
    return () => {
      window.removeEventListener('spidr-ghost-activate', onActivate);
      window.removeEventListener('spidr-ghost-deactivate', onDeactivate);
      window.removeEventListener('spidr-ghost-message', onMessage);
      window.removeEventListener('spidr-ghost-toggle-pin', onTogglePin);
    };
  }, [pinned]);

  if (!active) return null;

  return (
    <GhostOverlay
      messages={messages}
      active={active}
      pinned={pinned}
      conversationName={conversationName}
      onTogglePin={() => window.dispatchEvent(new Event('spidr-ghost-toggle-pin'))}
      onClose={() => { setActive(false); }}
    />
  );
}
