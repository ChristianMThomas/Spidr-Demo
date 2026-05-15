import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth } from '@/api/apiClient';
import {
  AlertTriangle, Eye, X, Check, Ban, Unlock, Activity,
} from 'lucide-react';
import BanModal from '../components/spidr/BanModal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Pill / badge palettes ───────────────────────────────────────────────────
// Severity badge — solid color background matching the image
const SEVERITY_PILL = {
  low:      { bg: 'bg-blue-500',    text: 'text-white' },
  medium:   { bg: 'bg-yellow-500',  text: 'text-black' },
  high:     { bg: 'bg-orange-500',  text: 'text-white' },
  critical: { bg: 'bg-red-600',     text: 'text-white' },
};
// Severity side-bar (vertical pill on the left of each report row)
const SEVERITY_BAR = {
  low:      'bg-blue-500',
  medium:   'bg-yellow-500',
  high:     'bg-orange-500',
  critical: 'bg-red-600',
};
// Status badge — colored translucent
const STATUS_PILL = {
  pending:   { bg: 'bg-yellow-500',  text: 'text-black' },
  reviewing: { bg: 'bg-blue-500',    text: 'text-white' },
  resolved:  { bg: 'bg-green-500',   text: 'text-white' },
  dismissed: { bg: 'bg-zinc-500',    text: 'text-white' },
  escalated: { bg: 'bg-red-600',     text: 'text-white' },
};

