import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Globe, Lock, Plus, Hash } from 'lucide-react';
import { toast } from 'sonner';

/**
 * CreateServerModal — opened from the desktop sidebar's `+` button (and
 * from the mobile menu's matching entry). Used to be flaky in prior
 * iterations — a shadcn <Dialog> wrapper that occasionally lost its
 * data-[state=open] animation, plus a form-submit <Button> with
 * pass-through props from a Radix Slot. This rewrite uses a plain
 * motion.div + portal so the modal mount is guaranteed regardless of
 * shadcn's animation pipeline, and the submit lives on a real native
 * <button type="submit"> bound directly to the form's onSubmit.
 *
 * Tabs:
 *   • Create — make a new server you own
 *   • Join   — paste an invite code to join an existing server
 */
export default function CreateServerModal({ open, onClose, currentUser }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('create');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon_url: '',
    banner_url: '',
    is_public: true,
  });
  const [inviteCode, setInviteCode] = useState('');
  const [uploading, setUploading] = useState(false);

  // Reset modal state every time it closes so a stuck "Creating..." button
  // from a prior failed mutation doesn't carry over into the next session.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setFormData({ name: '', description: '', icon_url: '', banner_url: '', is_public: true });
        setInviteCode('');
        setTab('create');
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Create-server mutation ─────────────────────────────────────────────
  const createServerMutation = useMutation({
    mutationFn: async (data) => {
      if (!currentUser?.id) {
        throw new Error('Not signed in — please refresh and try again.');
      }
      if (typeof entities?.Server?.create !== 'function') {
        throw new Error('Server API unavailable — connection lost.');
      }
      const newServer = await entities.Server.create({
        ...data,
        owner_id: currentUser.id,
        members: [{
          user_id: currentUser.id,
          user_name: currentUser.full_name || currentUser.username,
          user_avatar: currentUser.avatar_url || '',
          role: 'admin',
        }],
        channels: [
          { id: 'general', name: 'general', type: 'text' },
          { id: 'random',  name: 'random',  type: 'text' },
          { id: 'voice',   name: 'General Voice', type: 'voice' },
        ],
        roles: [
          { id: 'admin',     name: 'Admin',     color: '#dc2626', permissions: ['all'] },
          { id: 'moderator', name: 'Moderator', color: '#f59e0b', permissions: ['kick', 'mute', 'manage_messages'] },
          { id: 'member',    name: 'Member',    color: '#6b7280', permissions: ['send_messages', 'read_messages'] },
        ],
      });
      return newServer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server created!');
      onClose?.();
    },
    onError: (err) => {
      console.error('[CreateServer] failed:', err);
      toast.error(err?.message || err?.data?.error || 'Failed to create server');
    },
  });

  // ── Join-by-code mutation ──────────────────────────────────────────────
  const joinMutation = useMutation({
    mutationFn: async (code) => {
      if (!currentUser?.id) throw new Error('Not signed in — please refresh.');
      if (typeof entities?.Server?.joinByCode !== 'function') {
        throw new Error('Invite endpoint unavailable.');
      }
      const trimmed = (code || '').trim().replace(/^.*\//, ''); // strip URL prefix if pasted
      if (!trimmed) throw new Error('Paste an invite code first.');
      return entities.Server.joinByCode(trimmed, {
        user_id: currentUser.id,
        full_name: currentUser.full_name,
        username: currentUser.username,
        avatar_url: currentUser.avatar_url,
      });
    },
    onSuccess: (server) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success(`Joined ${server?.name || 'server'}!`);
      onClose?.();
    },
    onError: (err) => {
      console.error('[JoinServer] failed:', err);
      toast.error(err?.message || err?.data?.error || 'Invalid or expired invite');
    },
  });

  // ── File upload (icon) ─────────────────────────────────────────────────
  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url: file_url } = await integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, [field]: file_url }));
      toast.success('Image uploaded!');
    } catch (error) {
      console.error('[UploadFile] failed:', error);
      toast.error(error?.message || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  // ── Submit handlers — explicit, not relying on form submit alone ──────
  const handleCreateSubmit = (e) => {
    e?.preventDefault?.();
    if (createServerMutation.isPending) return;
    if (!formData.name.trim()) {
      toast.error('Server name is required');
      return;
    }
    createServerMutation.mutate({
      name: formData.name.trim(),
      description: formData.description,
      icon_url: formData.icon_url,
      banner_url: formData.banner_url,
      is_public: formData.is_public,
    });
  };

  const handleJoinSubmit = (e) => {
    e?.preventDefault?.();
    if (joinMutation.isPending) return;
    joinMutation.mutate(inviteCode);
  };

  // Portal-mount so the modal escapes any z-index/stacking-context
  // container it might be nested inside (e.g. a parent with transform).
  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9991] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() => onClose?.()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(15, 15, 15, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              boxShadow: '0 0 40px rgba(239, 68, 68, 0.15), 0 24px 60px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                  }}
                >
                  <Plus size={16} className="text-red-400" />
                </div>
                <h2 className="text-white font-bold text-base">Add a Server</h2>
              </div>
              <button
                onClick={() => onClose?.()}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
                aria-label="Close"
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab strip */}
            <div className="flex border-b border-white/5">
              <TabBtn active={tab === 'create'} onClick={() => setTab('create')}>Create</TabBtn>
              <TabBtn active={tab === 'join'} onClick={() => setTab('join')}>Join with code</TabBtn>
            </div>

            {/* Tab content */}
            {tab === 'create' ? (
              <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
                {/* Icon */}
                <div className="flex justify-center">
                  <label className="relative cursor-pointer group">
                    <div className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden group-hover:border-red-500 transition-colors">
                      {formData.icon_url ? (
                        <img src={formData.icon_url} alt="Icon" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-6 h-6 text-zinc-500 group-hover:text-red-400 transition-colors" />
                      )}
                    </div>
                    <input type="file" accept="image/*,.gif" className="hidden" onChange={(e) => handleFileUpload(e, 'icon_url')} />
                    {formData.icon_url && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, icon_url: '' }));
                        }}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </label>
                </div>
                <p className="text-center text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                  {uploading ? 'Uploading…' : 'Upload icon · GIFs supported'}
                </p>

                {/* Name */}
                <Field label="Server name" required>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My awesome server"
                    maxLength={64}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-red-500/40 focus:shadow-[0_0_12px_rgba(239,68,68,0.18)]"
                  />
                </Field>

                {/* Description */}
                <Field label="Description">
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What's your server about?"
                    rows={2}
                    maxLength={240}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none resize-none transition-all focus:border-red-500/40 focus:shadow-[0_0_12px_rgba(239,68,68,0.18)]"
                  />
                </Field>

                {/* Visibility */}
                <Field label="Visibility">
                  <div className="grid grid-cols-2 gap-2">
                    <VisChip
                      Icon={Globe}
                      label="Public"
                      sub="Discoverable on Radar"
                      active={formData.is_public}
                      activeColor="rgba(59, 130, 246, 0.5)"
                      activeBg="rgba(59, 130, 246, 0.10)"
                      onClick={() => setFormData(prev => ({ ...prev, is_public: true }))}
                    />
                    <VisChip
                      Icon={Lock}
                      label="Invite only"
                      sub="Hidden, code required"
                      active={!formData.is_public}
                      activeColor="rgba(239, 68, 68, 0.5)"
                      activeBg="rgba(239, 68, 68, 0.10)"
                      onClick={() => setFormData(prev => ({ ...prev, is_public: false }))}
                    />
                  </div>
                </Field>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onClose?.()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createServerMutation.isPending || !formData.name.trim()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(239,68,68,0.30)]"
                  >
                    {createServerMutation.isPending ? 'Creating…' : 'Create server'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoinSubmit} className="p-5 space-y-4">
                <Field label="Invite code">
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="x4k9-zr2"
                      maxLength={64}
                      autoFocus
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-600 font-mono tracking-widest outline-none transition-all focus:border-red-500/40 focus:shadow-[0_0_12px_rgba(239,68,68,0.18)]"
                    />
                  </div>
                </Field>

                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Paste an invite link or just the code. The owner can generate
                  one from the server's settings.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onClose?.()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joinMutation.isPending || !inviteCode.trim()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(239,68,68,0.30)]"
                  >
                    {joinMutation.isPending ? 'Joining…' : 'Join'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal escape — typeof document check keeps this SSR-safe even though
  // Spidr is CSR-only today.
  if (typeof document !== 'undefined') {
    return createPortal(modal, document.body);
  }
  return modal;
}

// ── Subcomponents ────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-[11px] font-mono uppercase tracking-widest transition-colors ${
        active
          ? 'text-red-400 border-b-2 border-red-500'
          : 'text-zinc-500 hover:text-white border-b-2 border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function VisChip({ Icon, label, sub, active, activeColor, activeBg, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all"
      style={{
        borderColor: active ? activeColor : 'rgba(255, 255, 255, 0.08)',
        background: active ? activeBg : 'rgba(0, 0, 0, 0.25)',
      }}
    >
      <Icon className="w-5 h-5" style={{ color: active ? activeColor : 'rgba(255, 255, 255, 0.5)' }} />
      <div className="text-center">
        <p className="text-[11px] font-bold text-white uppercase tracking-wider">{label}</p>
        <p className="text-[9px] text-zinc-500 mt-0.5">{sub}</p>
      </div>
    </button>
  );
}
