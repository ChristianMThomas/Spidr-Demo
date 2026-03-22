import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, getSocket } from '@/api/apiClient';
import { motion } from 'framer-motion';
import {
  Activity, Users, Server, MessageSquare, Film, Shield,
  Wifi, Database, Zap, Cpu, MemoryStick, Clock
} from 'lucide-react';

// ─── EKG Canvas Chart ────────────────────────────────────────────────────────
function EKGCanvas({ history = [], color = '#FF3333', label, value, unit = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (height / 4) * i);
      ctx.lineTo(width, (height / 4) * i);
      ctx.stroke();
    }

    if (!history.length) return;

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    const max = Math.max(...history, 1);
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - (v / max) * height * 0.85 - height * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under line
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Current value dot
    const lastX = width;
    const lastV = history[history.length - 1] || 0;
    const lastY = height - (lastV / max) * height * 0.85 - height * 0.05;
    ctx.beginPath();
    ctx.arc(lastX - 2, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();

  }, [history, color]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</span>
        <span className="text-xs font-black font-mono" style={{ color }}>
          {typeof value === 'number' ? value.toFixed(value < 10 ? 1 : 0) : value}{unit}
        </span>
      </div>
      <canvas ref={canvasRef} width={280} height={48}
        className="w-full rounded-lg border border-white/5 bg-black/30" />
    </div>
  );
}

// ─── Glowing Ring Gauge ───────────────────────────────────────────────────────
function RingGauge({ value = 0, max = 100, color = '#FF3333', label, sub }) {
  const pct = Math.min(value / max, 1);
  const r = 32, cx = 40, cy = 40;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black font-mono text-white leading-none">
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</span>
      {sub && <span className="text-[8px] font-mono text-white/25">{sub}</span>}
    </div>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ icon: Icon, label, value, sub, color = '#FF3333', pulse }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }}
      className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2 relative overflow-hidden">
      {pulse && (
        <div className="absolute inset-0 rounded-xl animate-pulse opacity-5"
          style={{ backgroundColor: color }} />
      )}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</span>
      </div>
      <div className="text-2xl font-black text-white font-mono leading-none">
        {typeof value === 'number' ? value.toLocaleString() : (value || '—')}
      </div>
      {sub && <div className="text-[9px] text-white/25 font-mono">{sub}</div>}
    </motion.div>
  );
}

// ─── Main NerveCenter ─────────────────────────────────────────────────────────
export default function NerveCenter({ currentUser }) {
  const [telemetry, setTelemetry] = useState(null);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);

  // Join nerve-center telemetry room via Socket.io
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join:nerve-center');
    setConnected(true);

    socket.on('server:telemetry', (data) => {
      setTelemetry(data);
      setTick(t => t + 1);
    });

    return () => {
      socket.emit('leave:nerve-center');
      socket.off('server:telemetry');
    };
  }, []);

  // DB stats via REST (less frequent)
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
    queryFn: () => entities.Message.list('-created_date', 200),
    refetchInterval: 15000,
  });
  const { data: clips = [] } = useQuery({
    queryKey: ['nc-clips'],
    queryFn: () => entities.Clip.list('-created_date', 200),
    refetchInterval: 15000,
  });
  const { data: reports = [] } = useQuery({
    queryKey: ['nc-reports'],
    queryFn: () => entities.Report.filter({ status: 'pending' }),
    refetchInterval: 15000,
  });

  const totalViews = clips.reduce((acc, c) => acc + (c.views || 0), 0);

  // Format uptime
  const fmt = (s) => {
    if (!s) return '—';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-[#050505] flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-2 h-2 rounded-full ${connected && telemetry ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] font-mono">
              {connected && telemetry ? 'LIVE_SIGNAL' : 'AWAITING_SIGNAL'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Nerve <span className="text-[#FF3333]">Center</span>
          </h1>
        </div>

        {telemetry && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Uptime</p>
              <p className="text-sm font-black font-mono text-green-400">{fmt(telemetry.uptime)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Node</p>
              <p className="text-sm font-black font-mono text-zinc-300">{telemetry.nodeVersion}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Server Vitals (real-time) ── */}
        {telemetry ? (
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">
              SERVER VITALS — LIVE
            </p>

            {/* Ring gauges */}
            <div className="flex justify-around mb-6 bg-black/30 border border-white/5 rounded-2xl p-5">
              <RingGauge
                value={telemetry.cpu} max={100}
                color="#FF3333" label="CPU"
                sub={`${telemetry.cpu.toFixed(1)}%`}
              />
              <RingGauge
                value={telemetry.ramPct} max={100}
                color="#8B5CF6" label="RAM"
                sub={`${telemetry.ram}MB / ${telemetry.ramTotal}MB`}
              />
              <RingGauge
                value={Math.min(telemetry.connections, 100)} max={100}
                color="#22D3EE" label="SOCKETS"
                sub={`${telemetry.connections} active`}
              />
            </div>

            {/* EKG charts */}
            <div className="space-y-4 bg-black/30 border border-white/5 rounded-2xl p-5">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">EKG READOUT</p>
              <EKGCanvas history={telemetry.history?.cpu || []}     color="#FF3333" label="CPU Load"        value={telemetry.cpu}         unit="%" />
              <EKGCanvas history={telemetry.history?.ram || []}     color="#8B5CF6" label="RAM Usage"       value={telemetry.ramPct}      unit="%" />
              <EKGCanvas history={telemetry.history?.connections || []} color="#22D3EE" label="Grid Tension" value={telemetry.connections} unit=" sockets" />
            </div>
          </div>
        ) : (
          <div className="bg-black/30 border border-white/5 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-zinc-700 border-t-[#FF3333] animate-spin mx-auto mb-4" />
            <p className="text-zinc-500 text-sm font-bold">Connecting to server telemetry…</p>
            <p className="text-zinc-700 text-xs mt-1">Make sure the backend is running</p>
          </div>
        )}

        {/* ── DB Stats ── */}
        <div>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">
            DATABASE METRICS
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatTile icon={Server}       label="Servers"      value={servers.length}   color="#FF3333"  pulse={servers.length > 0} />
            <StatTile icon={Users}        label="Users"        value={users.length}     color="#8B5CF6"  pulse={users.length > 0} />
            <StatTile icon={MessageSquare} label="Messages"    value={messages.length}  color="#22D3EE"  />
            <StatTile icon={Film}         label="Clips"        value={clips.length}     sub={`${totalViews.toLocaleString()} views`} color="#F59E0B" />
            <StatTile icon={Shield}       label="Pending Reports" value={reports.length} color={reports.length > 0 ? '#EF4444' : '#6B7280'} pulse={reports.length > 0} />
            <StatTile icon={Wifi}         label="Connections"  value={telemetry?.connections ?? '—'} color="#10B981" />
          </div>
        </div>

      </div>
    </div>
  );
}
