import React, { useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import {
  Activity, Users, Server as ServerIcon, MessageSquare, Film,
  Heart, Crown, Zap, Hash, Calendar, Clock,
} from 'lucide-react';

/**
 * NerveCenter — personal stats dashboard for the viewing user.
 *
 * Same visual style as the original mock (CORE RESONANCE ring gauges,
 * DATA SILK FLOW line charts, stat tiles), but every metric is scoped to
 * the current user's own activity rather than platform-wide telemetry.
 */

// ─── Line Chart Canvas ────────────────────────────────────────────────────────
function LineCanvas({ history = [], color = '#FF3333', max = 100, label, value, unit = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    // Gridlines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (cssH / 4) * i);
      ctx.lineTo(cssW, (cssH / 4) * i);
      ctx.stroke();
    }

    if (!history.length) return;

    const padding = 4;
    const drawableH = cssH - padding * 2;
    const points = history.map((v, i) => {
      const x = (i / Math.max(history.length - 1, 1)) * cssW;
      const y = cssH - padding - ((v / Math.max(max, 1)) * drawableH);
      return [x, y];
    });

    const grad = ctx.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, color + '50');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0][0], cssH);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], cssH);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    const [lx, ly] = points[points.length - 1];
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx - 1, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }, [history, color, max]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 font-mono">{label}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 font-mono">
          {typeof value === 'number' ? Math.round(value) : value}{unit}
        </span>
      </div>
      <canvas ref={ref} className="w-full h-[120px] rounded-lg bg-black/30 border border-white/5" />
    </div>
  );
}

