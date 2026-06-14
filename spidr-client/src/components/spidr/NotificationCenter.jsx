import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/api/apiClient';
import {
  Bell, X, MessageCircle, UserPlus, AtSign, Megaphone, Calendar, Film, Check
} from 'lucide-react';

/**
 * NotificationCenter — Spidr's in-app notification system.
 *
 * Notifications are modeled as "signals caught in the web". They arrive from
 * three sources, all funneled through `pushNotification`:
 *   1. Socket events (friend requests, new messages, mentions) — wired below.
 *   2. Window events dispatched elsewhere in the app via
 *      `spidr-notify` CustomEvent { type, title, body, icon, link }.
 *   3. Direct calls to the exposed context method.
 *
 * The UI is a bell in the top bar that shows an unread count and, when opened,
 * a slide-in panel listing recent signals. Each type has its own icon + accent.
 * Clicking a signal navigates to its link and marks it read.
 *
 * Toasts: brand-new notifications also surface a small transient "web ripple"
 * toast in the corner so the user notices without opening the panel.
 */

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

const TYPE_META = {
  message:      { Icon: MessageCircle, accent: '#3b82f6', label: 'Message' },
  dm:           { Icon: MessageCircle, accent: '#a855f7', label: 'Direct Message' },
  friend:       { Icon: UserPlus,      accent: '#22c55e', label: 'Friend' },
  mention:      { Icon: AtSign,        accent: '#ef4444', label: 'Mention' },
  announcement: { Icon: Megaphone,     accent: '#f97316', label: 'Announcement' },
  event:        { Icon: Calendar,      accent: '#eab308', label: 'Event' },
  clip:         { Icon: Film,          accent: '#ec4899', label: 'THE WEB' },
  // Activity-feed reply (Holo-Ping). Toxic-purple accent so it stands out
  // from DM purple and clip pink without colliding with either palette.
  feed_reply:   { Icon: MessageCircle, accent: '#c084fc', label: 'Activity reply' },
  default:      { Icon: Bell,          accent: '#9ca3af', label: 'Signal' },
};

const MAX_STORED = 50;

