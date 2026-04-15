import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Ban, X, Loader2, AlertTriangle } from 'lucide-react';
import { entities, auth, integrations } from '@/api/apiClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const DURATION_OPTIONS = [
  { label: '1 Hour', hours: 1 },
  { label: '12 Hours', hours: 12 },
  { label: '1 Day', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days', hours: 168 },
  { label: '30 Days', hours: 720 },
  { label: 'Permanent', hours: null },
];

export default function BanModal({ open, onClose, targetUserId, targetUserName, reportId, currentUser }) {
  const [duration, setDuration] = useState(null);
  const [banReason, setBanReason] = useState('');
  const queryClient = useQueryClient();

  const banMutation = useMutation({
    mutationFn: async () => {
      // Find the user's profile
      const profiles = await entities.UserProfile.filter({ user_id: targetUserId });
      if (!profiles.length) throw new Error('User profile not found');

      const profile = profiles[0];
      const selectedDuration = DURATION_OPTIONS.find(d => d.hours === duration);
      const banUntil = selectedDuration?.hours
        ? new Date(Date.now() + selectedDuration.hours * 60 * 60 * 1000).toISOString()
        : null;

      await entities.UserProfile.update(profile.id, {
        is_banned: true,
        ban_reason: banReason || `Banned for: ${targetUserName}`,
        ban_until: banUntil || '',
        banned_by: currentUser?.id || '',
        ban_report_id: reportId || ''
      });

      // Also resolve the report if one exists
      if (reportId) {
        await entities.Report.update(reportId, {
          status: 'resolved',
          resolution: `User banned ${selectedDuration?.hours ? `for ${selectedDuration.label}` : 'permanently'}`,
          resolved_by: currentUser?.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-reports'] });
      toast.success(`${targetUserName} has been banned`);
      onClose();
      setDuration(null);
      setBanReason('');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to ban user');
    }
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-[#0a0a0a] border border-red-600/40 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(220,38,38,0.2)]"
      >
        {/* Header */}
        <div className="bg-red-600/15 p-4 border-b border-red-600/30 flex items-center gap-3">
          <Ban className="text-red-500" size={22} />
          <div className="flex-1">
            <h2 className="text-base font-black text-white uppercase tracking-tight">Ban User</h2>
            <p className="text-[10px] text-red-400 font-mono">
              TARGET: <span className="text-white bg-red-500/20 px-1 rounded">{targetUserName || targetUserId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Duration */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Ban Duration</label>
            <div className="grid grid-cols-2 gap-1.5">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.label}
                  onClick={() => setDuration(d.hours)}
                  className={`p-2.5 rounded-lg border text-sm font-semibold transition-all ${
                    duration === d.hours
                      ? d.hours === null
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-red-600 text-white border-red-600'
                      : 'bg-[#111] border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Ban Reason</label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason for the ban..."
              className="w-full bg-[#111] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-red-500 outline-none h-20 resize-none placeholder:text-gray-600"
            />
          </div>

          {/* Warning for permanent */}
          {duration === null && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">This will permanently ban the user from the app. They will not be able to access any features until manually unbanned.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#050505] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors">
            CANCEL
          </button>
          <button
            onClick={() => banMutation.mutate()}
            disabled={duration === undefined || duration === false || banMutation.isPending}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-2"
          >
            {banMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            <Ban size={12} />
            BAN USER
          </button>
        </div>
      </motion.div>
    </div>
  );
}