// ─── Ring Gauge ───────────────────────────────────────────────────────────────
function Ring({ value = 0, max = 100, color = '#FF3333', label, sub, pulse }) {
  const pct = Math.min(value / Math.max(max, 1), 1);
  const r = 30, cx = 36, cy = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const active = pct > 0;

  return (
    <div className="flex flex-col items-center gap-2 min-w-[120px]">
      <div className="relative w-[72px] h-[72px]">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
          {active && (
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${color})`,
                transition: 'stroke-dasharray 0.5s ease',
              }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black font-mono text-white leading-none">
            {Math.round(value)}
          </span>
          {sub && <span className="text-[7px] font-mono text-white/40 mt-0.5 uppercase">{sub}</span>}
        </div>
        {pulse && active && (
          <div
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
          />
        )}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 font-mono">{label}</span>
    </div>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function Tile({ icon: Icon, value, label, sub, color = '#FF3333' }) {
  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 relative overflow-hidden hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '15', border: `1px solid ${color}25` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div className="text-3xl font-black text-white font-mono leading-none mb-1">
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
      </div>
      <div className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">{label}</div>
      {sub && <div className="text-[9px] text-white/30 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildDailyHistogram(messages, days = 14) {
  // Returns an array of message counts per day, oldest → newest
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  const dayMs = 86400000;
  for (const m of messages) {
    const t = new Date(m.created_date).getTime();
    const daysAgo = Math.floor((now - t) / dayMs);
    if (daysAgo >= 0 && daysAgo < days) {
      buckets[days - 1 - daysAgo]++;
    }
  }
  return buckets;
}

function buildActivityScore(buckets) {
  // Activity score = recent 3 days' messages / max-day-in-window, 0-100
  const recent3 = buckets.slice(-3).reduce((a, b) => a + b, 0);
  const peak = Math.max(...buckets, 1);
  return Math.min(100, Math.round((recent3 / (peak * 3 || 1)) * 100));
}

function calcStreak(buckets) {
  // Streak = number of consecutive most-recent days with ≥1 message
  let streak = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i] > 0) streak++;
    else break;
  }
  return streak;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NerveCenter({ currentUser }) {
  const userId = currentUser?.id;

  // Pull everything scoped to this user. All best-effort — empty arrays on fail.
  const { data: myMessages = [] } = useQuery({
    queryKey: ['nc-my-messages', userId],
    queryFn: () => entities.Message.filter({ author_id: userId }),
    enabled: !!userId,
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const { data: myDMs = [] } = useQuery({
    queryKey: ['nc-my-dms', userId],
    queryFn: () => entities.DirectMessage.filter({ sender_id: userId }),
    enabled: !!userId,
    refetchInterval: 120000,
  });

  const { data: myFriends = [] } = useQuery({
    queryKey: ['nc-my-friends', userId],
    queryFn: () => entities.Friend.filter({ user_id: userId, status: 'accepted' }),
    enabled: !!userId,
    refetchInterval: 120000,
  });

  const { data: allServers = [] } = useQuery({
    queryKey: ['nc-all-servers'],
    queryFn: () => entities.Server.list('-created_date', 200),
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const { data: myClips = [] } = useQuery({
    queryKey: ['nc-my-clips', userId],
    queryFn: () => entities.Clip.filter({ author_id: userId }),
    enabled: !!userId,
    refetchInterval: 120000,
  });

  const { data: myProfile } = useQuery({
    queryKey: ['nc-my-profile', userId],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: userId });
      return profiles[0];
    },
    enabled: !!userId,
  });

  // ── Derived stats ──────────────────────────────────────────────────────────
  const myServers = allServers.filter(s =>
    s.owner_id === userId || (s.members || []).some(m => m.user_id === userId)
  );

  const messageHistory = useMemo(() => buildDailyHistogram(myMessages, 14), [myMessages]);
  const dmHistory      = useMemo(() => buildDailyHistogram(myDMs, 14), [myDMs]);

  const totalMsgs = myMessages.length + myDMs.length;
  const todayMsgs = messageHistory[messageHistory.length - 1] + dmHistory[dmHistory.length - 1];
  const activityScore = buildActivityScore(messageHistory.map((v, i) => v + (dmHistory[i] || 0)));
  const streak = calcStreak(messageHistory.map((v, i) => v + (dmHistory[i] || 0)));
  const friendsOf = myFriends.length;
  const serversOf = myServers.length;
  const isApex = myProfile?.apex_tier === 'apex';

  // Account age in days
  const accountAgeDays = useMemo(() => {
    if (!myProfile?.created_date) return 0;
    return Math.floor((Date.now() - new Date(myProfile.created_date).getTime()) / 86400000);
  }, [myProfile]);

  // Reaction-count style "engagement" metric — average reactions received per message
  const totalReactionsReceived = myMessages.reduce((acc, m) => {
    if (!m.reactions || typeof m.reactions !== 'object') return acc;
    return acc + Object.values(m.reactions).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
  }, 0);
  const avgReactionsPerMsg = myMessages.length > 0 ? (totalReactionsReceived / myMessages.length) : 0;

  // Total clip views (vanity metric, but a nice one)
  const totalClipViews = myClips.reduce((acc, c) => acc + (c.views || 0), 0);

  const displayName = myProfile?.display_name || currentUser?.full_name || 'You';

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="text-[#FF3333]" size={32} strokeWidth={2.5} />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
              NERVE CENTER
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.25em] mt-1">
              YOUR SPIDR // PERSONAL TELEMETRY
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FF3333]/30 bg-[#FF3333]/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF3333] animate-pulse"
            style={{ boxShadow: '0 0 6px #FF3333' }} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF3333] font-mono">
            {displayName}
          </span>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* CORE RESONANCE — YOUR VITALS */}
        <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">
            CORE RESONANCE — YOUR VITALS
          </p>
          <div className="flex justify-around items-center flex-wrap gap-6">
            <Ring
              value={activityScore} max={100}
              color="#FF3333" label="ACTIVITY"
              sub="%" pulse={activityScore > 50}
            />
            <Ring
              value={streak} max={Math.max(streak, 14)}
              color="#F59E0B" label="STREAK"
              sub="days" pulse={streak > 0}
            />
            <Ring
              value={friendsOf} max={Math.max(friendsOf + 5, 25)}
              color="#22D3EE" label="FRIENDS"
              sub="users"
            />
            <Ring
              value={serversOf} max={Math.max(serversOf + 2, 10)}
              color="#A855F7" label="SERVERS"
              sub="joined"
            />
            <Ring
              value={Math.round(avgReactionsPerMsg * 10)} max={50}
              color={isApex ? '#EAB308' : '#10B981'} label="ENGAGEMENT"
              sub="avg"
            />
          </div>
        </section>

        {/* DATA SILK FLOW — YOUR ACTIVITY */}
        <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">
            DATA SILK FLOW — LAST 14 DAYS
          </p>
          <div className="space-y-6">
            <LineCanvas
              history={messageHistory}
              color="#FF3333"
              max={Math.max(...messageHistory, 5)}
              label="SERVER MESSAGES"
              value={messageHistory.reduce((a, b) => a + b, 0)}
              unit=" total"
            />
            <LineCanvas
              history={dmHistory}
              color="#22D3EE"
              max={Math.max(...dmHistory, 5)}
              label="DIRECT MESSAGES SENT"
              value={dmHistory.reduce((a, b) => a + b, 0)}
              unit=" total"
            />
          </div>
        </section>

        {/* STAT TILES */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile
            icon={MessageSquare}
            value={totalMsgs}
            label="Total Messages"
            sub={`${todayMsgs} today`}
            color="#FF3333"
          />
          <Tile
            icon={Users}
            value={friendsOf}
            label="Friends"
            sub="accepted connections"
            color="#22D3EE"
          />
          <Tile
            icon={ServerIcon}
            value={serversOf}
            label="Servers Joined"
            sub={myServers.filter(s => s.owner_id === userId).length + ' owned'}
            color="#A855F7"
          />
          <Tile
            icon={Film}
            value={myClips.length}
            label="Clips Posted"
            sub={`${totalClipViews.toLocaleString()} total views`}
            color="#F59E0B"
          />
          <Tile
            icon={Heart}
            value={totalReactionsReceived}
            label="Reactions Received"
            sub={`${avgReactionsPerMsg.toFixed(1)} avg per message`}
            color="#EC4899"
          />
          <Tile
            icon={Zap}
            value={streak}
            label="Day Streak"
            sub={streak > 0 ? 'keep it going!' : 'start chatting today'}
            color="#F59E0B"
          />
          <Tile
            icon={isApex ? Crown : Calendar}
            value={accountAgeDays}
            label={isApex ? 'APEX Member' : 'Days on Spidr'}
            sub={isApex ? 'thanks for supporting' : 'account age'}
            color={isApex ? '#EAB308' : '#10B981'}
          />
          <Tile
            icon={Clock}
            value={todayMsgs}
            label="Today"
            sub="messages sent"
            color="#06B6D4"
          />
        </section>

        {/* SERVER MEMBERSHIP REGISTRY */}
        <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">
            YOUR SERVERS — MEMBERSHIP REGISTRY
          </p>
          {myServers.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-6 font-mono">
              NOT_IN_ANY_SERVERS — Join one to see it here.
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {myServers.slice(0, 10).map(server => {
                const isOwner = server.owner_id === userId;
                return (
                  <div
                    key={server.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-black/30 border border-white/5"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                      {server.icon_url ? (
                        <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-950 flex items-center justify-center text-white text-sm font-black">
                          {server.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{server.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {(server.members?.length || 0)} members · {(server.channels?.length || 0)} channels
                      </p>
                    </div>
                    {isOwner ? (
                      <span className="text-[9px] uppercase tracking-widest font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        Owner
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">Member</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
