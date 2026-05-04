import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, Check, Upload, Loader2 } from 'lucide-react';
import { entities, auth, integrations } from '@/api/apiClient';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam / Bot Activity', severity: 'low' },
  { id: 'harassment', label: 'Harassment / Abuse', severity: 'medium' },
  { id: 'nsfw', label: 'Inappropriate Content (NSFW)', severity: 'medium' },
  { id: 'impersonation', label: 'Impersonation', severity: 'medium' },
  { id: 'threats', label: 'Threats / Violence', severity: 'high' },
  { id: 'underage', label: 'Underage User', severity: 'high' },
  { id: 'hacking', label: 'Hacking / Exploits', severity: 'critical' },
  { id: 'doxxing', label: 'Doxxing / Leaking Personal Info', severity: 'critical' },
  { id: 'other', label: 'Other', severity: 'medium' },
];

export default function ReportModal({ open, onClose, targetType, targetId, targetName, targetContent, serverId, serverName, currentUser }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState([]);
  const [uploading, setUploading] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data) => entities.Report.create(data),
    onSuccess: () => {
      toast.success('Report submitted. Our team will review it.');
      onClose();
      setReason(null);
      setDetails('');
      setEvidenceUrls([]);
    }
  });

  const handleEvidenceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { url: file_url } = await integrations.Core.UploadFile({ file });
    setEvidenceUrls(prev => [...prev, file_url]);
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!reason) return;
    const reasonObj = REPORT_REASONS.find(r => r.id === reason);
    submitMutation.mutate({
      reporter_id: currentUser?.id,
      reporter_name: currentUser?.full_name || currentUser?.username,
      target_type: targetType || 'user',
      target_id: targetId,
      target_name: targetName || 'Unknown',
      target_content: targetContent || '',
      reason,
      details,
      evidence_urls: evidenceUrls,
      server_id: serverId || '',
      server_name: serverName || '',
      severity: reasonObj?.severity || 'medium',
      status: 'pending'
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0a0a0a] border border-red-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)]"
      >
        {/* Header */}
        <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center gap-3">
          <ShieldAlert className="text-red-500" size={22} />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-white uppercase tracking-tight">Flag Signal</h2>
            <p className="text-[10px] text-red-400 font-mono truncate">
              TARGET: <span className="text-white bg-red-500/20 px-1 rounded">{targetName || targetId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Reason */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Violation Type</label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-sm font-semibold transition-all ${
                    reason === r.id
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-[#111] border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {r.label}
                    {r.severity === 'critical' && <span className="text-[9px] bg-red-500/30 text-red-300 px-1 rounded">CRITICAL</span>}
                  </span>
                  {reason === r.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Details (Optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full bg-[#111] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-red-500 outline-none h-20 resize-none placeholder:text-gray-600"
            />
          </div>

          {/* Evidence */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Evidence (Optional)</label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className={`flex items-center gap-2 px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-xs font-bold cursor-pointer transition-colors ${uploading ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:border-white/30'}`}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Uploading...' : 'Add Screenshot'}
                <input type="file" className="hidden" accept="image/*" onChange={handleEvidenceUpload} disabled={uploading} />
              </label>
              {evidenceUrls.map((url, i) => (
                <img key={i} src={url} alt="evidence" className="w-10 h-10 rounded border border-white/10 object-cover" />
              ))}
            </div>
          </div>

          {/* Reported content preview */}
          {targetContent && (
            <div className="bg-[#111] border border-white/5 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Reported Content</p>
              <p className="text-xs text-gray-400 line-clamp-3">{targetContent}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#050505] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors">
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason || submitMutation.isPending}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-2"
          >
            {submitMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            SUBMIT REPORT
          </button>
        </div>
      </motion.div>
    </div>
  );
}