import React, { useState, useEffect, useMemo } from 'react';
import { Pin, Users } from 'lucide-react';
import { getPins } from '@/lib/spidrWebPins';

/**
 * SpidrWebMatrix — the unified connections hub.
 *
 * Merges what used to be two separate surfaces:
 *   • "Jump Back In" (recent DMs + group chats) — the homepage rail
 *   • "Spidr Web"    (pinned conversations)     — the Friends-page strip
 *
 * into one tabbed, scrollable glassmorphic panel so the user's most
 * important connections live in a single place instead of competing for
 * screen real estate.
 *
 * Data contracts (all supplied by the parent — this component fetches
 * nothing so it can mount anywhere):
 *   recentConversations: [{ conversationId, friendId, name, avatar, last }]
 *   myGroups:            [{ id, name, avatar_url|icon_url, members[] }]
 *   statusByUser:        { [user_id]: 'online'|'idle'|'dnd'|'offline' }
 *   avatarByUser:        { [user_id]: avatar_url }  — live pfps, so pinned
 *                        rows never render a stale snapshot or a stand-in
 *   navigateToDM(friendId, conversationId)
 *   navigate(path)  — react-router navigate, used for the group lane
 *
 * Pins are read live from lib/spidrWebPins (localStorage + profile sync)
 * and re-render on the `spidr-web-pins-changed` event, so pinning from a
 * right-click menu anywhere in the app updates this panel instantly.
 */

