import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchUsers, follows as followsApi, entities } from '@/api/apiClient';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildUsernameStyle } from '@/lib/usernameStyle';

/**
 * PeopleSearch — find and follow users on THE WEB.
 *
 * Debounced search against /users/search. Each result row shows the user's
 * avatar + styled username and a Follow / Following toggle. Following state
 * is hydrated once from the current user's following list, then updated
 * optimistically on click.
 */
export default function PeopleSearch({ currentUser }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Who the current user already follows — used to render the toggle state.
  const { data: myFollowing = [] } = useQuery({
    queryKey: ['my-following', currentUser?.id],
    queryFn: () => followsApi.following(currentUser?.id),
    enabled: !!currentUser?.id,
    staleTime: 30000,
  });
  const followingIds = new Set((myFollowing || []).map(f => f.following_id));

  // Profiles for username styling.
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list('-created_date', 500),
    staleTime: 60000,
  });
  const profileByUser = React.useMemo(() => {
    const m = {};
    for (const p of profiles) if (p.user_id) m[p.user_id] = p;
    return m;
  }, [profiles]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['people-search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled: debounced.length >= 2,
  });

  const followMut = useMutation({
    mutationFn: async ({ user, isFollowing }) => {
      if (isFollowing) return followsApi.unfollow(user.id);
      const prof = profileByUser[user.id];
      return followsApi.follow({
        following_id: user.id,
        following_name: prof?.display_name || user.full_name || user.username,
        following_avatar: prof?.avatar_url || user.avatar_url || '',
        follower_name: currentUser?.full_name || currentUser?.username,
        follower_avatar: currentUser?.avatar_url || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-following', currentUser?.id] });
    },
    onError: () => toast.error('Could not update follow'),
  });

  return (
    <div className="w-full max-w-xl mx-auto h-full flex flex-col p-4">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people by name or @handle…"
          className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-500 rounded-xl pl-10 pr-3 py-2.5 text-white text-sm outline-none transition-colors placeholder-zinc-600"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {debounced.length < 2 ? (
          <p className="text-center text-zinc-600 text-sm py-10">Type at least 2 characters to search.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-red-500 animate-spin" /></div>
        ) : results.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-10">No people found for “{debounced}”.</p>
        ) : (
          results.filter(u => u.id !== currentUser?.id).map((user) => {
            const prof = profileByUser[user.id];
            const isFollowing = followingIds.has(user.id);
            const name = prof?.display_name || user.full_name || user.username || 'User';
            return (
              <div key={user.id} className="flex items-center gap-3 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5">
                <Avatar className="w-10 h-10 cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: user.id } }))}>
                  {(prof?.avatar_url || user.avatar_url) && <AvatarImage src={prof?.avatar_url || user.avatar_url} />}
                  <AvatarFallback className="bg-red-900 text-white text-sm">{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate" style={prof ? buildUsernameStyle(prof) : { color: '#fff' }}>{name}</p>
                  <p className="text-zinc-500 text-xs truncate">@{user.username || name.toLowerCase().replace(/\s+/g, '_')}</p>
                </div>
                <button
                  onClick={() => followMut.mutate({ user, isFollowing })}
                  disabled={followMut.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    isFollowing
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-red-900/30 hover:text-red-300'
                      : 'bg-red-600 text-white hover:bg-red-500'
                  }`}
                >
                  {isFollowing ? <><UserCheck className="w-3.5 h-3.5" /> Following</> : <><UserPlus className="w-3.5 h-3.5" /> Follow</>}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
