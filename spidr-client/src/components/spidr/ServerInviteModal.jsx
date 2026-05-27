import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, RefreshCw, X, Link as LinkIcon, Loader2 } from 'lucide-react';
import { entities } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * ServerInviteModal — generate, view, copy, and rotate a server's invite link.
 *
 * Props:
 *   open      boolean
 *   onClose   () => void
 *   server    { id, name, icon_url }
 */
export default function ServerInviteModal({ open, onClose, server }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the share URL the user actually pastes to friends.
  // We use the current origin so the link works whether they're on web or
  // electron — both will resolve /join/:code through the router.
  const inviteUrl = inviteCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`
    : '';

  // Fetch / generate the invite code on open
  useEffect(() => {
    if (!open || !server?.id) return;
    let cancelled = false;
    setLoading(true);
    setCopied(false);
    entities.Server.generateInvite(server.id)
      .then((res) => {
        if (cancelled) return;
        setInviteCode(res.invite_code || '');
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error('Could not generate invite: ' + (err?.message || 'unknown error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, server?.id]);

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  const handleRotate = async () => {
    if (!server?.id) return;
    setLoading(true);
    try {
      const res = await entities.Server.generateInvite(server.id, true);
      setInviteCode(res.invite_code || '');
      toast.success('New invite link generated — old one no longer works');
    } catch (err) {
      toast.error('Could not rotate: ' + (err?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 bg-gradient-to-r from-red-600/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-600/15 border border-red-600/30 flex items-center justify-center">
                <LinkIcon size={18} className="text-[#FF3333]" />
              </div>
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-tight">
                  Invite to {server?.name || 'Server'}
                </h2>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                  Share this link with a friend
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] mb-2 block">
                Invite Link
              </label>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2.5 flex items-center min-w-0">
                  {loading ? (
                    <Loader2 size={14} className="animate-spin text-zinc-500" />
                  ) : (
                    <span className="text-xs text-white font-mono truncate">
                      {inviteUrl || 'Generating…'}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCopy}
                  disabled={loading || !inviteCode}
                  className={`px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-[#FF3333] hover:bg-red-500 text-white shadow-[0_0_15px_rgba(255,51,51,0.25)]'
                  }`}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
            </div>

            {/* Invite code (short form for typing) */}
            {inviteCode && !loading && (
              <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-3">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Or share the code</p>
                <p className="text-xl font-black text-white font-mono tracking-widest">{inviteCode}</p>
              </div>
            )}

            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Anyone with this link can join {server?.name || 'your server'}. If the link gets out, rotate it to generate a fresh one — the old link stops working immediately.
            </p>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRotate}
                disabled={loading}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Rotate Link
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