// Small colored "pulse" version of the Activity icon for the header
function PulseIcon({ size = 28, color = '#FF3333' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12h3l2-6 4 12 3-9 2 6 2-3h4"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

export default function GlobalReports() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [filter, setFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);
  const [banTarget, setBanTarget] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    auth.me().then(user => {
      setCurrentUser(user);
      if (user.role === 'admin') {
        setAuthorized(true);
      }
    }).catch(() => {});
  }, []);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['global-reports'],
    queryFn: () => entities.Report.list('-created_date', 200),
    enabled: authorized,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => entities.Report.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-reports'] });
      toast.success('Report updated');
      setSelectedReport(null);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId) => {
      const profiles = await entities.UserProfile.filter({ user_id: userId });
      if (!profiles.length) throw new Error('Profile not found');
      await entities.UserProfile.update(profiles[0].id, {
        is_banned: false,
        ban_reason: '',
        ban_until: '',
        banned_by: '',
        ban_report_id: '',
      });
    },
    onSuccess: () => {
      toast.success('User unbanned');
      queryClient.invalidateQueries({ queryKey: ['global-reports'] });
    },
  });

  const filtered = reports.filter(r => {
    const statusMatch = filter === 'all' || r.status === filter;
    const severityMatch = severityFilter === 'all' || r.severity === severityFilter;
    return statusMatch && severityMatch;
  });

  const stats = {
    total:     reports.length,
    pending:   reports.filter(r => r.status === 'pending').length,
    escalated: reports.filter(r => r.status === 'escalated').length,
    critical:  reports.filter(r => r.severity === 'critical').length,
  };

  if (!authorized) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4 opacity-30" />
          <p className="text-red-500 font-bold text-lg uppercase">Access Denied</p>
          <p className="text-gray-600 text-sm mt-2">Only app admins can access global reports</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black text-white overflow-hidden">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-6 pb-5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-4 mb-1">
          <PulseIcon size={32} />
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white leading-none">
              GLOBAL OVERWATCH
            </h1>
            <p className="text-[10px] text-[#FF3333] font-mono uppercase tracking-[0.25em] mt-2">
              AUTH: {currentUser?.email || '—'} &nbsp;•&nbsp; CLEARANCE: ADMIN
            </p>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────────── */}
      <div className="px-8 py-5 grid grid-cols-4 gap-4 flex-shrink-0">
        <StatCard
          number={stats.total}
          label="Total Reports"
          color="white"
        />
        <StatCard
          number={stats.pending}
          label="Pending"
          color="yellow"
        />
        <StatCard
          number={stats.escalated}
          label="Escalated"
          color="orange"
        />
        <StatCard
          number={stats.critical}
          label="Critical"
          color="red"
        />
      </div>

      {/* ── FILTERS ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-3 border-y border-white/5 flex items-center gap-4 flex-shrink-0 flex-wrap">
        {/* Status filter — red active state */}
        <div className="flex gap-1 bg-zinc-900/50 rounded-lg p-1">
          {['all', 'pending', 'escalated', 'reviewing', 'resolved', 'dismissed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                filter === f
                  ? 'bg-[#FF3333] text-white shadow-[0_0_10px_rgba(255,51,51,0.3)]'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Severity filter — black/dark active state */}
        <div className="flex gap-1 bg-zinc-900/50 rounded-lg p-1 ml-auto">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                severityFilter === s
                  ? 'bg-zinc-700/80 text-white border border-white/10'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── REPORTS LIST ───────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="px-8 py-5 space-y-3">
          {isLoading && (
            <p className="text-zinc-600 text-center py-12 font-mono text-xs uppercase tracking-widest">
              LOADING REPORTS…
            </p>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-20 text-zinc-700 font-mono text-xs uppercase tracking-widest">
              NO MATCHING REPORTS
            </div>
          )}

          <AnimatePresence>
            {filtered.map(report => (
              <ReportRow
                key={report.id}
                report={report}
                onClick={() => setSelectedReport(report)}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* ── DETAIL MODAL ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedReport && (
          <div
            className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0a0a0a] border border-red-900/30 rounded-2xl overflow-hidden"
            >
              <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={18} />
                  <span className="font-bold text-white uppercase text-sm">
                    Report #{selectedReport.id?.toString().slice(-6)}
                  </span>
                </div>
                <button onClick={() => setSelectedReport(null)} className="text-gray-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#111] rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Target</p>
                    <p className="text-white font-semibold text-sm">{selectedReport.target_name}</p>
                    <p className="text-[10px] text-gray-600 font-mono">{selectedReport.target_type} • {selectedReport.target_id}</p>
                  </div>
                  <div className="bg-[#111] rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Reporter</p>
                    <p className="text-white font-semibold text-sm">{selectedReport.reporter_name}</p>
                    <p className="text-[10px] text-gray-600 font-mono">{new Date(selectedReport.created_date).toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-[#111] rounded-lg p-3 flex items-center gap-3 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${SEVERITY_PILL[selectedReport.severity]?.bg} ${SEVERITY_PILL[selectedReport.severity]?.text}`}>
                    {selectedReport.severity}
                  </span>
                  <span className="text-xs font-black text-white uppercase">{selectedReport.reason}</span>
                  {selectedReport.server_name && (
                    <span className="text-[10px] text-gray-500 ml-auto">Server: {selectedReport.server_name}</span>
                  )}
                </div>

                {selectedReport.details && (
                  <div className="bg-[#111] rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Details</p>
                    <p className="text-sm text-gray-300">{selectedReport.details}</p>
                  </div>
                )}

                {selectedReport.target_content && (
                  <div className="bg-[#111] rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Reported Content</p>
                    <p className="text-sm text-gray-400">{selectedReport.target_content}</p>
                  </div>
                )}

                {selectedReport.evidence_urls?.length > 0 && (
                  <div className="bg-[#111] rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Evidence</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedReport.evidence_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="evidence" className="w-24 h-24 rounded-lg object-cover border border-white/10 hover:border-red-500 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selectedReport.resolution && (
                  <div className="bg-[#111] rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Resolution</p>
                    <p className="text-sm text-gray-400">{selectedReport.resolution}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-[#050505] flex gap-2 flex-wrap">
                {(selectedReport.status === 'pending' || selectedReport.status === 'escalated' || selectedReport.status === 'reviewing') && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateMutation.mutate({ id: selectedReport.id, data: { status: 'reviewing', resolved_by: currentUser?.id } })}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                    >
                      <Eye size={14} className="mr-1" /> Reviewing
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateMutation.mutate({ id: selectedReport.id, data: { status: 'dismissed', resolution: 'Dismissed by admin', resolved_by: currentUser?.id } })}
                      className="text-gray-400"
                    >
                      <X size={14} className="mr-1" /> Dismiss
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: selectedReport.id, data: { status: 'resolved', resolution: 'Action taken by admin', resolved_by: currentUser?.id } })}
                      className="bg-green-600 hover:bg-green-500 text-white"
                    >
                      <Check size={14} className="mr-1" /> Resolve
                    </Button>
                  </>
                )}

                {selectedReport.target_type === 'user' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setBanTarget({
                          userId: selectedReport.target_id,
                          userName: selectedReport.target_name,
                          reportId: selectedReport.id,
                        });
                        setSelectedReport(null);
                      }}
                      className="bg-red-700 hover:bg-red-600 text-white ml-auto"
                    >
                      <Ban size={14} className="mr-1" /> Ban User
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unbanMutation.mutate(selectedReport.target_id)}
                      className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    >
                      <Unlock size={14} className="mr-1" /> Unban
                    </Button>
                  </>
                )}

                {selectedReport.target_type === 'message' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setBanTarget({
                        userId: selectedReport.reporter_id !== selectedReport.target_id ? selectedReport.target_id : '',
                        userName: selectedReport.target_name,
                        reportId: selectedReport.id,
                      });
                      setSelectedReport(null);
                    }}
                    className="bg-red-700 hover:bg-red-600 text-white ml-auto"
                  >
                    <Ban size={14} className="mr-1" /> Ban Author
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BanModal
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        targetUserId={banTarget?.userId}
        targetUserName={banTarget?.userName}
        reportId={banTarget?.reportId}
        currentUser={currentUser}
      />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ number, label, color }) {
  const palette = {
    white:  'text-white',
    yellow: 'text-yellow-400',
    orange: 'text-orange-400',
    red:    'text-red-500',
  };
  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5">
      <p className={`text-5xl font-black leading-none mb-3 ${palette[color]}`}>
        {number}
      </p>
      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">
        {label}
      </p>
    </div>
  );
}

