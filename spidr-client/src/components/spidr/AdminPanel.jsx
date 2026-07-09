import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, Search, Ban, ShieldOff, Trash2, Crown, CircleUser, Loader2 } from 'lucide-react';
import { account } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * AdminPanel — /admin route, platform-admin ONLY (server enforces via
 * requirePlatformAdmin middleware; the client still hides the UI when the
 * user isn't an admin so nothing 403s in their face). Provides:
 *
 *   • User search (username / email / full name)
 *   • Ban / unban (blocks login)
 *   • Grant / revoke admin
 *   • Permanent delete (runs the same cascade as self-delete)
 *
 * All destructive actions require a typed confirmation so nothing happens
 * from a stray click on a mistargeted row.
 */
export default function AdminPanel({ currentUser }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // userId being confirmed

  const iAmAdmin = !!(currentUser?.role === 'admin' || currentUser?.is_admin);

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ['admin-users', q],
    queryFn: () => account.admin.listUsers(q),
    enabled: iAmAdmin,
    staleTime: 15_000,
  });

  const banMut = useMutation({
    mutationFn: ({ userId, reason }) => account.admin.ban(userId, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User banned'); },
    onError: (e) => toast.error(e?.message || 'Ban failed'),
  });
  const unbanMut = useMutation({
    mutationFn: (userId) => account.admin.unban(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User unbanned'); },
    onError: (e) => toast.error(e?.message || 'Unban failed'),
  });
  const roleMut = useMutation({
    mutationFn: ({ userId, role }) => account.admin.setRole(userId, role),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Role updated'); },
    onError: (e) => toast.error(e?.message || 'Role update failed'),
  });
  const deleteMut = useMutation({
    mutationFn: (userId) => account.admin.remove(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setConfirmDelete(null);
      toast.success('User deleted permanently');
    },
    onError: (e) => toast.error(e?.message || 'Delete failed'),
  });

  if (!iAmAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0 bg-black/40 backdrop-blur-sm">
        <div className="text-center max-w-md px-6">
          <Shield className="w-16 h-16 text-red-500/40 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white mb-2">Admin Access Required</h2>
          <p className="text-zinc-500 text-sm">
            The platform admin console is only available to Spidr staff accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black/40 backdrop-blur-sm">
      {/* Header */}
      <div className="px-6 md:px-10 py-6 border-b border-white/5 bg-gradient-to-r from-red-900/20 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-7 h-7 text-red-400" />
          <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">
            Admin Console
          </h1>
        </div>
        <p className="text-zinc-500 text-sm">Platform-wide moderation. Every action here is logged.</p>
      </div>

      {/* Search */}
      <div className="px-6 md:px-10 py-4 border-b border-white/5">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by username, email, or name…"
            className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50"
          />
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-zinc-500 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
          </div>
        )}
        {isError && (
          <p className="text-red-400 text-sm">Could not load users: {error?.message}</p>
        )}
        {!isLoading && !isError && users.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-16">No users match that search.</p>
        )}
        <div className="space-y-2">
          {users.map((u) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-white/10">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <CircleUser className="w-full h-full text-zinc-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-bold text-sm truncate">{u.full_name || u.username || 'Unnamed'}</p>
                  {(u.role === 'admin' || u.is_admin) && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-yellow-400 flex items-center gap-1">
                      <Crown className="w-3 h-3" /> ADMIN
                    </span>
                  )}
                  {u.is_banned && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-red-400 flex items-center gap-1">
                      <Ban className="w-3 h-3" /> BANNED
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-xs truncate">@{u.username || '—'} · {u.email || 'no email'}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {u.is_banned ? (
                  <button
                    onClick={() => unbanMut.mutate(u.id)}
                    disabled={unbanMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    <ShieldOff className="w-3 h-3" /> Unban
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const reason = prompt(`Reason for banning ${u.username || u.full_name}?`) || '';
                      banMut.mutate({ userId: u.id, reason });
                    }}
                    disabled={banMut.isPending || u.id === currentUser?.id}
                    title={u.id === currentUser?.id ? "Can't ban yourself" : 'Ban this user'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:text-orange-300 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-30"
                  >
                    <Ban className="w-3 h-3" /> Ban
                  </button>
                )}
                <button
                  onClick={() => roleMut.mutate({ userId: u.id, role: (u.role === 'admin' || u.is_admin) ? 'user' : 'admin' })}
                  disabled={roleMut.isPending || u.id === currentUser?.id}
                  title={u.id === currentUser?.id ? "Can't change your own role" : 'Toggle admin'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-30"
                >
                  <Crown className="w-3 h-3" /> {(u.role === 'admin' || u.is_admin) ? 'Revoke Admin' : 'Grant Admin'}
                </button>
                <button
                  onClick={() => setConfirmDelete(u)}
                  disabled={u.id === currentUser?.id}
                  title={u.id === currentUser?.id ? 'Use Settings → Danger Zone for self-delete' : 'Delete permanently'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-30"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setConfirmDelete(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#0a0a0a] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-red-300">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-black uppercase tracking-widest text-sm">Confirm Permanent Delete</h3>
            </div>
            <p className="text-zinc-300 text-sm">
              You are about to permanently delete <strong className="text-white">{confirmDelete.full_name || confirmDelete.username || 'this user'}</strong>.
              Every message, DM, clip, comment, friendship, group membership, wallet, and profile they own will be erased.
              Servers they own will be deleted. There is no recovery.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(confirmDelete.id)}
                disabled={deleteMut.isPending}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
