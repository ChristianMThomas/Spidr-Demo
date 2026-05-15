import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, getSocket } from '@/api/apiClient';
import {
  Activity, Users, Server as ServerIcon, MessageSquare, Film, Shield,
  Wifi, Database, Zap, Crown,
} from 'lucide-react';

/**
 * NerveCenter — admin telemetry dashboard.
 *
 * Layout matches the SPIDR NERVE CENTER mock:
 *   • Header: title + LIVE signal pulse
 *   • CORE RESONANCE: 5 ring gauges (GRID TENSION / VOICE NODES / SYMBIOTE PULSE / APEX DENSITY / THREAT INDEX)
 *   • DATA SILK FLOW: two stacked line charts (grid tension over time, latency over time)
 *   • Stat tiles: registered users, active servers, messages, clips, voice sessions, apex members, audio tracks, pending reports
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

    // Subtle gridlines
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
      const y = cssH - padding - ((v / max) * drawableH);
      return [x, y];
    });

    // Filled gradient under the line
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

    // Glowing line
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Trailing dot
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
          {typeof value === 'number' ? (value < 10 ? value.toFixed(1) : Math.round(value)) : value}{unit}
        </span>
      </div>
      <canvas
        ref={ref}
        className="w-full h-[120px] rounded-lg bg-black/30 border border-white/5"
      />
      <div className="flex justify-between text-[8px] text-white/25 font-mono uppercase tracking-widest">
        <span>{label.split(' ')[0]}</span>
        <span>{label.split(' ')[0]}</span>
      </div>
    </div>
  );
}

// ─── Ring Gauge ───────────────────────────────────────────────────────────────
function Ring({ value = 0, max = 100, color = '#FF3333', label, sub, pulse }) {
  const pct = Math.min(value / max, 1);
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
function Tile({ icon: Icon, value, label, sub, color = '#FF3333', pulse }) {
  return (
    <div
      className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 relative overflow-hidden hover:border-white/10 transition-colors"
      style={pulse ? { boxShadow: `inset 0 0 30px ${color}10` } : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '15', border: `1px solid ${color}25` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
        {pulse && (
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
        )}
      </div>
      <div className="text-3xl font-black text-white font-mono leading-none mb-1">
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
      </div>
      <div className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">{label}</div>
      {sub && <div className="text-[9px] text-white/30 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NerveCenter({ currentUser }) {
  const [telemetry, setTelemetry] = useState(null);
  const [connected, setConnected] = useState(false);

  // Socket telemetry stream
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join:nerve-center');
    setConnected(true);
    const onTelemetry = (data) => setTelemetry(data);
    socket.on('server:telemetry', onTelemetry);
    return () => {
      socket.emit('leave:nerve-center');
      socket.off('server:telemetry', onTelemetry);
    };
  }, []);

  // DB metrics (polled, not live)
  const { data: servers = [] } = useQuery({
    queryKey: ['nc-servers'],
    queryFn: () => entities.Server.list('-created_date', 200),
    refetchInterval: 15000,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['nc-users'],
    queryFn: () => entities.UserProfile.list('-created_date', 200),
    refetchInterval: 15000,
  });
  const { data: messages = [] } = useQuery({
    queryKey: ['nc-messages'],
    queryFn: () => entities.Message.list('-created_date', 500),
    refetchInterval: 15000,
  });
  const { data: clips = [] } = useQuery({
    queryKey: ['nc-clips'],
    queryFn: () => entities.Clip.list('-created_date', 200),
    refetchInterval: 15000,
  });
  const { data: audioTracks = [] } = useQuery({
    queryKey: ['nc-audio-tracks'],
    queryFn: () => entities.AudioTrack.list('-created_date', 200),
    refetchInterval: 30000,
  });
  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['nc-voice-sessions'],
    queryFn: () => entities.VoiceSession.list('-created_date', 200),
    refetchInterval: 5000,
  });
  const { data: reports = [] } = useQuery({
    queryKey: ['nc-reports'],
    queryFn: () => entities.Report.filter({ status: 'pending' }),
    refetchInterval: 15000,
  });

  // Derived telemetry indicators
  const onlineUsers = users.filter(u => u.status === 'online').length;
  const apexUsers = users.filter(u => u.apex_tier === 'apex').length;
  const apexPct = users.length > 0 ? (apexUsers / users.length) * 100 : 0;
  const totalMembers = servers.reduce((acc, s) => acc + (s.members?.length || 0), 0);
  const totalViews = clips.reduce((acc, c) => acc + (c.views || 0), 0);

  // GRID TENSION: socket connections relative to max we've seen.
  // Default to telemetry.cpu if connections is not yet reporting.
  const gridTension = telemetry?.cpu ?? 0;
  // SYMBIOTE PULSE: rough latency from telemetry. 0 means we haven't heard back.
  const latency = telemetry?.latency ?? 17;

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="text-[#FF3333]" size={32} strokeWidth={2.5} />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
              SPIDR NERVE CENTER
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.25em] mt-1">
              ADMIN TELEMETRY // LIVE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FF3333]/30 bg-[#FF3333]/5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected && telemetry ? 'bg-[#FF3333] animate-pulse' : 'bg-zinc-600'}`}
            style={connected && telemetry ? { boxShadow: '0 0 6px #FF3333' } : undefined} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF3333] font-mono">
            {connected && telemetry ? 'SIGNAL ACTIVE' : 'AWAITING SIGNAL'}
          </span>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* CORE RESONANCE — SYSTEM VITALS */}
        <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">
            CORE RESONANCE — SYSTEM VITALS
          </p>
          <div className="flex justify-around items-center flex-wrap gap-6">
            <Ring
              value={Math.round(gridTension)} max={100}
              color="#FF3333" label="GRID TENSION"
              sub="%"
              pulse
            />
            <Ring
              value={voiceSessions.length} max={Math.max(voiceSessions.length, 50)}
              color="#A855F7" label="VOICE NODES"
              sub="live"
            />
            <Ring
              value={Math.round(latency)} max={500}
              color="#22D3EE" label="SYMBIOTE PULSE"
              sub="ms"
            />
            <Ring
              value={apexUsers} max={Math.max(users.length, 1)}
              color="#FF3333" label="APEX DENSITY"
              sub="users"
              pulse={apexUsers > 0}
            />
            <Ring
              value={reports.length} max={Math.max(reports.length + 10, 20)}
              color={reports.length > 0 ? '#EF4444' : '#6B7280'}
              label="THREAT INDEX"
              sub="flags"
              pulse={reports.length > 0}
            />
          </div>
        </section>

        {/* DATA SILK FLOW — LIVE SIGNAL MONITOR */}
        <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">
            DATA SILK FLOW — LIVE SIGNAL MONITOR
          </p>
          <div className="space-y-6">
            <LineCanvas
              history={telemetry?.history?.cpu || []}
              color="#FF3333"
              max={100}
              label="GRID TENSION"
              value={gridTension}
              unit="%"
            />
            <LineCanvas
              history={telemetry?.history?.connections || []}
              color="#22D3EE"
              max={Math.max(...(telemetry?.history?.connections || [50]), 50)}
              label="SYMBIOTE PULSE (LATENCY)"
              value={latency}
              unit="ms"
            />
          </div>
        </section>

        {/* STAT TILES */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile
            icon={Users}
            value={users.length}
            label="Registered Users"
            sub={`${onlineUsers} online`}
            color="#22D3EE"
            pulse={onlineUsers > 0}
          />
          <Tile
            icon={ServerIcon}
            value={servers.length}
            label="Active Servers"
            sub={`${totalMembers} total members`}
            color="#A855F7"
          />
          <Tile
            icon={MessageSquare}
            value={messages.length}
            label="Messages Sent"
            sub="all time"
            color="#10B981"
          />
          <Tile
            icon={Film}
            value={clips.length}
            label="Clips Posted"
            sub={`${totalViews.toLocaleString()} views`}
            color="#F59E0B"
          />
          <Tile
            icon={Wifi}
            value={voiceSessions.length}
            label="Voice Sessions"
            sub="currently in call"
            color="#FF3333"
            pulse={voiceSessions.length > 0}
          />
          <Tile
            icon={Crown}
            value={apexUsers}
            label="APEX Members"
            sub={`${apexPct.toFixed(0)}% of users`}
            color="#EAB308"
          />
          <Tile
            icon={Database}
            value={audioTracks.length}
            label="Audio Tracks"
            sub="in library"
            color="#06B6D4"
          />
          <Tile
            icon={Shield}
            value={reports.length}
            label="Pending Reports"
            sub="need review"
            color={reports.length > 0 ? '#EF4444' : '#6B7280'}
            pulse={reports.length > 0}
          />
        </section>

        {/* SERVER TOPOLOGY — NODE REGISTRY (preview) */}
        <section className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">
            SERVER TOPOLOGY — NODE REGISTRY
          </p>
          {servers.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-6 font-mono">NO_SERVERS</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {servers.slice(0, 10).map(server => (
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
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">ACTIVE</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
