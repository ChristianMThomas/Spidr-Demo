import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, entities, getSocket } from '@/api/apiClient';

/**
 * ProtocolOverlay — the "Spidr Protocol" out-of-app text HUD.
 *
 * Loaded inside the Electron Ghost Window (route: /overlay/protocol?serverId=
 * &channelId=&groupId=). The window itself is frameless + transparent +
 * always-on-top + click-through; this page renders ONLY the text (no panel
 * background) so it floats over a game.
 *
 *   • Messages render at 100% then fade to 0% after 6s of inactivity.
 *   • A tiny 10px glowing red anchor node (bottom-left) never fades and is the
 *     drag handle (the window's -webkit-app-region drag zone).
 *   • The injection terminal (input bar) is invisible until the global hotkey
 *     (Shift+Enter, handled in Electron) flips interactive mode; we listen via
 *     electronAPI.onProtocolInteractive. Outside Electron a local hotkey is the
 *     fallback so the route is still testable in a browser.
 *
 * Profile pictures and customized usernames are preserved: each row shows the
 * sender's avatar and their display name styled in crimson/purple.
 */

const FADE_MS = 6000;
const AUTHOR_COLORS = ['#ef4444', '#a855f7']; // crimson, toxic purple

function colorForAuthor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length];
}

export default function ProtocolOverlay() {
  const [params] = useSearchParams();
  const serverId  = params.get('serverId')  || undefined;
  const channelId = params.get('channelId') || undefined;
  const groupId   = params.get('groupId')   || undefined;

  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [interactive, setInteractive] = useState(false);
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState(true); // false → faded (no recent activity)
  const fadeTimer = useRef(null);
  const inputRef = useRef(null);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Resolve the current user.
  useEffect(() => {
    let alive = true;
    auth.me?.().then(u => { if (alive) setCurrentUser(u); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Bump the activity timer: show now, fade after 6s of silence.
  const bumpActivity = useCallback(() => {
    setActive(true);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setActive(false), FADE_MS);
  }, []);

  // Load recent messages + subscribe to live updates.
  useEffect(() => {
    if (!channelId && !groupId) return;
    let alive = true;
    const filter = groupId ? { group_id: groupId } : { server_id: serverId, channel_id: channelId };

    const load = () => entities.Message.filter(filter, '-created_date', 30)
      .then(rows => {
        if (!alive) return;
        // Oldest→newest for natural reading order; keep the last 8 on screen.
        const ordered = [...rows].reverse().slice(-8);
        setMessages(ordered);
        bumpActivity();
      })
      .catch(() => {});
    load();

    const socket = getSocket();
    if (channelId) socket?.emit?.('join:channel', { serverId, channelId });
    const onNew = (msg) => {
      // Only react to messages for the room this overlay is bound to.
      if (groupId) { if (msg?.group_id !== groupId) return; }
      else if (msg?.channel_id && msg.channel_id !== channelId) return;
      load();
    };
    socket?.on?.('message:new', onNew);
    socket?.on?.('message:updated', onNew);

    return () => {
      alive = false;
      socket?.off?.('message:new', onNew);
      socket?.off?.('message:updated', onNew);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [serverId, channelId, groupId, bumpActivity]);

  // Interactive mode: from Electron's global hotkey, or a local Shift+Enter
  // fallback in the browser. When it turns on, focus the input.
  useEffect(() => {
    if (isElectron && window.electronAPI?.onProtocolInteractive) {
      const off = window.electronAPI.onProtocolInteractive((on) => {
        setInteractive(on);
        if (on) { setActive(true); setTimeout(() => inputRef.current?.focus(), 30); }
      });
      return off;
    }
    // Browser fallback hotkey.
    const onKey = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        setInteractive(v => {
          const next = !v;
          if (next) { setActive(true); setTimeout(() => inputRef.current?.focus(), 30); }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isElectron]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !currentUser) return;
    setDraft('');
    const payload = {
      content: text,
      user_name: currentUser.full_name || currentUser.username,
      user_avatar: currentUser.avatar_url || '',
      author_id: currentUser.id,
      author_name: currentUser.full_name || currentUser.username,
      author_avatar: currentUser.avatar_url || '',
      ...(groupId ? { group_id: groupId } : { server_id: serverId, channel_id: channelId }),
    };
    try { await entities.Message.create(payload); } catch {}
    bumpActivity();
  };

  // Leaving the input hands mouse/keyboard control back to the game.
  const exitInteractive = () => {
    setInteractive(false);
    if (isElectron) window.electronAPI?.setProtocolInteractive?.(false);
  };

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: 'transparent' }}>
      {/* Message stream — fades as a whole after 6s of silence. */}
      <motion.div
        className="absolute left-3 right-3 bottom-12 flex flex-col gap-1 justify-end"
        animate={{ opacity: active || interactive ? 1 : 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ pointerEvents: 'none' }}
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const name = m.author_name || m.user_name || 'Spider';
            const avatar = m.author_avatar || m.user_avatar;
            const color = colorForAuthor(m.author_id || m.user_id || name);
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 font-mono text-sm leading-snug"
                style={{ textShadow: '0 0 4px #000, 0 0 8px #000' }}
              >
                {/* Profile picture — preserved */}
                {avatar
                  ? <img src={avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0"
                      style={{ boxShadow: '0 0 4px #000' }} />
                  : <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] text-white"
                      style={{ background: color, boxShadow: '0 0 4px #000' }}>{name.charAt(0).toUpperCase()}</span>}
                {/* Customized username (crimson/purple) + message body */}
                <span className="shrink-0 font-bold" style={{ color }}>&lt;{name}&gt;</span>
                <span className="text-white"> : {m.content}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Injection terminal — invisible until interactive (hotkey). */}
      <AnimatePresence>
        {interactive && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute left-3 right-3 bottom-3"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-center bg-black/80 backdrop-blur-md border-l-2 border-red-500 px-4 py-2 rounded-r-md">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  if (e.key === 'Escape') { e.preventDefault(); exitInteractive(); }
                }}
                onBlur={exitInteractive}
                placeholder="message..."
                className="flex-1 bg-transparent outline-none text-white font-mono text-sm placeholder-zinc-500"
                style={{ caretColor: '#ef4444' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Anchor node — 10px glowing red node, never fades, draggable handle. */}
      <div
        className="absolute bottom-3 left-3 flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag', pointerEvents: 'auto', cursor: 'grab' }}
        title="Spidr Protocol — drag to reposition"
      >
        <motion.span
          className="rounded-full"
          style={{ width: 10, height: 10, background: '#ef4444', boxShadow: '0 0 8px #ef4444, 0 0 14px #ef4444' }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}
