import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { toast } from 'sonner';
import { UserPlus, Check, Clock } from 'lucide-react';
import { buildUsernameStyle } from '@/lib/usernameStyle';

/**
 * WebUserResults — user search + follow for THE WEB. When the feed search box
 * has a query, this lists matching operatives (by display name / username)
 * with a "Link" button. Following reuses the existing Friend social graph
 * (the only persistent relationship primitive), creating the same
 * pending_outgoing / pending_incoming row pair the rest of the app expects.
 * Clicking a result opens that user's holographic profile.
 */
export default function WebUserResults({ query, currentUser }) {
  const queryClient = useQueryClient();
  const q = (query || '').trim().toLowerCase();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['web-user-search'],
    queryFn: () => entities.UserProfile.list(),
    enabled: !!q,
    staleTime: 30000,
  });

  const { data: myFriends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id }),
    enabled: !!q && !!currentUser?.id,
    staleTime: 15000,
  });

  // Map friend_id → status so each result shows the right button state.
  const statusByUser = React.useMemo(() => {
    const m = {};
    for (const f of myFriends) m[f.friend_id] = f.status;
    return m;
  }, [myFriends]);

  const matches = React.useMemo(() => {
    if (!q) return [];
    return profiles
      .filter((p) => {
        const uid = p.user_id || p.id;
        if (!uid || uid === currentUser?.id) return false; // hide self
        const name = (p.display_name || '').toLowerCase();
        const handle = (p.username || '').toLowerCase();
        return name.includes(q) || handle.includes(q);
      })
      .slice(0, 8);
  }, [profiles, q, currentUser?.id]);

  const linkMut = useMutation({
    mutationFn: async (target) => {
      const targetId = target.user_id || target.id;
      await entities.Friend.create({
        user_id: currentUser?.id, friend_id: targetId,
        friend_name: target.display_name, friend_avatar: target.avatar_url,
        status: 'pending_outgoing',
      });
      await entities.Friend.create({
        user_id: targetId, friend_id: currentUser?.id,
        friend_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
        friend_avatar: currentUser?.avatar_url,
        status: 'pending_incoming',
      });
      return targetId;
    },
    onSuccess: () => {
      toast.success('Link request sent!');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendship'] });
    },
    onError: () => toast.error("Couldn't send link request. Try again."),
  });

  if (!q) return null;

  const openProfile = (uid) =>
    window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: uid } }));

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
        Operatives
      </div>
      {isLoading ? (
        <div className="text-zinc-600 text-sm py-3">Searching the web…</div>
      ) : matches.length === 0 ? (
        <div className="text-zinc-600 text-sm py-3">No operatives match “{query}”.</div>
      ) : (
        <div className="space-y-1.5">
          {matches.map((p) => {
            const uid = p.user_id || p.id;
            const status = statusByUser[uid];
            const linked = status === 'accepted';
            const pending = status === 'pending_outgoing' || status === 'pending_incoming';
            const nameStyle = buildUsernameStyle(p, { fallbackColor: '#ffffff' });
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 transition-colors"
              >
                <button onClick={() => openProfile(uid)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {(p.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={nameStyle}>
                      {p.display_name || 'Operative'}
                    </div>
                    {p.username && (
                      <div className="text-[11px] text-zinc-500 truncate font-mono">@{p.username}</div>
                    )}
                  </div>
                </button>

                {linked ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-green-400 px-3 py-1.5 flex-shrink-0">
                    <Check size={14} /> Linked
                  </span>
                ) : pending ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 px-3 py-1.5 flex-shrink-0">
                    <Clock size={14} /> Pending
                  </span>
                ) : (
                  <button
                    onClick={() => linkMut.mutate(p)}
                    disabled={linkMut.isPending}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    <UserPlus size={14} /> Link
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