// ─── Report row ───────────────────────────────────────────────────────────────
function ReportRow({ report, onClick }) {
  const severityPill = SEVERITY_PILL[report.severity] || SEVERITY_PILL.low;
  const statusPill = STATUS_PILL[report.status] || STATUS_PILL.pending;
  const severityBar = SEVERITY_BAR[report.severity] || 'bg-zinc-500';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className="relative flex items-stretch gap-4 bg-zinc-900/40 border border-white/5 rounded-xl p-4 hover:border-white/10 hover:bg-zinc-900/60 transition-all cursor-pointer overflow-hidden"
    >
      {/* Left severity color bar */}
      <div className={`w-1 self-stretch rounded-full ${severityBar} flex-shrink-0`} />

      <div className="flex-1 min-w-0">
        {/* Top row of pills */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-black text-white border border-white/10">
            {report.reason}
          </span>
          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${statusPill.bg} ${statusPill.text}`}>
            {report.status}
          </span>
          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${severityPill.bg} ${severityPill.text}`}>
            {report.severity}
          </span>
          {report.server_name && (
            <span className="text-[10px] text-zinc-500 font-mono">in {report.server_name}</span>
          )}
          <span className="text-[10px] text-zinc-600 font-mono ml-auto">
            {new Date(report.created_date).toLocaleString()}
          </span>
        </div>

        {/* Target + reporter */}
        <p className="text-sm text-zinc-300">
          Target: <span className="text-white font-black">{report.target_name}</span>
          <span className="text-zinc-600 text-xs ml-1.5">({report.target_type})</span>
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Reported by: {report.reporter_name}
        </p>

        {report.details && (
          <p className="text-xs text-zinc-600 mt-2 line-clamp-2 italic">{report.details}</p>
        )}
      </div>
    </motion.div>
  );
}
