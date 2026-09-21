import React from 'react';
import { motion } from 'framer-motion';
import { Users, Check, X, Shield } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { toast } from 'sonner';
import SpiderLogo from './SpiderLogo';

/**
 * ServerInviteCard — renders inside a DM thread when a message carries
 * `is_server_invite: true` and a `server_invite_data` payload. Shows the
 * server icon, name, member count, and Accept / Decline actions.
 *
 *   ACCEPT  → adds the recipient to server.members and marks the invite
 *             card as accepted (writes invite_status onto the DM row so
 *             the card re-renders in its terminal state across sessions).
 *   DECLINE → marks the card declined. No server write happens; the
 *             invite simply dies.
 *
 * The actual server membership write happens HERE (in the recipient's
 * accept handler), not on the sender's side. The sender's "Add to server"
 * action only creates the invite. This is the consent gate the original
 * silent-add flow was missing.
 */
export default function ServerInviteCard({ msg, currentUser }) {
  const queryClient = useQueryClient();
  const data = msg?.server_invite_data || {};
  const status = msg?.invite_status || 'pending';

  // Only the recipient can accept/decline. If the current user IS the
  // sender, we render a passive "Sent" variant. Reads both schema fields
  // since legacy / new DMs may carry either receiver_id or recipient_id.
  const recipientId = msg?.receiver_id || msg?.recipient_id;
  const isRecipient = currentUser?.id === recipientId;

  const acceptMut = useMutation({
    mutationFn: async () => {
      if (!isRecipient) throw new Error('Only the recipient can accept this invite.');
      if (!data.server_id) throw new Error('Invite is missing the server id.');

      const joined = await entities.Server.join(data.server_id, msg.id);
      const serverName = joined.name || data.server_name || 'this server';

      // Stamp the invite card so it locks into its terminal state and
      // can't be accepted again from another device / refresh.
      try {
        await entities.DirectMessage.update?.(msg.id, { invite_status: 'accepted' });
      } catch {
        // If update isn't available on the DM entity, the card will still
        // visually reset on local state below — accept just won't persist
        // across refresh. Joining the server itself already succeeded.
      }
      return serverName;
    },
    onSuccess: (serverName) => {
      toast.success(`Joined ${serverName}!`);
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['user-servers'] });
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
    },
    onError: (err) => {
      console.error('[InviteAccept] failed:', err);
      toast.error(err?.message || 'Could not join — try again');
    },
  });

  const declineMut = useMutation({
    mutationFn: async () => {
      if (!isRecipient) throw new Error('Only the recipient can decline this invite.');
      try {
        await entities.DirectMessage.update?.(msg.id, { invite_status: 'declined' });
      } catch {
        // Same fallback as accept — local re-render will still happen via
        // the queryClient invalidation below, but the decline won't survive
        // a refresh if the DM entity has no update method.
      }
    },
    onSuccess: () => {
      toast('Invite declined.');
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
    },
    onError: () => toast.error('Could not decline'),
  });

  // ── Pending state — interactive card ─────────────────────────────────
  if (status === 'pending') {
    return (
      <CardShell data={data}>
        {isRecipient ? (
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={() => declineMut.mutate()}
              disabled={declineMut.isPending || acceptMut.isPending}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <X size={12} /> Decline
            </button>
            <button
              type="button"
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending || declineMut.isPending}
              className="flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest text-white transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_14px_rgba(16,185,129,0.30)] flex items-center justify-center gap-1.5"
            >
              <Check size={12} /> {acceptMut.isPending ? 'Joining…' : 'Accept'}
            </button>
          </div>
        ) : (
          <div className="pt-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 text-center">
              Awaiting their decision…
            </p>
          </div>
        )}
      </CardShell>
    );
  }

  // ── Accepted state ───────────────────────────────────────────────────
  if (status === 'accepted') {
    return (
      <CardShell data={data} terminal="accepted">
        <p className="pt-3 text-[10px] font-mono uppercase tracking-widest text-emerald-400 text-center">
          {isRecipient ? '✓ You joined' : '✓ They joined'}
        </p>
      </CardShell>
    );
  }

  // ── Declined state ───────────────────────────────────────────────────
  return (
    <CardShell data={data} terminal="declined">
      <p className="pt-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500 text-center">
        Invite declined
      </p>
    </CardShell>
  );
}

function CardShell({ data, terminal, children }) {
  // Subtle border-color shift when the card hits a terminal state so the
  // user can scan their DM history and see at a glance which invites
  // landed vs which were rejected.
  const border =
    terminal === 'accepted' ? 'rgba(16, 185, 129, 0.35)' :
    terminal === 'declined' ? 'rgba(255, 255, 255, 0.08)' :
                              'rgba(239, 68, 68, 0.30)';
  const glow =
    terminal === 'accepted' ? '0 0 18px rgba(16, 185, 129, 0.15)' :
    terminal === 'declined' ? 'none' :
                              '0 0 18px rgba(239, 68, 68, 0.12)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 w-full max-w-[280px] rounded-xl overflow-hidden p-3"
      style={{
        background: 'rgba(10, 10, 10, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${border}`,
        boxShadow: glow,
      }}
    >
      {/* Eyebrow */}
      <div className="flex items-center gap-1.5 mb-2">
        <Shield size={10} className="text-red-400" />
        <span className="text-[9px] font-mono uppercase tracking-widest text-red-400">
          Server invite
        </span>
      </div>

      {/* Body */}
      <div className="flex items-start gap-2.5">
        {data.server_icon ? (
          <img
            src={data.server_icon}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
            style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.20), rgba(124, 58, 237, 0.20))',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <SpiderLogo size={16} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-xs truncate">{data.server_name || 'a server'}</p>
          {data.server_description && (
            <p className="text-zinc-500 text-[10px] leading-snug line-clamp-2 mt-0.5">
              {data.server_description}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1.5 text-zinc-600">
            <Users size={9} />
            <span className="text-[9px] font-mono">
              {data.member_count ?? '?'} member{data.member_count === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {children}
    </motion.div>
  );
}