// Avatar stand-in when nobody has a picture: the first letter on a dark
// disc. Beats a generated-face service — it never 404s, never leaks the
// user id to a third party, and matches the rest of the UI.
function InitialsDisc({ name, className = '', style }) {
  return (
    <div
      className={`flex items-center justify-center bg-zinc-900 text-white/70 font-black ${className}`}
      style={style}
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

const STATUS_COLORS = {
  online: 'bg-green-500',
  idle:   'bg-yellow-500',
  dnd:    'bg-red-500',
  offline:'bg-zinc-600',
};

export default function SpidrWebMatrix({
  recentConversations = [],
  myGroups = [],
  statusByUser = {},
  avatarByUser = {},
  navigateToDM,
  navigate,
  className = '',
}) {
  const [activeTab, setActiveTab] = useState('recent');

  // Live pins — pinning from any right-click menu updates this immediately.
  const [pins, setPins] = useState(() => getPins());
  useEffect(() => {
    const onChange = (e) => setPins(e.detail || getPins());
    window.addEventListener('spidr-web-pins-changed', onChange);
    return () => window.removeEventListener('spidr-web-pins-changed', onChange);
  }, []);

  // Open a group chat: the Friends page consumes __spidrPendingGroup on mount.
  const openGroup = (groupId) => {
    window.__spidrPendingGroup = { groupId, at: Date.now() };
    navigate?.('/friends');
    window.dispatchEvent(new CustomEvent('spidr-pending-group'));
  };

  // Recent tab rows: DMs first, then groups — one unified list.
  const recentRows = useMemo(() => ([
    ...recentConversations.map((c) => ({
      key: `dm-${c.conversationId}`,
      kind: 'DM',
      name: c.name,
      sub: c.last || 'Open conversation',
      // Live profile pfp first — the row's denormalized avatar is a
      // send-time snapshot and goes stale when someone changes their pfp.
      avatar: avatarByUser[c.friendId] || c.avatar || '',
      onClick: () => navigateToDM?.(c.friendId, c.conversationId),
    })),
    ...myGroups.map((g) => ({
      key: `grp-${g.id}`,
      kind: 'GROUP',
      name: g.name || 'Group Chat',
      sub: `${(g.members || []).length} members`,
      avatar: g.avatar_url || g.icon_url || '',
      isGroup: true,
      onClick: () => openGroup(g.id),
    })),
  ]), [recentConversations, myGroups, avatarByUser]);

  // Live group pfps by id — the same reason pins can't trust their snapshot.
  const groupById = useMemo(() => {
    const m = {};
    for (const g of myGroups) m[g.id] = g;
    return m;
  }, [myGroups]);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl ${className}`}
      style={{
        background: 'rgba(5, 5, 5, 0.80)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.8)',
      }}
    >
      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 px-4 pt-3 border-b border-white/5 bg-white/[0.01] shrink-0">
        <button
          onClick={() => setActiveTab('recent')}
          className={`pb-2.5 text-[10px] font-black tracking-widest uppercase transition-colors relative ${
            activeTab === 'recent' ? 'text-red-500' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Jump Back In
          {activeTab === 'recent' && (
            <span
              className="absolute bottom-0 left-0 w-full h-[2px] bg-red-500"
              style={{ boxShadow: '0 0 10px rgba(239,68,68,0.8)' }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('web')}
          className={`pb-2.5 text-[10px] font-black tracking-widest uppercase transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'web' ? 'text-purple-400' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Users size={11} />
          Pinned
          {pins.length > 0 && (
            <span className="text-[9px] font-mono text-white/30">{pins.length}</span>
          )}
          {activeTab === 'web' && (
            <span
              className="absolute bottom-0 left-0 w-full h-[2px] bg-purple-500"
              style={{ boxShadow: '0 0 10px rgba(168,85,247,0.8)' }}
            />
          )}
        </button>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto spidr-scroll p-2 space-y-1">
        {/* JUMP BACK IN */}
        {activeTab === 'recent' && (
          recentRows.length === 0 ? (
            <p className="text-[11px] text-zinc-500 text-center py-8">No recent conversations yet</p>
          ) : recentRows.map((row) => (
            <button
              key={row.key}
              onClick={row.onClick}
              className="group w-full flex items-center justify-between p-2.5 rounded-xl text-left border border-transparent hover:bg-white/[0.03] hover:border-white/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                {row.avatar ? (
                  <img
                    src={row.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full bg-[#111] object-cover shrink-0 group-hover:ring-2 group-hover:ring-red-500/50 transition-all"
                  />
                ) : row.isGroup ? (
                  <div className="w-10 h-10 rounded-full shrink-0 bg-gradient-to-br from-red-900/60 to-zinc-900 flex items-center justify-center border border-white/10 group-hover:ring-2 group-hover:ring-red-500/50 transition-all">
                    <Users className="w-4 h-4 text-red-400" />
                  </div>
                ) : (
                  <InitialsDisc
                    name={row.name}
                    className="w-10 h-10 rounded-full shrink-0 text-sm border border-white/10 group-hover:ring-2 group-hover:ring-red-500/50 transition-all"
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">
                    {row.name}
                  </span>
                  <span className="text-[11px] text-white/45 truncate">{row.sub}</span>
                </div>
              </div>
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest shrink-0 ml-2">
                {row.kind}
              </span>
            </button>
          ))
        )}

        {/* PINNED */}
        {activeTab === 'web' && (
          pins.length === 0 ? (
            <div className="text-center py-8 px-3">
              <Pin className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-500">
                Nothing pinned yet — right-click any friend or group and choose
                <span className="text-purple-400"> Pin to Spidr Web</span>.
              </p>
            </div>
          ) : pins.map((pin) => {
            const status = pin.kind === 'dm' ? (statusByUser[pin.id] || 'offline') : null;
            // Pins store a name/avatar snapshot taken when they were pinned,
            // which is why rows fell back to a stand-in disc whenever the
            // snapshot was empty (or wrong after a pfp change). Resolve the
            // live picture first, snapshot second.
            const group = pin.kind === 'group' ? groupById[pin.id] : null;
            const liveAvatar = pin.kind === 'group'
              ? (group?.avatar_url || group?.icon_url || pin.avatar || '')
              : (avatarByUser[pin.id] || pin.avatar || '');
            const displayName = (pin.kind === 'group' ? group?.name : null) || pin.name;
            return (
              <button
                key={`${pin.kind}-${pin.id}`}
                onClick={() => {
                  if (pin.kind === 'group') openGroup(pin.id);
                  else navigateToDM?.(pin.id, null);
                }}
                className="group w-full flex items-center gap-3 p-2.5 rounded-xl text-left bg-white/[0.01] border border-white/5 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-purple-500/10 transition-all"
              >
                <div className="relative shrink-0">
                  {/* Pushpin badge, tucked into the top-left of the avatar */}
                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-[#050505] rounded-full flex items-center justify-center z-20">
                    <Pin className="w-2.5 h-2.5 text-red-500" fill="currentColor" />
                  </span>
                  {/* Gradient pin ring — red→purple, the Spidr Web signature */}
                  <div
                    className="p-[2px] rounded-full bg-gradient-to-tr from-red-600 to-purple-600"
                    style={{ boxShadow: '0 0 10px rgba(220,38,38,0.3)' }}
                  >
                    {liveAvatar ? (
                      <img
                        src={liveAvatar}
                        alt=""
                        className="w-9 h-9 rounded-full border-2 border-[#050505] object-cover block"
                      />
                    ) : pin.kind === 'group' ? (
                      <div className="w-9 h-9 rounded-full border-2 border-[#050505] bg-zinc-900 flex items-center justify-center">
                        <Users className="w-4 h-4 text-red-400" />
                      </div>
                    ) : (
                      <InitialsDisc
                        name={displayName}
                        className="w-9 h-9 rounded-full border-2 border-[#050505] text-sm"
                      />
                    )}
                  </div>
                  {/* Presence dot — DMs only; groups have no single status */}
                  {status && (
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#050505] z-20 ${STATUS_COLORS[status] || STATUS_COLORS.offline}`}
                    />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white truncate">{displayName}</span>
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">
                    {pin.kind === 'group' ? 'Pinned Group' : 'Pinned'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
