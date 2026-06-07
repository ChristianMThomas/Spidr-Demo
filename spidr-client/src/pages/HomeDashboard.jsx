import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { useAppShell } from '@/context/AppShellContext';
import SpiderLogo from '@/components/spidr/SpiderLogo';
import DiscoverUsers from '@/components/spidr/DiscoverUsers';
import EnhancedFeed from '@/components/spidr/EnhancedFeed';
import EngagementHub from '@/components/spidr/EngagementHub';
import TensionBar from '@/components/spidr/TensionBar';
import SpidrSystem from '@/components/spidr/SpidrSystem';

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
  const { currentUser, setSelectedServerId, navigateToDM } = useAppShell();
  const navigate = useNavigate();

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

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  // Best-effort first-name extraction for the greeting. Falls back to the
  // full name, then the username, then "spider".
  const greetingName =
    (currentUser?.full_name || '').split(' ')[0] ||
    currentUser?.username ||
    'spider';

  // ── APEX custom background ──────────────────────────────────────────────
  // Pulls the current user's uploaded `apex_features.custom_bg_url` (set in
  // ApexVisuals) into the dashboard. Until now this image only painted
  // inside the HolographicProfile modal — the home page ignored it
  // entirely, which was the reported bug.
  // We respect the user's chosen opacity slider (0–100), then layer a
  // dark-bottom gradient on top so foreground glass cards still read
  // clearly even against bright artwork.
  const isApex = currentUser?.apex_tier === 'apex';
  const apexBgUrl = currentUser?.apex_features?.custom_bg_url;
  const apexBgOpacity = (currentUser?.apex_features?.custom_bg_opacity ?? 40) / 100;
  const hasCustomBg = !!(isApex && apexBgUrl);

  return (
    <div className="flex-1 bg-[#050505] overflow-y-auto relative">
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

      {/* ── APEX custom background ──────────────────────────────────────
          A sticky-positioned wrapper keeps the image painted at the top
          of the visible dashboard area as the user scrolls the content
          below — so the background reads as the page's canvas, not as
          something that scrolls away after the first viewport. The two
          siblings (image + dark gradient) sit inside this wrapper so the
          legibility mask travels with the image. */}
      {hasCustomBg && (
        <div
          className="sticky top-0 left-0 right-0 h-screen pointer-events-none overflow-hidden -mb-screen"
          style={{ marginBottom: '-100vh', zIndex: 0 }}
          aria-hidden="true"
        >
          <img
            src={apexBgUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: apexBgOpacity, filter: 'saturate(1.15)' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          {/* Legibility gradient — slightly darker at the bottom where the
              activity feed sits, so dense text cards keep their contrast.
              Top stays lighter so the welcome banner's red glow + the
              user's artwork breathe together. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(5,5,5,0.45) 0%, rgba(5,5,5,0.65) 45%, rgba(5,5,5,0.88) 100%)',
            }}
          />
        </div>
      )}

      {/* Ambient page glow — faint red bleed top-right + cool blue bleed
          bottom-left, so the dashboard reads as a Spidr canvas rather than
          a flat black page. Hidden when an APEX custom background is set
          (the artwork takes the canvas role then). */}
      {!hasCustomBg && (
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
              background: 'rgba(10, 10, 10, 0.65)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
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
              {/* Mascot housing — circular tinted container with subtle
                  purple→red gradient halo behind the logo. */}
              <div className="relative shrink-0">
                <div
                  className="absolute inset-0 rounded-full blur-md opacity-60"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(168, 85, 247, 0.5), rgba(239, 68, 68, 0.3) 60%, transparent 80%)',
                  }}
                />
                <div
                  className="relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 30%, rgba(168, 85, 247, 0.18), rgba(20, 10, 22, 0.95) 70%)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    boxShadow:
                      '0 0 18px rgba(239, 68, 68, 0.35), inset 0 0 14px rgba(168, 85, 247, 0.15)',
                  }}
                >
                  <SpiderLogo size={42} />
                </div>
              </div>

              {/* Copy block */}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] tracking-[0.32em] uppercase text-red-400/90 mb-1">
                  Welcome Back
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                  Hey, <span className="text-red-500">{greetingName}</span>
                </h1>
                <p className="text-zinc-500 text-sm mt-0.5">Your web is waiting</p>
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
                <span className="relative flex items-center justify-center w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
                  <span className="relative w-2 h-2 rounded-full bg-red-500" />
                </span>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">
                  Activity Feed
                </h2>
              </div>
              <button
                onClick={() => navigate('/feed')}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-400/80 hover:text-red-300 transition-colors"
              >
                View All →
              </button>
            </div>

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
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-red-500"
                  style={{ boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' }} />
                <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">
                  Recent Servers
                </h2>
              </div>
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
            </div>
          )}
        </div>

        {/* ── Right rail — Activity / engagement still sticky-contained so
            it doesn't push the homepage taller when populated. */}
        <div className="w-72 shrink-0 hidden lg:block">
          <div className="sticky top-0 max-h-[calc(100vh-1rem)] overflow-y-auto pr-1 py-1 spidr-feed-scroll">
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
