import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Check, ArrowUpRight, AlertTriangle, Eye, X } from 'lucide-react';
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

export default function ServerReportsPanel({ serverId, currentUser }) {
  const [filter, setFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['server-reports', serverId],
    queryFn: () => base44.entities.Report.filter({ server_id: serverId }, '-created_date', 100),
    enabled: !!serverId
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Report.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-reports', serverId] });
      toast.success('Report updated');
    }
  });

  const filtered = reports.filter(r => filter === 'all' ? true : r.status === filter);

  const handleResolve = (id, status, resolution) => {
    updateMutation.mutate({
      id,
      data: { status, resolution, resolved_by: currentUser?.id }
    });
    setSelectedReport(null);
  };

  const handleEscalate = (id) => {
    updateMutation.mutate({
      id,
      data: { status: 'escalated', resolution: `Escalated to global staff by ${currentUser?.full_name || currentUser?.id}` }
    });
    setSelectedReport(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="text-yellow-500" size={20} />
        <h3 className="text-white font-bold text-lg">Server Reports</h3>
        <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full font-mono">
          {reports.filter(r => r.status === 'pending').length} PENDING
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1">
        {['pending', 'reviewing', 'resolved', 'dismissed', 'escalated', 'all'].map(f => (
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

      {/* Reports list */}
      <ScrollArea className="h-[350px]">
        <div className="space-y-2">
          {isLoading && <p className="text-gray-500 text-center py-8 text-xs font-mono">Loading reports...</p>}
          
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-600 font-mono text-xs">
              NO {filter.toUpperCase()} REPORTS
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
                className="bg-[#111] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-1 self-stretch rounded-full ${SEVERITY_COLORS[report.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded uppercase">{report.reason}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_COLORS[report.status]}`}>
                        {report.status}
                      </span>
                      <span className="text-[10px] text-gray-600 font-mono ml-auto">
                        {new Date(report.created_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">
                      Target: <span className="text-white font-semibold">{report.target_name}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Reported by: {report.reporter_name}
                    </p>
                    {report.details && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{report.details}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4" onClick={() => setSelectedReport(null)}>
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
                  <span className="font-bold text-white uppercase text-sm">Report Detail</span>
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

                <div className="bg-[#111] rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Reason</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded uppercase">{selectedReport.reason}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${SEVERITY_COLORS[selectedReport.severity]} text-white`}>
                      {selectedReport.severity}
                    </span>
                  </div>
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
                          <img src={url} alt="evidence" className="w-20 h-20 rounded-lg object-cover border border-white/10 hover:border-red-500 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {(selectedReport.status === 'pending' || selectedReport.status === 'reviewing') && (
                <div className="p-4 border-t border-white/5 bg-[#050505] flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolve(selectedReport.id, 'reviewing', '')}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                  >
                    <Eye size={14} className="mr-1" /> Mark Reviewing
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolve(selectedReport.id, 'dismissed', 'Dismissed by moderator')}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    <X size={14} className="mr-1" /> Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolve(selectedReport.id, 'resolved', 'Action taken by moderator')}
                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  >
                    <Check size={14} className="mr-1" /> Resolve
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleEscalate(selectedReport.id)}
                    className="bg-red-600 hover:bg-red-500 text-white ml-auto"
                  >
                    <ArrowUpRight size={14} className="mr-1" /> Escalate to Staff
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}