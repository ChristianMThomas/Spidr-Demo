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
  const serverId       = params.get('serverId')       || undefined;
  const channelId      = params.get('channelId')      || undefined;
  const groupId        = params.get('groupId')        || undefined;
  const conversationId = params.get('conversationId') || undefined; // DMs

  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [interactive, setInteractive] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendStatus, setSendStatus] = useState(null); // { kind: 'ok'|'err', text }
  const [active, setActive] = useState(true); // false → faded (no recent activity)
  // Live profile cache: sender_id -> { avatar_url, full_name, fetchedAt }. Beats
  // the stale snapshot stored on each message at send-time, so pfp/name swaps
  // propagate to old rows on next message arrival.
  const [profiles, setProfiles] = useState({});
  const profilesRef = useRef({});
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  const fadeTimer = useRef(null);
  const inputRef = useRef(null);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Ghost-protocol transparency. The Electron overlay window is created with
  // transparent:true + backgroundColor:'#00000000', but the app ships no .dark
  // class on <html>, so index.css's :root resolves --background to white and
  // `body { @apply bg-background }` paints an opaque WHITE layer behind this
  // transparent overlay div — which is exactly the "white background" QA saw.
  // Force html/body/#root transparent while the overlay is mounted, and restore
  // on unmount so the main window (which reuses the same index.html) is unaffected.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const prev = {
      htmlBg: html.style.background, htmlColor: html.style.backgroundColor,
      bodyBg: body.style.background, bodyColor: body.style.backgroundColor,
      rootBg: root?.style.background, rootColor: root?.style.backgroundColor,
    };
    const clear = (el) => { if (!el) return; el.style.background = 'transparent'; el.style.backgroundColor = 'transparent'; };
    clear(html); clear(body); clear(root);
    html.classList.add('spidr-ghost-overlay');
    return () => {
      html.style.background = prev.htmlBg; html.style.backgroundColor = prev.htmlColor;
      body.style.background = prev.bodyBg; body.style.backgroundColor = prev.bodyColor;
      if (root) { root.style.background = prev.rootBg; root.style.backgroundColor = prev.rootColor; }
      html.classList.remove('spidr-ghost-overlay');
    };
  }, []);

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

  // Load recent messages + subscribe to live updates. The overlay can be
  // bound to one of three room types — server channel, group chat, or DM —
  // and uses the matching entity + socket event for each.
  useEffect(() => {
    if (!channelId && !groupId && !conversationId) return;
    let alive = true;

    const isDM = !!conversationId;
    const Entity = isDM ? entities.DirectMessage : entities.Message;
    const filter = isDM
      ? { conversation_id: conversationId }
      : groupId
        ? { group_id: groupId }
        : { server_id: serverId, channel_id: channelId };

    // PROFILE_TTL: refetch a sender's profile if we haven't pulled it within
    // this many ms — keeps avatars current without hammering the API every
    // socket event. New message from same user → refresh, so live pfp swaps
    // surface the next time they speak.
    const PROFILE_TTL = 30_000;
    const refreshProfiles = (rows) => {
      const ids = Array.from(new Set(
        rows.map(r => r.author_id || r.user_id || r.sender_id).filter(Boolean)
      ));
      const now = Date.now();
      const stale = ids.filter(id => {
        const cached = profilesRef.current[id];
        return !cached || (now - cached.fetchedAt) > PROFILE_TTL;
      });
      stale.forEach(id => {
        entities.UserProfile.filter({ user_id: id })
          .then(arr => {
            const p = arr?.[0];
            if (!alive || !p) return;
            setProfiles(prev => ({
              ...prev,
              [id]: { avatar_url: p.avatar_url || '', full_name: p.full_name || '', fetchedAt: Date.now() },
            }));
          })
          .catch(() => {});
      });
    };

    const load = () => Entity.filter(filter, '-created_date', 30)
      .then(rows => {
        if (!alive) return;
        const ordered = [...rows].reverse().slice(-8);
        setMessages(ordered);
        refreshProfiles(ordered);
        bumpActivity();
      })
      .catch(() => {});
    load();

    const socket = getSocket();
    if (channelId)      socket?.emit?.('join:channel', { serverId, channelId });
    if (groupId)        socket?.emit?.('join:group',   { groupId });
    if (conversationId) socket?.emit?.('join:dm',      { conversationId });

    // Every live message bumps activity FIRST (instant unfade) then triggers
    // a refetch — the user sees the overlay light up the moment the event
    // lands, instead of waiting for the HTTP round-trip.
    const onChannelMsg = (msg) => {
      if (msg?.channel_id && msg.channel_id !== channelId) return;
      bumpActivity();
      load();
    };
    const onGroupMsg = (msg) => {
      if (msg?.group_id && msg.group_id !== groupId) return;
      bumpActivity();
      load();
    };
    const onDmMsg = () => {
      bumpActivity();
      load();
    };

    if (conversationId) {
      socket?.on?.('dm:new', onDmMsg);
    } else if (groupId) {
      socket?.on?.('group:message', onGroupMsg);
    } else if (channelId) {
      socket?.on?.('message:new',     onChannelMsg);
      socket?.on?.('message:updated', onChannelMsg);
    }

    return () => {
      alive = false;
      socket?.off?.('message:new',     onChannelMsg);
      socket?.off?.('message:updated', onChannelMsg);
      socket?.off?.('group:message',   onGroupMsg);
      socket?.off?.('dm:new',          onDmMsg);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [serverId, channelId, groupId, conversationId, bumpActivity]);

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
    if (!text) return;
    if (!currentUser) {
      setSendStatus({ kind: 'err', text: 'not signed in' });
      return;
    }
    if (!conversationId && !groupId && !channelId) {
      setSendStatus({ kind: 'err', text: 'no room bound' });
      return;
    }
    setDraft('');
    const displayName = currentUser.full_name || currentUser.username;
    const avatar = currentUser.avatar_url || '';
    try {
      if (conversationId) {
        // conversation_id shape: "<uidA>-<uidB>" (both user IDs, sorted,
        // hyphen-joined — matches [a, b].sort().join('-') used everywhere
        // else in the app: FriendsPanel, HolographicProfile, ShareWeb,
        // SeedFriends). Previously this code split on '_' and sliced off
        // a nonexistent 'dm_' prefix, which produced an empty parts array
        // and undefined receiverId → DirectMessage validation failed on
        // the required receiver_id field.
        const parts = String(conversationId).split('-').filter(Boolean);
        const receiverId = parts.find(p => String(p) !== String(currentUser.id));
        if (!receiverId) {
          // Defensive: if the format ever changes we want a clear error
          // instead of a raw Mongoose validation dump.
          setSendStatus({ kind: 'err', text: 'cannot resolve recipient' });
          setDraft(text);
          bumpActivity();
          return;
        }
        await entities.DirectMessage.create({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          receiver_id: receiverId,
          recipient_id: receiverId,
          sender_name: displayName,
          sender_avatar: avatar,
          content: text,
        });
      } else if (groupId) {
        await entities.GroupChatMessage.create({
          group_id: groupId,
          user_id: currentUser.id,
          user_name: displayName,
          user_avatar: avatar,
          sender_id: currentUser.id,
          sender_name: displayName,
          sender_avatar: avatar,
          content: text,
        });
      } else if (channelId) {
        // Server channels: user_id/author_id are stamped from the JWT server-side.
        await entities.Message.create({
          server_id: serverId,
          channel_id: channelId,
          content: text,
          user_name: displayName,
          author_name: displayName,
          author_avatar: avatar,
        });
      }
      setSendStatus({ kind: 'ok', text: 'sent' });
    } catch (err) {
      const msg = err?.data?.error || err?.message || 'send failed';
      console.warn('Protocol send failed:', msg, err);
      setSendStatus({ kind: 'err', text: msg });
      setDraft(text); // restore the draft so the user doesn't lose their message
    }
    bumpActivity();
  };

  // Auto-clear the status pill 2.5s after it appears.
  useEffect(() => {
    if (!sendStatus) return;
    const t = setTimeout(() => setSendStatus(null), 2500);
    return () => clearTimeout(t);
  }, [sendStatus]);

  // Leaving the input hands mouse/keyboard control back to the game.
  const exitInteractive = () => {
    setInteractive(false);
    if (isElectron) window.electronAPI?.setProtocolInteractive?.(false);
  };

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: 'transparent' }}>
      {/* Top drag rail — invisible (yet draggable) when ambient so it never
          gets in the way; reveals a thin red glow + ⋮⋮ grip the moment the
          user enters interactive mode, so they have an obvious thing to grab
          and pin the overlay wherever they want on their desktop. The whole
          rail is a single -webkit-app-region: drag zone, so the user has the
          full width of the window as a drag target. */}
      <div
        className="absolute top-0 left-0 right-0 h-7 flex items-center justify-center"
        style={{
          WebkitAppRegion: 'drag',
          pointerEvents: 'auto',
          cursor: interactive ? 'grab' : 'default',
          transition: 'opacity 200ms ease',
          opacity: interactive ? 1 : 0,
        }}
        title="Spidr Protocol — drag to pin anywhere"
      >
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-b-md"
          style={{
            background: 'linear-gradient(180deg, rgba(239,68,68,0.18) 0%, rgba(0,0,0,0) 100%)',
            borderTop: '1px solid rgba(239,68,68,0.6)',
            boxShadow: '0 0 12px rgba(239,68,68,0.35)',
          }}
        >
          <span
            className="font-mono text-[10px] tracking-[0.2em] uppercase"
            style={{ color: '#ef4444', textShadow: '0 0 6px rgba(239,68,68,0.6)' }}
          >
            ⋮⋮  Spidr Protocol  ⋮⋮
          </span>
        </div>
      </div>

      {/* Message stream — fades as a whole after 6s of silence. */}
      <motion.div
        className="absolute left-3 right-3 bottom-12 flex flex-col gap-2.5 justify-end"
        animate={{ opacity: active || interactive ? 1 : 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ pointerEvents: 'none' }}
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const senderId = m.author_id || m.user_id || m.sender_id;
            const live = senderId ? profiles[senderId] : null;
            // Live cache wins over the stamped snapshot so pfp/name swaps
            // propagate to old messages too — never an old pfp.
            const name = live?.full_name || m.author_name || m.user_name || m.sender_name || 'Spider';
            const avatar = live?.avatar_url || m.author_avatar || m.user_avatar || m.sender_avatar;
            const color = colorForAuthor(senderId || name);
            const shadow = '0 0 3px #000, 0 0 6px #000, 0 0 10px rgba(0,0,0,0.9)';
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 font-mono text-sm leading-snug"
              >
                {/* Profile picture — preserved */}
                {avatar
                  ? <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.9)' }} />
                  : <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                      style={{ background: color, boxShadow: '0 0 0 1px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.9)' }}>
                      {name.charAt(0).toUpperCase()}
                    </span>}
                <div className="flex flex-col min-w-0 gap-0.5">
                  {/* Sender — crimson/purple, uppercase tag */}
                  <span
                    className="font-bold text-[11px] uppercase tracking-[0.18em] leading-none"
                    style={{ color, textShadow: shadow }}
                  >
                    {name}
                  </span>
                  {/* Message body */}
                  <span
                    className="text-white break-words"
                    style={{ textShadow: shadow }}
                  >
                    {m.content}
                  </span>
                </div>
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
                placeholder="message... (Esc to hide)"
                className="flex-1 bg-transparent outline-none text-white font-mono text-sm placeholder-zinc-500"
                style={{ caretColor: '#ef4444' }}
              />
              {sendStatus && (
                <span
                  className="ml-2 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                  style={
                    sendStatus.kind === 'ok'
                      ? { color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)' }
                      : { color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.12)' }
                  }
                  title={sendStatus.text}
                >
                  {sendStatus.kind === 'ok' ? '✓' : '⚠'} {sendStatus.text.slice(0, 40)}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Anchor node — 10px glowing red node, never fades. Acts as a manual
          opener: hover briefly disables window-wide click-through so the dot
          can receive the click; clicking flips full interactive mode on (chat
          unfades + input bar slides up). Mouseleave restores click-through so
          the game underneath gets its input back. The hit target is enlarged
          (24px square) around the 10px visible dot for easier clicking.
          NOTE: WebkitAppRegion is intentionally NOT set here — the hover trick
          can't coexist with a drag region. Drag the overlay from the top rail
          (appears when interactive). */}
      <button
        type="button"
        onMouseEnter={() => { if (!interactive) window.electronAPI?.setProtocolClickthrough?.(false); }}
        onMouseLeave={() => { if (!interactive) window.electronAPI?.setProtocolClickthrough?.(true); }}
        onClick={(e) => {
          e.preventDefault();
          setActive(true);
          setInteractive(true);
          if (isElectron) window.electronAPI?.setProtocolInteractive?.(true);
          setTimeout(() => inputRef.current?.focus(), 30);
        }}
        className="absolute bottom-3 left-3 flex items-center justify-center bg-transparent border-0 p-0 m-0"
        style={{ width: 24, height: 24, pointerEvents: 'auto', cursor: 'pointer' }}
        title="Open Spidr Protocol chat"
      >
        <motion.span
          className="rounded-full pointer-events-none"
          style={{ width: 10, height: 10, background: '#ef4444', boxShadow: '0 0 8px #ef4444, 0 0 14px #ef4444' }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </button>
    </div>
  );
}
