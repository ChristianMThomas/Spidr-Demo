import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Radio, Wifi } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SignalRadar — Holographic Server Discovery HUD
 *
 * Aesthetic: pure black canvases with glowing red borders, translucent glass
 * panels, and red monochromatic projections of server icons. The whole panel
 * reads like a HUD beamed onto the screen, not a flat UI.
 *
 * Key design choices (from the spec):
 *   • Search bar — pure black with a thin red glowing border; brightens on focus.
 *   • Tabs — hollow glowing pill for the active tab (no solid red block).
 *   • Frequency timeline — 1px laser beam with heavy box-shadow glow; a
 *     hollow circle node with a pulsing center snaps to the active category.
 *   • Server cards — angled clip-path corners, heavily blurred translucent
 *     canvas, server icons projected with mix-blend-luminosity + red overlay
 *     + faint scanlines so they look like holograms.
 *   • Buttons — hollow red outlines that fill on hover.
 */

const CATEGORIES = ['All Signals', 'Gaming', 'Social', 'Tech', 'Creative', 'Study', 'Other'];

export default function SignalRadar({ open, onClose, currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [frequencyIndex, setFrequencyIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [radarTab, setRadarTab] = useState('discover');

  const { data: servers = [] } = useQuery({
    queryKey: ['public-servers'],
    queryFn: () => entities.Server.list('-created_date', 100),
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-radar', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id,
  });

  const friendIds = React.useMemo(() => new Set(friends.map(f => f.friend_id)), [friends]);

  const friendServers = React.useMemo(() => {
    return servers.filter(server =>
      server.members?.some(m => friendIds.has(m.user_id))
    ).map(server => ({
      ...server,
      _friendsInServer: server.members?.filter(m => friendIds.has(m.user_id)) || []
    }));
  }, [servers, friendIds]);

  // Tune the frequency by tapping a category label or by clicking anywhere
  // along the laser line. Cancels the previous transition if you flick through.
  const transitionTimer = useRef(null);
  const tuneTo = (newIndex) => {
    if (newIndex === frequencyIndex) return;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setIsTransitioning(true);
    setFrequencyIndex(newIndex);
    setSelectedCategory(CATEGORIES[newIndex]);
    transitionTimer.current = setTimeout(() => setIsTransitioning(false), 260);
  };
  useEffect(() => () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); }, []);

  const filteredServers = servers.filter(server => {
    const matchesSearch = !searchTerm ||
      server.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All Signals' ||
      server.category?.toLowerCase() === selectedCategory.toLowerCase() ||
      server.description?.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backdropFilter: 'blur(24px)' }}
      >
        {/* Ambient background — deep black with a soft red bleed */}
        <div className="absolute inset-0 bg-black/90" />
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(220,38,38,0.10), transparent 60%),' +
              'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(220,38,38,0.06), transparent 60%)',
          }}
        />
        {/* Faint scanline grain across the whole viewport */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
          }}
        />

        {/* HUD frame */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full h-full max-w-7xl max-h-[92vh] m-6 flex flex-col"
        >
          {/* Header — Sonar icon + title + close button */}
          <Header onClose={onClose} />

          {/* Search bar */}
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            focused={searchFocused}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />

          {/* Hollow glowing tabs */}
          <TabRow
            value={radarTab}
            onChange={setRadarTab}
            friendCount={friendServers.length}
          />

          {radarTab === 'discover' ? (
            <>
              {/* Frequency laser timeline */}
              <FrequencyLaser
                categories={CATEGORIES}
                index={frequencyIndex}
                onTune={tuneTo}
              />

              {/* Server grid */}
              <div className="flex-1 overflow-y-auto pt-6 pr-1 -mr-1 spidr-radar-scroll">
                <AnimatePresence mode="wait">
                  {isTransitioning ? (
                    <FrequencyJam key="jam" />
                  ) : (
                    <motion.div
                      key={selectedCategory}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-2"
                    >
                      {filteredServers.length === 0 ? (
                        <EmptyState />
                      ) : (
                        filteredServers.map((server, i) => (
                          <ServerHologram
                            key={server.id}
                            server={server}
                            currentUser={currentUser}
                            index={i}
                          />
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto pt-6 spidr-radar-scroll">
              {friendServers.length === 0 ? (
                <div className="text-center py-20">
                  <Users className="w-12 h-12 text-red-900/50 mx-auto mb-3" />
                  <p className="text-red-400/70 font-mono tracking-wider text-sm">NO FRIEND SIGNALS DETECTED</p>
                  <p className="text-zinc-600 text-xs mt-2 font-mono">your network is silent on this frequency</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-2"
                >
                  {friendServers.map((server, i) => (
                    <ServerHologram
                      key={server.id}
                      server={server}
                      currentUser={currentUser}
                      friendsInServer={server._friendsInServer}
                      index={i}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </motion.div>

        {/* Local style — the styles below are scoped via unique class names
            so they don't leak into the rest of the app. */}
        <style>{`
          @keyframes spidr-scanline {
            0%   { transform: translateY(-100%); }
            100% { transform: translateY(200%); }
          }
          @keyframes spidr-pulse-dot {
            0%, 100% { transform: scale(1);   opacity: 1;   }
            50%      { transform: scale(0.5); opacity: 0.5; }
          }
          @keyframes spidr-sonar-ping {
            0%   { transform: scale(1);   opacity: 0.8; }
            100% { transform: scale(2.4); opacity: 0;   }
          }
          @keyframes spidr-static {
            0%   { background-position: 0 0; }
            100% { background-position: 0 8px; }
          }
          .spidr-radar-scroll::-webkit-scrollbar { width: 6px; }
          .spidr-radar-scroll::-webkit-scrollbar-track { background: transparent; }
          .spidr-radar-scroll::-webkit-scrollbar-thumb {
            background: rgba(220, 38, 38, 0.25);
            border-radius: 3px;
          }
          .spidr-radar-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(220, 38, 38, 0.5);
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
function Header({ onClose }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-4">
        <SonarIcon />
        <div>
          <h2
            className="text-2xl font-bold tracking-[0.25em] text-red-500"
            style={{ textShadow: '0 0 14px rgba(220,38,38,0.45)' }}
          >
            SIGNAL RADAR
          </h2>
          <p className="text-red-900 text-[10px] font-mono tracking-[0.3em] uppercase mt-1">
            Scanning active frequencies...
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Close Signal Radar"
        className="w-9 h-9 flex items-center justify-center text-red-500/70 border border-red-500/20 rounded-md hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function SonarIcon() {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <span
        className="absolute inset-0 rounded-full border border-red-500/70"
        style={{ animation: 'spidr-sonar-ping 2s ease-out infinite' }}
      />
      <span
        className="absolute inset-0 rounded-full border border-red-500/70"
        style={{ animation: 'spidr-sonar-ping 2s ease-out 0.7s infinite' }}
      />
      <span
        className="block w-2.5 h-2.5 rounded-full bg-red-500"
        style={{ boxShadow: '0 0 8px rgba(220,38,38,0.9), 0 0 16px rgba(220,38,38,0.5)' }}
      />
    </div>
  );
}

// ── Search bar ──────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, focused, onFocus, onBlur }) {
  return (
    <div className="mb-4">
      <div
        className="relative bg-black rounded-md transition-all duration-200"
        style={{
          border: '1px solid',
          borderColor: focused ? 'rgba(220, 38, 38, 0.8)' : 'rgba(220, 38, 38, 0.2)',
          boxShadow: focused
            ? '0 0 20px rgba(220, 38, 38, 0.25), inset 0 0 12px rgba(220, 38, 38, 0.05)'
            : 'inset 0 0 8px rgba(220, 38, 38, 0.04)',
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Locate signals..."
          className="w-full bg-transparent px-4 py-3 text-red-100 placeholder:text-red-900 placeholder:tracking-wider placeholder:font-mono placeholder:text-sm font-mono text-sm outline-none caret-red-500"
        />
        {/* Tiny corner ticks — pure ornament so the field reads as a HUD field */}
        <span className="absolute -top-px left-2 w-2 h-px bg-red-500/60" />
        <span className="absolute -top-px right-2 w-2 h-px bg-red-500/60" />
        <span className="absolute -bottom-px left-2 w-2 h-px bg-red-500/60" />
        <span className="absolute -bottom-px right-2 w-2 h-px bg-red-500/60" />
      </div>
    </div>
  );
}

// ── Tab row ─────────────────────────────────────────────────────────────────
function TabRow({ value, onChange, friendCount }) {
  const tabs = [
    { id: 'discover', label: 'DISCOVER',         icon: Radio },
    { id: 'friends',  label: 'FRIENDS',          icon: Users, badge: friendCount },
  ];
  return (
    <div className="flex items-center gap-3 mb-5">
      {tabs.map((tab) => {
        const Active = value === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`group relative px-5 py-2 font-mono text-xs tracking-[0.25em] transition-all duration-200 rounded-md ${
              Active
                ? 'bg-red-500/10 border border-red-500 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.25)]'
                : 'border border-red-500/15 text-red-900 hover:text-red-500/80 hover:border-red-500/40'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon className="w-3 h-3" />
              {tab.label}
              {tab.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-[9px] rounded-sm font-bold ${
                  Active ? 'bg-red-500/30 text-red-200' : 'bg-red-900/60 text-red-500/70'
                }`}>
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Frequency laser timeline ────────────────────────────────────────────────
function FrequencyLaser({ categories, index, onTune }) {
  // Position of each category marker along the line, evenly spaced
  const stops = categories.length;
  const stepPct = stops > 1 ? 100 / (stops - 1) : 0;
  const activeLeftPct = index * stepPct;

  return (
    <div className="mb-2 select-none">
      {/* Top label row */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-red-500/70">
          Frequency Lock: <span className="text-red-400">{categories[index]}</span>
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.3em] uppercase text-emerald-400/80">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="relative rounded-full bg-emerald-400 w-1.5 h-1.5" />
          </span>
          Online
        </span>
      </div>

      {/* The 1px laser beam */}
      <div
        className="relative h-6 flex items-center cursor-pointer"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={stops - 1}
        aria-valuenow={index}
        aria-label="Tune frequency"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft')  onTune(Math.max(0, index - 1));
          if (e.key === 'ArrowRight') onTune(Math.min(stops - 1, index + 1));
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(1, x / rect.width));
          onTune(Math.round(pct * (stops - 1)));
        }}
      >
        {/* The thin laser line */}
        <div
          className="absolute left-0 right-0"
          style={{
            height: '1px',
            background: 'linear-gradient(90deg, rgba(220,38,38,0.15) 0%, rgba(220,38,38,0.55) 50%, rgba(220,38,38,0.15) 100%)',
            boxShadow: '0 0 8px rgba(220,38,38,0.55), 0 0 16px rgba(220,38,38,0.35), 0 0 24px rgba(220,38,38,0.15)',
          }}
        />
        {/* Category tick marks under the line */}
        {categories.map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2"
            style={{
              left: `${i * stepPct}%`,
              transform: 'translate(-50%, -50%)',
              width: i === index ? '1px' : '1px',
              height: i === index ? '8px' : '4px',
              background: i === index ? '#ef4444' : 'rgba(220,38,38,0.35)',
              boxShadow: i === index ? '0 0 6px rgba(220,38,38,0.8)' : 'none',
            }}
          />
        ))}
        {/* The hollow circle node — snaps to the active category */}
        <motion.div
          animate={{ left: `${activeLeftPct}%` }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="absolute top-1/2 pointer-events-none"
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="relative w-4 h-4 rounded-full border-2 border-red-500 bg-black flex items-center justify-center"
            style={{ boxShadow: '0 0 10px rgba(220,38,38,0.6), 0 0 18px rgba(220,38,38,0.3)' }}
          >
            <span
              className="block w-1.5 h-1.5 rounded-full bg-red-500"
              style={{ animation: 'spidr-pulse-dot 1.4s ease-in-out infinite' }}
            />
          </div>
        </motion.div>
      </div>

      {/* Category labels — clickable tuning anchors */}
      <div className="flex justify-between mt-2 font-mono text-[10px] tracking-[0.2em] uppercase">
        {categories.map((cat, i) => (
          <button
            key={cat}
            onClick={() => onTune(i)}
            className={`transition-colors duration-150 ${
              i === index ? 'text-red-400' : 'text-red-900 hover:text-red-500/70'
            }`}
            style={{ textShadow: i === index ? '0 0 8px rgba(220,38,38,0.45)' : 'none' }}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Transition jam (frequency switch) ───────────────────────────────────────
function FrequencyJam() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center py-20"
    >
      <div
        className="w-full h-32 relative overflow-hidden rounded-md"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(220,38,38,0.06) 2px 4px)',
          animation: 'spidr-static 0.16s steps(2) infinite',
          border: '1px solid rgba(220,38,38,0.15)',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-[0.4em] text-red-500/60">
          ▓░  TUNING  ░▓
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="col-span-full text-center py-16">
      <div className="inline-block relative mb-4">
        <Radio className="w-12 h-12 text-red-900/60 mx-auto" />
      </div>
      <p className="text-red-400/70 font-mono tracking-wider text-sm">NO SIGNALS ON THIS FREQUENCY</p>
      <p className="text-zinc-600 text-xs mt-2 font-mono">dial somewhere else on the band</p>
    </div>
  );
}

// ── Server Hologram (the projected server card) ─────────────────────────────
function ServerHologram({ server, currentUser, friendsInServer, index = 0 }) {
  const memberCount = server.members?.length || 0;
  const signalStrength = Math.min(Math.floor(memberCount / 5) + 1, 5);
  // Private / invite-only servers: members can't just walk in. Show a
  // "Request Invite" affordance instead of the standard "Establish Uplink".
  const isPrivate = server.is_public === false;
  const isAlreadyMember = server.members?.some(m => m.user_id === currentUser?.id);
  const hasPendingRequest = (server.join_requests || []).some(r => r.user_id === currentUser?.id);

  const handleJoin = async () => {
    try {
      if (isAlreadyMember) {
        toast.error('Uplink already established with this signal');
        return;
      }
      const isAirlockEnabled = server.airlock?.enabled;
      const updatedMembers = [
        ...(server.members || []),
        {
          user_id: currentUser?.id,
          user_name: currentUser?.full_name,
          user_avatar: currentUser?.avatar_url,
          role: 'member',
          verified: !isAirlockEnabled
        }
      ];
      await entities.Server.update(server.id, { members: updatedMembers });
      toast.success(isAirlockEnabled
        ? 'Uplink pending — awaiting verification.'
        : 'Uplink established. Signal locked.');
    } catch (error) {
      toast.error('Uplink failed');
    }
  };

  // Best-effort invite-request: append a pending request to the server's
  // join_requests array. Server admins can review/approve in their settings.
  // No backend changes required — uses the same Server.update endpoint as
  // membership.
  const handleRequestInvite = async () => {
    if (isAlreadyMember) {
      toast.error('You already have an uplink to this signal');
      return;
    }
    if (hasPendingRequest) {
      toast.info('Invite request already pending — the host will review it.');
      return;
    }
    try {
      const updatedRequests = [
        ...(server.join_requests || []),
        {
          user_id: currentUser?.id,
          user_name: currentUser?.full_name,
          user_avatar: currentUser?.avatar_url,
          requested_at: new Date().toISOString(),
          status: 'pending',
        },
      ];
      await entities.Server.update(server.id, { join_requests: updatedRequests });
      toast.success('Invite request sent — awaiting host approval.');
    } catch {
      toast.error('Could not send invite request');
    }
  };

  // 8-sided clip-path so all four corners are angled
  const clipPath = 'polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="group relative"
    >
      {/* Outer projection plate — the translucent angled canvas */}
      <div
        className="relative p-4 overflow-hidden"
        style={{
          clipPath,
          background: 'rgba(5, 5, 5, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Inner border drawn as an overlay so it follows the clip-path. The
            border lives ON the clipped edge instead of getting cut off. */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-300 group-hover:opacity-100"
          style={{
            clipPath,
            background: `
              linear-gradient(rgba(220,38,38,0.4), rgba(220,38,38,0.4)) top/100% 1px no-repeat,
              linear-gradient(rgba(220,38,38,0.4), rgba(220,38,38,0.4)) bottom/100% 1px no-repeat,
              linear-gradient(rgba(220,38,38,0.4), rgba(220,38,38,0.4)) left/1px 100% no-repeat,
              linear-gradient(rgba(220,38,38,0.4), rgba(220,38,38,0.4)) right/1px 100% no-repeat
            `,
            // The trick: we draw the border with an inset box-shadow that
            // respects the clip-path, since regular borders square the corners.
            boxShadow: 'inset 0 0 0 1px rgba(220,38,38,0.2)',
          }}
        />
        {/* Subtle inner glow on hover */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            clipPath,
            boxShadow: 'inset 0 0 30px rgba(220, 38, 38, 0.15)',
          }}
        />

        {/* Roaming scanline — visible always but faint */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath }}>
          <div
            className="absolute left-0 right-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(220,38,38,0.6), transparent)',
              boxShadow: '0 0 8px rgba(220,38,38,0.6)',
              animation: 'spidr-scanline 4s linear infinite',
              animationDelay: `${(index % 3) * 0.6}s`,
            }}
          />
        </div>

        {/* Faint horizontal scanline grid baked into the whole card */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            clipPath,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(220,38,38,0.04) 3px, rgba(220,38,38,0.04) 4px)',
          }}
        />

        {/* === Content === */}
        <div className="relative z-10">
          {/* Top row — projected server icon + name */}
          <div className="flex items-start gap-3 mb-3">
            <ServerIconProjection
              src={server.icon_url}
              alt={server.name}
              fallbackIcon={<Wifi className="w-6 h-6 text-red-500" />}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="text-white font-bold text-sm truncate">{server.name}</h3>
                {server.verified && (
                  <span className="shrink-0 px-1 py-0.5 border border-red-500/60 rounded-sm text-[8px] font-bold text-red-400 leading-none">
                    VERIFIED
                  </span>
                )}
                {server.boost_level > 0 && (
                  <span className="shrink-0 px-1 py-0.5 border border-red-500/40 rounded-sm text-[8px] font-bold text-red-400 leading-none">
                    ⚡{server.boost_level}
                  </span>
                )}
              </div>
              <p className="text-zinc-500 text-xs line-clamp-2 leading-snug">
                {server.description || 'No telemetry available'}
              </p>
            </div>
          </div>

          {/* Tags */}
          {server.tags && server.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {server.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 border border-red-500/15 rounded-sm text-[9px] text-red-500/70 font-mono tracking-wider uppercase"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Signal strength */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-red-500/60">
                Signal Strength
              </span>
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-emerald-400/80">
                {memberCount} Active
              </span>
            </div>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => {
                const lit = i < signalStrength;
                return (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-[1px]"
                    style={{
                      background: lit
                        ? 'linear-gradient(90deg, rgba(220,38,38,0.9), rgba(220,38,38,0.5))'
                        : 'rgba(220,38,38,0.12)',
                      boxShadow: lit ? '0 0 4px rgba(220,38,38,0.6)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Friends present (only on the Friends tab) */}
          {friendsInServer && friendsInServer.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 border border-red-500/20 rounded-sm bg-red-950/20">
              <Users className="w-3 h-3 text-red-400 shrink-0" />
              <div className="flex -space-x-1.5 shrink-0">
                {friendsInServer.slice(0, 4).map((m, i) => (
                  m.user_avatar ? (
                    <img
                      key={i}
                      src={m.user_avatar}
                      className="w-4 h-4 rounded-full border border-black object-cover"
                      style={{ filter: 'grayscale(0.4)' }}
                    />
                  ) : (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-black bg-red-900/60 flex items-center justify-center text-[7px] text-red-200 font-bold"
                    >
                      {m.user_name?.charAt(0)}
                    </div>
                  )
                ))}
              </div>
              <span className="text-red-400/80 text-[9px] font-mono tracking-wider uppercase truncate">
                {friendsInServer.length} friend{friendsInServer.length !== 1 ? 's' : ''} on-air
              </span>
            </div>
          )}

          {/* Action button — public servers get "Establish Uplink"; private
              ones get a "Request Invite" affordance with a pending-state
              fallback so a user can't double-fire requests. */}
          {isPrivate ? (
            <button
              onClick={handleRequestInvite}
              disabled={hasPendingRequest || isAlreadyMember}
              className={`w-full py-2 border transition-all duration-300 font-mono text-[10px] tracking-[0.3em] uppercase ${
                hasPendingRequest
                  ? 'border-yellow-500/50 text-yellow-400 cursor-not-allowed'
                  : isAlreadyMember
                    ? 'border-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white hover:shadow-[0_0_18px_rgba(168,85,247,0.5)]'
              }`}
              title={isPrivate ? 'This signal is invite-only. Request access from the host.' : ''}
            >
              {hasPendingRequest ? 'Request Pending' : isAlreadyMember ? 'Uplinked' : 'Request Invite'}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              className="w-full py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white hover:shadow-[0_0_18px_rgba(220,38,38,0.5)] transition-all duration-300 font-mono text-[10px] tracking-[0.3em] uppercase"
            >
              Establish Uplink
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Server icon, projected as a red hologram ────────────────────────────────
// The icon is rendered with mix-blend-luminosity then tinted red via an
// overlay. This makes any photo look like a monochrome 3D projection, no
// matter what the user uploaded.
function ServerIconProjection({ src, alt, fallbackIcon }) {
  if (!src) {
    return (
      <div
        className="relative w-14 h-14 border border-red-500/30 bg-red-950/30 flex items-center justify-center overflow-hidden shrink-0"
        style={{
          clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)',
        }}
      >
        {fallbackIcon}
        {/* Corner accent */}
        <span className="absolute top-0 right-0 w-2 h-px bg-red-500" />
        <span className="absolute top-0 right-0 w-px h-2 bg-red-500" />
      </div>
    );
  }
  return (
    <div
      className="relative w-14 h-14 overflow-hidden shrink-0 border border-red-500/30"
      style={{
        clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)',
      }}
    >
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ mixBlendMode: 'luminosity', filter: 'contrast(1.2) brightness(0.85)' }}
      />
      {/* Red tint overlay — this is what turns the photo into a red projection */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(220, 38, 38, 0.55)', mixBlendMode: 'multiply' }}
      />
      {/* Subtle additive glow on top */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(239, 68, 68, 0.15)', mixBlendMode: 'screen' }}
      />
      {/* Scanlines baked into the icon */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0,0,0,0.4) 1px, rgba(0,0,0,0.4) 2px)',
        }}
      />
      {/* Roaming scanline highlight */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,180,180,0.7), transparent)',
          animation: 'spidr-scanline 3s linear infinite',
        }}
      />
      {/* Corner tick marks */}
      <span className="absolute top-0 right-0 w-2 h-px bg-red-300" />
      <span className="absolute top-0 right-0 w-px h-2 bg-red-300" />
      <span className="absolute bottom-0 left-0 w-2 h-px bg-red-300" />
      <span className="absolute bottom-0 left-0 w-px h-2 bg-red-300" />
    </div>
  );
}