export function NotificationProvider({ currentUser, children }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [ripples, setRipples] = useState([]); // transient corner toasts
  // Feed-IDs with at least one unread reply for the current user. Drives
  // the breathing-glow in-feed highlight in EnhancedFeed. Persisted to
  // localStorage so the highlight survives a refresh until the user
  // actually reads the post.
  const [unreadFeedIds, setUnreadFeedIds] = useState(() => {
    try {
      const raw = localStorage.getItem('spidr_unread_feed_replies');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  const seenRef = useRef(new Set());

  // Persist unreadFeedIds whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem('spidr_unread_feed_replies', JSON.stringify([...unreadFeedIds]));
    } catch {}
  }, [unreadFeedIds]);

  const markFeedRead = useCallback((feedId) => {
    setUnreadFeedIds(prev => {
      if (!prev.has(feedId)) return prev;
      const next = new Set(prev);
      next.delete(feedId);
      return next;
    });
  }, []);

  const pushNotification = useCallback((n) => {
    // Dedupe by an optional key so rapid duplicate events don't stack.
    if (n.key) {
      if (seenRef.current.has(n.key)) return;
      seenRef.current.add(n.key);
    }
    const note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: n.type || 'default',
      title: n.title || 'New signal',
      body: n.body || '',
      link: n.link || null,
      feed_id: n.feed_id || null,
      read: false,
      created: Date.now(),
    };
    setItems((prev) => [note, ...prev].slice(0, MAX_STORED));
    // Activity-feed replies also light up the post's in-feed glow until
    // the user opens it. Tracked by feed_id so multiple replies on the
    // same post still resolve to one glow.
    if (note.type === 'feed_reply' && note.feed_id) {
      setUnreadFeedIds(prev => {
        if (prev.has(note.feed_id)) return prev;
        const next = new Set(prev);
        next.add(note.feed_id);
        return next;
      });
    }
    // Transient ripple toast
    setRipples((prev) => [...prev, note]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== note.id));
    }, 4500);
  }, []);

  // ── Socket + window-event wiring ───────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    const socket = getSocket();

    const onFriend = ({ senderName }) =>
      pushNotification({ type: 'friend', title: 'New friend request', body: `${senderName || 'Someone'} wants to link with you`, link: '/friends', key: `friend-${senderName}-${Date.now()}` });

    const onMessage = (msg) => {
      // Skip our own messages.
      if (!msg || msg.author_id === currentUser.id || msg.user_id === currentUser.id) return;
      // Mention of us → mention notification; otherwise a generic new-message.
      const mentionedMe = typeof msg.content === 'string' &&
        (msg.content.includes(`@${currentUser.username}`) || msg.content.includes(`@${currentUser.full_name}`));
      if (mentionedMe) {
        pushNotification({ type: 'mention', title: `${msg.author_name || msg.user_name || 'Someone'} mentioned you`, body: msg.content.slice(0, 80), link: msg.server_id ? `/servers/${msg.server_id}?channel=${msg.channel_id}&msg=${msg.id}` : '/servers', key: `mention-${msg.id}` });
      } else {
        pushNotification({ type: 'message', title: `${msg.author_name || msg.user_name || 'New message'}`, body: (msg.content || '').slice(0, 80), link: msg.server_id ? `/servers/${msg.server_id}?channel=${msg.channel_id}` : null, key: `msg-${msg.id}` });
      }
    };

    const onDM = (msg) => {
      if (!msg || msg.sender_id === currentUser.id) return;
      pushNotification({ type: 'dm', title: `${msg.sender_name || 'New DM'}`, body: (msg.content || '').slice(0, 80), link: '/friends/dms', key: `dm-${msg.id}` });
    };

    // Activity-feed comment on a post YOU own. The server is expected to
    // emit this to the post owner's socket when a new FeedComment is
    // created where parent_comment_id is null and feed.user_id === socket.user.id.
    const onFeedComment = (payload) => {
      if (!payload) return;
      if (payload.author_id === currentUser.id) return; // skip own comments
      pushNotification({
        type: 'feed_reply',
        title: `${payload.author_name || 'Someone'} replied to your post`,
        body: (payload.content || '').slice(0, 80),
        link: '/home',
        feed_id: payload.feed_id,
        key: `feed-comment-${payload.id || payload.feed_id}-${payload.created_date || Date.now()}`,
      });
    };
    // Reply to a comment YOU wrote. The server emits this to the parent
    // commenter's socket when parent_comment_id is non-null and the
    // parent's author_id === socket.user.id.
    const onFeedReply = (payload) => {
      if (!payload) return;
      if (payload.author_id === currentUser.id) return;
      pushNotification({
        type: 'feed_reply',
        title: `${payload.author_name || 'Someone'} replied to your comment`,
        body: (payload.content || '').slice(0, 80),
        link: '/home',
        feed_id: payload.feed_id,
        key: `feed-reply-${payload.id || payload.feed_id}-${payload.created_date || Date.now()}`,
      });
    };

    socket.on('friend:incoming', onFriend);
    socket.on('message:new', onMessage);
    socket.on('dm:new', onDM);
    socket.on('feed:comment', onFeedComment);
    socket.on('feed:reply', onFeedReply);

    // Generic window-event bridge so any component can raise a notification.
    // If the event carries a `recipient_id`, drop it when the current user
    // isn't that recipient — this lets components fire-and-forget the
    // dispatch without doing their own self-skip check, and supports
    // single-tab demos where the same user is "both sides" of a flow.
    const onWindowNotify = (e) => {
      const detail = e.detail || {};
      if (detail.recipient_id && detail.recipient_id !== currentUser?.id) return;
      pushNotification(detail);
    };
    window.addEventListener('spidr-notify', onWindowNotify);

    return () => {
      socket.off('friend:incoming', onFriend);
      socket.off('message:new', onMessage);
      socket.off('dm:new', onDM);
      socket.off('feed:comment', onFeedComment);
      socket.off('feed:reply', onFeedReply);
      window.removeEventListener('spidr-notify', onWindowNotify);
    };
  }, [currentUser?.id, currentUser?.username, currentUser?.full_name, pushNotification]);

  const unread = items.filter((i) => !i.read).length;
  const unreadFeedReplies = items.filter((i) => !i.read && i.type === 'feed_reply').length;
  const markAllRead = () => setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  const clearAll = () => setItems([]);
  const openItem = (note) => {
    setItems((prev) => prev.map((i) => (i.id === note.id ? { ...i, read: true } : i)));
    // If the notification was a feed reply, also clear its in-feed glow.
    if (note.type === 'feed_reply' && note.feed_id) markFeedRead(note.feed_id);
    if (note.link) navigate(note.link);
    setOpen(false);
  };

  return (
    <NotificationContext.Provider value={{
      pushNotification, items, unread, unreadFeedReplies,
      open, setOpen, markAllRead,
      unreadFeedIds, markFeedRead,
    }}>
      {children}

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 360, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              className="fixed top-0 right-0 bottom-0 z-[61] w-full max-w-sm bg-[#0b0b0d] border-l border-white/10 flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white font-black uppercase italic tracking-tight flex items-center gap-2">
                  <Bell className="w-5 h-5 text-red-500" /> Signals
                </h2>
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <button onClick={clearAll} className="text-zinc-500 hover:text-white text-xs">Clear</button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 p-8">
                    <span className="text-3xl">🕸️</span>
                    <p className="text-sm">Your web is quiet.</p>
                    <p className="text-xs text-zinc-700">New signals will appear here.</p>
                  </div>
                ) : (
                  items.map((note) => {
                    const meta = TYPE_META[note.type] || TYPE_META.default;
                    const Icon = meta.Icon;
                    return (
                      <button
                        key={note.id}
                        onClick={() => openItem(note)}
                        className={`w-full text-left flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                          note.read ? 'bg-transparent hover:bg-white/5' : 'bg-white/[0.04] hover:bg-white/[0.07]'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: meta.accent + '22' }}>
                          <Icon className="w-4 h-4" style={{ color: meta.accent }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-semibold truncate">{note.title}</p>
                          {note.body && <p className="text-zinc-500 text-xs truncate">{note.body}</p>}
                          <p className="text-zinc-700 text-[10px] mt-0.5">{timeAgo(note.created)}</p>
                        </div>
                        {!note.read && <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Transient "web ripple" toasts */}
      <div className="fixed bottom-24 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {ripples.map((note) => {
            const meta = TYPE_META[note.type] || TYPE_META.default;
            const Icon = meta.Icon;
            return (
              <motion.button
                key={note.id}
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                onClick={() => openItem(note)}
                className="pointer-events-auto flex items-start gap-2.5 bg-[#0b0b0d]/95 backdrop-blur-xl border rounded-xl px-3 py-2.5 shadow-2xl max-w-[300px]"
                style={{ borderColor: meta.accent + '55' }}
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.accent + '22' }}>
                  <Icon className="w-4 h-4" style={{ color: meta.accent }} />
                </span>
                <div className="min-w-0 text-left">
                  <p className="text-white text-xs font-bold truncate">{note.title}</p>
                  {note.body && <p className="text-zinc-400 text-[11px] truncate">{note.body}</p>}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

/**
 * NotificationBell — the trigger button. Rendered inline by the shell so it
 * sits alongside the biomass pill and status chip in the top-right cluster.
 * Must be mounted inside a <NotificationProvider>.
 */
export function NotificationBell() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return null;
  const { open, setOpen, unread, unreadFeedReplies, markAllRead } = ctx;

  // Stronger emphasis when feed-replies are pending — the blueprint calls
  // for a "glowing, pulsing orbital ring" instead of a static dot. The
  // outer ring uses absolute positioning so it doesn't shift the button.
  const hasFeedReplies = unreadFeedReplies > 0;

  return (
    <button
      onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
      className="relative w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 hover:border-red-500/40 flex items-center justify-center transition-colors"
      title="Signals"
    >
      {/* Pulsing orbital ring — present whenever there are unread signals,
          color-shifted to toxic purple for feed-reply emphasis. */}
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping pointer-events-none"
          style={{
            border: `1px solid ${hasFeedReplies ? 'rgba(192, 132, 252, 0.7)' : 'rgba(239, 68, 68, 0.7)'}`,
            animationDuration: '2s',
          }}
        />
      )}
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: hasFeedReplies
              ? '0 0 12px rgba(192, 132, 252, 0.45), inset 0 0 4px rgba(192, 132, 252, 0.25)'
              : '0 0 10px rgba(239, 68, 68, 0.35)',
          }}
        />
      )}
      <Bell className={`w-4 h-4 ${hasFeedReplies ? 'text-purple-300' : 'text-zinc-300'} relative z-10`} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center border border-black z-10"
          style={{ background: hasFeedReplies ? '#a855f7' : '#dc2626' }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
