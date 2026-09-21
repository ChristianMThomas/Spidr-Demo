import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { ChevronDown , Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { useAppShell } from '@/context/AppShellContext';
import SpiderLogo from '@/components/spidr/SpiderLogo';
import { SpidrWordmark } from '@/components/spidr/SpidrBrand';
import DiscoverUsers from '@/components/spidr/DiscoverUsers';
import EnhancedFeed from '@/components/spidr/EnhancedFeed';
import EngagementHub from '@/components/spidr/EngagementHub';
import TensionBar from '@/components/spidr/TensionBar';
import SpidrSystem from '@/components/spidr/SpidrSystem';
import SpidrWebMatrix from '@/components/spidr/SpidrWebMatrix';
import useTypewriter from '@/hooks/useTypewriter';
import { MOCK_NEWS } from '@/components/spidr/SpidrSystem';

/**
 * /home — the landing dashboard.
 *
 * Layout (top to bottom):
 *   - Welcome Banner: mascot + greeting in a wide glass slab
 *   - Stat Strip: three glass cards (Servers / Friends / GIFs)
 *   - Web Tension XP bar
 *   - Quick Actions row
 *   - Spidr AI Discover Users
 *   - Activity Feed (CONTAINED in a fixed-height glass box with internal
 *     scroll + bottom gradient fade — the page no longer stretches when
 *     the feed grows)
 *   - Recent Servers grid
 *   - Right rail: EngagementHub (also contained)
 */
export default function HomeDashboard() {
  const [showAllActivity, setShowAllActivity] = React.useState(false);
  const { currentUser, setSelectedServerId, navigateToDM, appTheme } = useAppShell();
  const navigate = useNavigate();

  // Collapse state for the dashboard sections — persisted so the user's
  // preference survives reloads. Default = expanded (false).
  const [activityCollapsed, setActivityCollapsed] = React.useState(() => {
    try { return localStorage.getItem('spidr_home_activity_collapsed') === '1'; } catch { return false; }
  });
  const [serversCollapsed, setServersCollapsed] = React.useState(() => {
    try { return localStorage.getItem('spidr_home_servers_collapsed') === '1'; } catch { return false; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('spidr_home_activity_collapsed', activityCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [activityCollapsed]);
  React.useEffect(() => {
    try { localStorage.setItem('spidr_home_servers_collapsed', serversCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [serversCollapsed]);

  const { data: allServers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 60000,
  });

  const servers = React.useMemo(() => {
    if (!currentUser?.id) return [];
    return allServers.filter(s =>
      s.owner_id === currentUser.id ||
      (s.members || []).some(m => m.user_id === currentUser.id)
    );
  }, [allServers, currentUser?.id]);

  // ── Quick access: recent DM conversations + group chats ──────────────────
  // One-tap jumps from the homepage — reuses the same data shapes the DM
  // sidebar and Friends panel use, so opening lands exactly where clicking
  // there would.
  const { data: allDMs = [] } = useQuery({
    queryKey: ['all-dms', currentUser?.id],
    queryFn: async () => {
      const sent = await entities.DirectMessage.filter({ sender_id: currentUser?.id });
      const received = await entities.DirectMessage.filter({ recipient_id: currentUser?.id });
      return [...sent, ...received].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!currentUser?.id,
    staleTime: 30_000,
  });
  const { data: myGroups = [] } = useQuery({
    queryKey: ['user-groups', currentUser?.id],
    queryFn: async () => {
      const groups = await entities.GroupChat.list('-updated_date', 100);
      return groups.filter(g => (g.members || []).some(m => m.user_id === currentUser?.id));
    },
    enabled: !!currentUser?.id,
    staleTime: 60_000,
  });
  // Presence for the Spidr Web tab's pinned-DM status dots. Same query key
  // the Friends page uses, so it's a cache hit when navigating between them.
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list(),
    staleTime: 60000,
  });
  const statusByUser = React.useMemo(() => {
    const m = {};
    for (const p of profiles) m[p.user_id] = p.status;
    return m;
  }, [profiles]);
  // Live pfps for the same panel — pins and recent rows carry a snapshot
  // taken when they were created, so without this a pinned friend showed a
  // stand-in disc (or their old picture) forever.
  const avatarByUser = React.useMemo(() => {
    const m = {};
    for (const p of profiles) if (p.avatar_url) m[p.user_id] = p.avatar_url;
    return m;
  }, [profiles]);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });
  // Fast lookup by friend_id for resolving names on old DM rows whose
  // denormalized recipient_name/avatar are empty.
  const friendById = React.useMemo(() => {
    const m = new Map();
    for (const f of friends) m.set(f.friend_id, f);
    return m;
  }, [friends]);

  // ── Banner status lines ─────────────────────────────────────────────────
  // Everything here is a real signal. A rotating banner that invents
  // activity is worse than a static one — it teaches people to ignore it.
  // Lines only appear when they have something true to report.
  const statusLines = React.useMemo(() => {
    const lines = [];

    // Unread direct messages addressed to this user.
    const unread = (allDMs || []).filter(
      m => !m.is_read && (m.recipient_id === currentUser?.id || m.receiver_id === currentUser?.id)
    ).length;
    if (unread > 0) {
      lines.push(`${unread} unread message${unread === 1 ? '' : 's'} waiting`);
    }

    // Pending friend requests.
    const pending = (friends || []).filter(f => f.status === 'pending_incoming').length;
    if (pending > 0) {
      lines.push(`${pending} friend request${pending === 1 ? '' : 's'} pending`);
    }

    // Newest patch, straight from the changelog rather than a hardcoded copy.
    const latest = MOCK_NEWS?.[0];
    if (latest?.title) {
      lines.push(latest.title.replace(/^Patch\s+/i, 'Latest build: '));
    }

    // Today's date, always available so the line never sits empty.
    lines.push(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    );

    if (unread === 0 && pending === 0) lines.push('Your web is quiet');
    return lines;
  }, [allDMs, friends, currentUser?.id]);

  const { text: statusText } = useTypewriter(statusLines);

  const recentConversations = React.useMemo(() => {
    const seen = new Map();
    for (const msg of allDMs) {
      if (!msg.conversation_id || seen.has(msg.conversation_id)) continue;
      const otherId = msg.sender_id === currentUser?.id ? msg.recipient_id : msg.sender_id;
      // Name resolution priority — the "Node" placeholder was landing here
      // because outgoing DMs sent before the recipient_name schema field
      // existed have empty denormalized fields. Look up the real name from
      // the Friend list instead of trusting stale row data.
      const iSent = msg.sender_id === currentUser?.id;
      const friend = friendById.get(otherId);
      const resolvedName =
        (iSent ? msg.recipient_name : msg.sender_name) ||
        friend?.friend_name ||
        friend?.friend_username ||
        'Unknown';
      const resolvedAvatar =
        (iSent ? msg.recipient_avatar : msg.sender_avatar) ||
        friend?.friend_avatar ||
        '';
      seen.set(msg.conversation_id, {
        conversationId: msg.conversation_id,
        friendId: otherId,
        name: resolvedName,
        avatar: resolvedAvatar,
        last: msg.content || (msg.media_url ? 'Media' : ''),
        at: msg.created_date,
      });
      if (seen.size >= 6) break;
    }
    return [...seen.values()];
  }, [allDMs, currentUser?.id, friendById]);

  // Best-effort first-name extraction for the greeting. Falls back to the
  // full name, then the username, then "spider".
  const greetingName =
    (currentUser?.full_name || '').split(' ')[0] ||
    currentUser?.username ||
    'spider';

  // ── Theme Studio background (universal — all users) ──────────────────────
  // Source: `appTheme` from useAppShell, written by Settings → Appearance →
  // Theme Studio. Replaces the prior APEX-only `apex_features.custom_bg_url`
  // path, which gated the background behind a tier and read from the wrong
  // field. Now: every user's theme paints the dashboard canvas.
  const themeType = appTheme?.type || null;
  const themeImage = appTheme?.backgroundImage || '';
  const themeBlur = Number(appTheme?.blur) || 0;
  // Theme Studio's "opacity" slider is interpreted as IMAGE visibility
  // (higher = brighter art). Default is 85 in the studio's initial state,
  // so a brand-new theme image looks vivid. We compute the inverse for the
  // dark overlay so the slider naturally trades contrast for visibility.
  const themeOpacity = (appTheme?.opacity ?? 85) / 100;
  const overlayDarkness = Math.max(0.15, 1 - themeOpacity);

  const hasThemeBg =
    (themeType === 'image' && !!themeImage) ||
    (themeType === 'gradient' && !!appTheme?.primaryColor) ||
    (themeType === 'solid' && !!appTheme?.primaryColor);

  return (
    <div className="flex-1 bg-[#050505] overflow-y-auto relative">
      <Dialog open={showAllActivity} onOpenChange={setShowAllActivity}>
        <DialogContent className="max-w-3xl bg-[#0b0b0d] border-white/10 text-white">
          <DialogHeader><DialogTitle>Activity Feed</DialogTitle><DialogDescription className="sr-only">All activity</DialogDescription></DialogHeader>
          <div className="max-h-[75vh] overflow-y-auto"><EnhancedFeed currentUser={currentUser} full /></div>
        </DialogContent>
      </Dialog>
      {/* Custom scrollbar styling for the activity feed containment box.
          Scoped via `.spidr-feed-scroll` so it doesn't affect the rest of
          the app's scrollbars. */}
      <style>{`
        .spidr-feed-scroll::-webkit-scrollbar { width: 6px; }
        .spidr-feed-scroll::-webkit-scrollbar-track { background: transparent; }
        .spidr-feed-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 999px;
          transition: background 0.15s ease;
        }
        .spidr-feed-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
        }
        .spidr-feed-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 68, 68, 0.6);
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
        }
        /* Firefox */
        .spidr-feed-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent; }
      `}</style>

      {/* ── Theme Studio background ────────────────────────────────────
          Available to ALL users (Settings → Appearance → Theme Studio).
          A sticky-positioned wrapper keeps the artwork painted at the
          top of the visible dashboard area while the user scrolls the
          content below. The image and gradient/solid variants share the
          same wrapper so they behave identically; only the inner layer
          differs by type. */}
      {hasThemeBg && (
        <div
          className="sticky top-0 left-0 right-0 h-screen pointer-events-none overflow-hidden"
          style={{ marginBottom: '-100vh', zIndex: 0 }}
          aria-hidden="true"
        >
          {/* Theme content layer */}
          {themeType === 'image' && themeImage && (
            <img
              src={themeImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: themeOpacity,
                filter: themeBlur ? `blur(${themeBlur}px)` : undefined,
                // Scale slightly to hide the blurred edges (same trick the
                // Theme Studio preview uses).
                transform: themeBlur ? 'scale(1.06)' : undefined,
              }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          {themeType === 'gradient' && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${appTheme.primaryColor}, ${appTheme.secondaryColor || appTheme.primaryColor})`,
              }}
            />
          )}
          {themeType === 'solid' && (
            <div
              className="absolute inset-0"
              style={{ background: appTheme.primaryColor }}
            />
          )}

          {/* Legibility overlay — single dark scrim whose intensity is the
              inverse of the user's opacity slider, matching the preview
              inside ThemeStudio. Always applied so dense glass cards stay
              readable, even on bright/busy artwork. */}
          <div
            className="absolute inset-0"
            style={{ background: `rgba(5, 5, 5, ${overlayDarkness})` }}
          />
          {/* Bottom anchor — slight extra darkness where the activity feed
              sits, so its rows have guaranteed contrast no matter what
              theme the user picked. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(5,5,5,0.45) 100%)',
            }}
          />
        </div>
      )}

      {/* Ambient page glow — faint red bleed top-right + cool blue bleed
          bottom-left. Hidden when a Theme Studio background is set (the
          user's theme takes the canvas role then). */}
      {!hasThemeBg && (
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 50% 35% at 100% 0%, rgba(239, 68, 68, 0.08), transparent 70%),' +
              'radial-gradient(ellipse 40% 30% at 0% 100%, rgba(59, 130, 246, 0.04), transparent 70%)',
          }}
        />
      )}

      <div className="relative z-10 flex gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto">
        {/* ── Main column ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ── Welcome Banner ──────────────────────────────────────────────
              Wide glass slab with the spider mascot on the left, a
              WELCOME_BACK eyebrow, a bold first-name greeting, and a tagline.
              A faint right-edge red glow gives it presence without
              overpowering the rest of the dashboard. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(100deg, rgba(239,68,68,0.10) 0%, rgba(10,10,10,0.72) 42%, rgba(5,5,5,0.72) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4), inset 0 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Right-edge red glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 50% 90% at 100% 50%, rgba(239, 68, 68, 0.16), transparent 70%)',
              }}
            />
            {/* Hairline accent at top */}
            <div
              className="absolute top-0 inset-x-0 h-px pointer-events-none"
              style={{
                background:
                  'linear-gradient(to right, transparent, rgba(239, 68, 68, 0.35), transparent)',
              }}
            />

            <div className="relative flex items-center gap-5 p-6">
              <SpidrWordmark className="w-28 h-24 max-[480px]:w-24 shrink-0" />

              {/* Copy block */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <p className="font-mono text-[10px] tracking-[0.32em] uppercase text-red-400/90">
                    System Uplink Established
                  </p>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-wide">
                  Hey,{' '}
                  <span
                    className="text-transparent bg-clip-text"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #ef4444, #b91c1c)',
                      filter: 'drop-shadow(0 0 14px rgba(239,68,68,0.35))',
                    }}
                  >
                    {greetingName}
                  </span>
                </h1>

                {/* Rotating status line. min-h holds the row open so the
                    banner doesn't jitter as text types and deletes. */}
                <p className="mt-1 font-mono text-[12px] text-white/45 min-h-[18px] flex items-center">
                  <span className="truncate">{statusText}</span>
                  <span
                    aria-hidden
                    className="inline-block w-[7px] h-[14px] ml-1 bg-red-500 shrink-0"
                    style={{ animation: 'spidr-caret 1s step-end infinite' }}
                  />
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Stat Strip ──────────────────────────────────────────────────
              Three glass tiles in a single row. Each is its own tappable
              shortcut: Servers / Friends / GIFs & Emojis. The number sits
              big on top, with the label tucked underneath. */}
          <div className="grid grid-cols-3 gap-4">
            <StatTile
              value={servers.length}
              label="Servers"
              onClick={() => navigate('/servers')}
            />
            <StatTile
              value={friends.length}
              label="Friends"
              onClick={() => navigate('/friends')}
            />
            <StatTile
              value="∞"
              label="GIFs & Emojis"
              valueClassName="text-red-500"
              onClick={() => navigate('/gifs')}
            />
          </div>

          {/* Web Tension (XP / level) */}
          <TensionBar />

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate('/friends/add')}
              className="relative overflow-hidden rounded-2xl p-5 text-left transition-all"
              style={{
                background:
                  'linear-gradient(135deg, rgba(220, 38, 38, 0.85), rgba(127, 29, 29, 0.85))',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                boxShadow: '0 8px 24px rgba(220, 38, 38, 0.2)',
              }}
            >
              <h3 className="text-base font-bold text-white mb-1">Find Friends</h3>
              <p className="text-red-200 text-xs">Connect with others on the web</p>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate('/ai')}
              className="relative overflow-hidden rounded-2xl p-5 text-left transition-all"
              style={{
                background: 'rgba(10, 10, 10, 0.60)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <h3 className="text-base font-bold text-white mb-1">Try Spidr AI</h3>
              <p className="text-zinc-400 text-xs">Create servers & customize</p>
            </motion.button>
          </div>

          {/* AI User Discovery */}
          <DiscoverUsers currentUser={currentUser} onNavigateToDM={navigateToDM} />

          {/* ── Activity Feed — CONTAINMENT FIELD ──────────────────────────
              The feed used to flow into the page's normal block layout,
              which meant a busy feed could stretch the page indefinitely
              and bury the top of the dashboard.
              Now it lives in a strict max-height glass module with its own
              internal scroll. The bottom gradient masks the scroll-edge so
              older items appear to fade into the canvas. */}
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: 'rgba(10, 10, 10, 0.60)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Header rail — sits OUTSIDE the scroll area so the title
                never moves as the user scrolls the feed below. */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivityCollapsed(v => !v)}
                  aria-label={activityCollapsed ? 'Expand Activity Feed' : 'Collapse Activity Feed'}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${activityCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
                <span className="relative flex items-center justify-center w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
                  <span className="relative w-2 h-2 rounded-full bg-red-500" />
                </span>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">
                  Activity Feed
                </h2>
              </div>
              <button
                onClick={() => setShowAllActivity(true)}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-400/80 hover:text-red-300 transition-colors"
              >
                View All →
              </button>
            </div>

            {!activityCollapsed && (
              <>
                {/* Scroll engine — internal overflow, capped height. The pr-5
                    gives the scrollbar a hair of breathing room from the
                    content. */}
                <div
                  className="spidr-feed-scroll max-h-[450px] overflow-y-auto px-5 pb-6"
                  style={{ maskImage: undefined }}
                >
                  <EnhancedFeed currentUser={currentUser} />
                </div>

                {/* Fade-out mask — absolute, pointer-events-none, sits inside
                    the rounded clip so older feed items vanish smoothly into
                    the dark canvas at the bottom edge. */}
                <div
                  className="absolute bottom-0 inset-x-0 h-16 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0.6) 50%, transparent 100%)',
                  }}
                />
              </>
            )}
          </div>

          {/* Jump Back In — in-column only BELOW lg, where the right rail is
              hidden. The breakpoint must match the rail's (lg:block) exactly:
              when the rail was xl and this was xl:hidden it lined up, but
              consolidating the rails moved it to lg, and leaving this at xl
              would have rendered the panel TWICE between lg and xl. */}
          <div className="lg:hidden">
            <SpidrWebMatrix
              className="h-[26rem]"
              recentConversations={recentConversations}
              myGroups={myGroups}
              statusByUser={statusByUser}
              avatarByUser={avatarByUser}
              navigateToDM={navigateToDM}
              navigate={navigate}
            />
          </div>

          {/* Recent Servers */}
          {servers.length > 0 && (
            <div
              className="relative overflow-hidden rounded-2xl p-5"
              style={{
                background: 'rgba(10, 10, 10, 0.60)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div className={`flex items-center gap-2 ${serversCollapsed ? '' : 'mb-4'}`}>
                <button
                  type="button"
                  onClick={() => setServersCollapsed(v => !v)}
                  aria-label={serversCollapsed ? 'Expand Recent Servers' : 'Collapse Recent Servers'}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${serversCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
                <span className="w-2 h-2 rounded-full bg-red-500"
                  style={{ boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' }} />
                <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">
                  Recent Servers
                </h2>
              </div>
              {!serversCollapsed && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {servers.slice(0, 4).map((server) => (
                  <motion.button
                    key={server.id}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setSelectedServerId(server.id);
                      navigate(`/servers/${server.id}`);
                    }}
                    className="rounded-xl p-3 text-center transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }}
                  >
                    <div className="w-12 h-12 rounded-lg mx-auto mb-2 overflow-hidden">
                      {server.icon_url ? (
                        <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white text-lg font-bold">
                          {server.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{server.name}</p>
                  </motion.button>
                ))}
              </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right rail — ONE unified command column ────────────────────
            Trending Servers, Top Creators (both inside EngagementHub) and
            Jump Back In now stack vertically in a single fixed-width rail
            instead of floating as two separate columns. That gives the main
            dashboard the full remaining width and stops the third column
            from unbalancing the page.

            shrink-0 keeps the rail from being squeezed when the window
            narrows; the inner sticky wrapper keeps the whole stack scroll-
            contained so a long activity list can't push the page taller. */}
        <div className="w-80 shrink-0 hidden lg:block">
          <div className="sticky top-0 max-h-[calc(100vh-1rem)] overflow-y-auto pr-1 py-1 spidr-feed-scroll flex flex-col gap-5">
            <EngagementHub
              currentUser={currentUser}
              onNavigate={(tab) => {
                if (typeof tab === 'string' && tab.startsWith('server-')) {
                  const id = tab.slice('server-'.length);
                  setSelectedServerId?.(id);
                  navigate(`/servers/${id}`);
                  return;
                }
                const routes = {
                  friends: '/friends',
                  servers: '/servers',
                  feed:    '/feed',
                  bots:    '/bots',
                  ai:      '/ai',
                };
                navigate(routes[tab] || `/${tab}`);
              }}
              onNavigateToDM={navigateToDM}
            />
            {/* Jump Back In — tucked directly beneath Top Creators so all
                discovery + navigation widgets share one column. Not sticky
                on its own any more: the parent wrapper owns the sticky
                behaviour for the whole stack, and nesting a second sticky
                inside a scroll container would have pinned it against the
                rail's own scrollbar instead of the viewport. */}
            <SpidrWebMatrix
              className="h-[26rem] shrink-0"
              recentConversations={recentConversations}
              myGroups={myGroups}
              statusByUser={statusByUser}
              avatarByUser={avatarByUser}
              navigateToDM={navigateToDM}
              navigate={navigate}
            />
          </div>
        </div>
      </div>
      <SpidrSystem />
    </div>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────
// Single-purpose glass card. Big numeric/symbolic value on top, small label
// underneath. Tappable — used for Servers/Friends/GIFs shortcuts.
function StatTile({ value, label, onClick, valueClassName = 'text-white' }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-5 text-left transition-all group"
      style={{
        background: 'rgba(10, 10, 10, 0.60)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
        e.currentTarget.style.boxShadow =
          '0 10px 28px rgba(0, 0, 0, 0.4), 0 0 22px rgba(239, 68, 68, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
      }}
    >
      {/* Subtle hover bleed — appears on hover via opacity. */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 100% 50%, rgba(239, 68, 68, 0.08), transparent 70%)',
        }}
      />
      <p className={`relative text-3xl font-bold leading-none mb-2 ${valueClassName}`}>
        {value}
      </p>
      <p className="relative text-zinc-500 text-xs">{label}</p>
    </motion.button>
  );
}
