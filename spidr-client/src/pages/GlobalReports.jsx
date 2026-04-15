import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Shield, AlertTriangle, Eye, X, Check, Ban, ArrowUpRight, Clock, Activity, Unlock } from 'lucide-react';
import BanModal from '../components/spidr/BanModal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const SEVERITY_COLORS = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
};

const STATUS_COLORS = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  reviewing: 'text-blue-400 bg-blue-400/10',
  resolved: 'text-green-400 bg-green-400/10',
  dismissed: 'text-gray-400 bg-gray-400/10',
  escalated: 'text-red-400 bg-red-400/10'
};

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
    enabled: authorized
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => entities.Report.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-reports'] });
      toast.success('Report updated');
      setSelectedReport(null);
    }
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
        ban_report_id: ''
      });
    },
    onSuccess: () => {
      toast.success('User unbanned');
      queryClient.invalidateQueries({ queryKey: ['global-reports'] });
    }
  });

  const filtered = reports.filter(r => {
    const statusMatch = filter === 'all' || r.status === filter;
    const severityMatch = severityFilter === 'all' || r.severity === severityFilter;
    return statusMatch && severityMatch;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    escalated: reports.filter(r => r.status === 'escalated').length,
    critical: reports.filter(r => r.severity === 'critical').length,
  };

  if (!authorized) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4 opacity-30" />
          <p className="text-red-500 font-bold text-lg uppercase">Access Denied</p>
          <p className="text-gray-600 text-sm mt-2">Only app admins can access global reports</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-red-900/30 p-6 bg-[#050505]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="text-red-500" size={28} />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Global Overwatch</h1>
              <p className="text-[10px] text-red-400 font-mono uppercase">
                AUTH: {currentUser?.email} • CLEARANCE: ADMIN
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#111] border border-white/5 rounded-xl p-3">
            <p className="text-2xl font-black">{stats.total}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total Reports</p>
          </div>
          <div className="bg-[#111] border border-yellow-500/20 rounded-xl p-3">
            <p className="text-2xl font-black text-yellow-400">{stats.pending}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold">Pending</p>
          </div>
          <div className="bg-[#111] border border-red-500/20 rounded-xl p-3">
            <p className="text-2xl font-black text-red-400">{stats.escalated}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold">Escalated</p>
          </div>
          <div className="bg-[#111] border border-red-500/30 rounded-xl p-3">
            <p className="text-2xl font-black text-red-500">{stats.critical}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold">Critical</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-white/5 flex items-center gap-4 bg-[#050505]">
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1">
          {['all', 'pending', 'escalated', 'reviewing', 'resolved', 'dismissed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                filter === f ? 'bg-[#FF3333] text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1 ml-auto">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                severityFilter === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3">
          {isLoading && <p className="text-gray-500 text-center py-12 font-mono text-xs">LOADING REPORTS...</p>}
          
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-20 text-gray-600 font-mono text-xs">
              NO MATCHING REPORTS
            </div>
          )}

          <AnimatePresence>
            {filtered.map((report) => (
              <motion.div
                key={report.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-[#0a0a0a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors cursor-pointer group"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-1.5 self-stretch rounded-full ${SEVERITY_COLORS[report.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded uppercase">{report.reason}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_COLORS[report.status]}`}>
                        {report.status}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${SEVERITY_COLORS[report.severity]} text-white`}>
                        {report.severity}
                      </span>
                      {report.server_name && (
                        <span className="text-[10px] text-gray-600 font-mono">in {report.server_name}</span>
                      )}
                      <span className="text-[10px] text-gray-600 font-mono ml-auto">
                        {new Date(report.created_date).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-gray-300">
                          Target: <span className="text-white font-bold">{report.target_name}</span>
                          <span className="text-gray-600 text-xs ml-1">({report.target_type})</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Reported by: {report.reporter_name}
                        </p>
                      </div>
                    </div>
                    {report.details && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{report.details}</p>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {(report.status === 'pending' || report.status === 'escalated' || report.status === 'reviewing') && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: report.id, data: { status: 'resolved', resolution: 'Resolved by admin', resolved_by: currentUser?.id } });
                          }}
                          className="text-green-400 hover:text-green-300 h-8"
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: report.id, data: { status: 'dismissed', resolution: 'Dismissed by admin', resolved_by: currentUser?.id } });
                          }}
                          className="text-gray-400 hover:text-gray-300 h-8"
                        >
                          <X size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedReport(null)}>
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
                  <span className="font-bold text-white uppercase text-sm">Report #{selectedReport.id?.toString().slice(-6)}</span>
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

                <div className="bg-[#111] rounded-lg p-3 flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${SEVERITY_COLORS[selectedReport.severity]}`} />
                  <span className="text-xs font-black text-white uppercase">{selectedReport.reason}</span>
                  <span className="text-[10px] text-gray-500 uppercase">{selectedReport.severity} severity</span>
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
                {/* Ban / Unban - always visible for user-type reports */}
                {selectedReport.target_type === 'user' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setBanTarget({
                          userId: selectedReport.target_id,
                          userName: selectedReport.target_name,
                          reportId: selectedReport.id
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
                {/* For message reports, offer to ban the message author */}
                {selectedReport.target_type === 'message' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setBanTarget({
                        userId: selectedReport.reporter_id !== selectedReport.target_id ? selectedReport.target_id : '',
                        userName: selectedReport.target_name,
                        reportId: selectedReport.id
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
