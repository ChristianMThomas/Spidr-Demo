import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles, UserPlus, RefreshCw, Loader2, Users, Zap, Check } from 'lucide-react';
import { toast } from 'sonner';
import HolographicProfile from './HolographicProfile';

/**
 * DiscoverUsers — "Find Friends" widget on the home page.
 *
 * Loads automatically once profiles are available.
 * Falls back to algorithmic suggestions (shared servers > recent activity > random)
 * when the LLM is not configured or fails. Either way the user always sees
 * suggestions — the LLM is just for the "reason" text and ranking.
 */
export default function DiscoverUsers({ currentUser, onNavigateToDM }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [sentToUserIds, setSentToUserIds] = useState(new Set());
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const queryClient = useQueryClient();

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles-discover'],
    queryFn: () => entities.UserProfile.list('-created_date', 50),
    staleTime: 60000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-discover', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
  });

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-discover', currentUser?.id],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id,
  });

  const { data: servers = [] } = useQuery({
    queryKey: ['servers-discover'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 60000,
  });

  // Build set of user IDs that should be excluded — already friends, pending
  // requests, blocked, and self. This is used by both AI and fallback paths.
  const excludedIds = React.useMemo(() => {
    const ids = new Set([currentUser?.id]);
    friends.forEach(f => {
      // includes accepted, pending_outgoing, pending_incoming, blocked
      if (f.friend_id) ids.add(f.friend_id);
    });
    return ids;
  }, [friends, currentUser?.id]);

  // Pool of candidates the algorithmic fallback ranks
  const candidates = React.useMemo(() => {
    return allProfiles.filter(p =>
      p.user_id && !excludedIds.has(p.user_id)
    );
  }, [allProfiles, excludedIds]);

  // Servers the current user is in — used for "shared servers" scoring
  const mySharedServerIds = React.useMemo(() => {
    return new Set(
      servers
        .filter(s => s.owner_id === currentUser?.id || s.members?.some(m => m.user_id === currentUser?.id))
        .map(s => s.id)
    );
  }, [servers, currentUser?.id]);

  // ── Algorithmic suggestions (the dependable fallback) ──────────────────────
  // Scoring is dead-simple so a user without an LLM key still sees a useful list:
  //   • +3 per shared server (you're more likely to know each other)
  //   • +2 if they're online right now
  //   • +1 if they have a bio (less likely to be a dummy account)
  //   • +1 if their profile was created in the last 30 days (give new users love)
  function rankAlgorithmic(pool) {
    return pool
      .map(p => {
        let score = 0;
        const reasons = [];
        let sharedCount = 0;
        for (const s of servers) {
          if (!mySharedServerIds.has(s.id)) continue;
          if (s.members?.some(m => m.user_id === p.user_id) || s.owner_id === p.user_id) sharedCount++;
        }
        if (sharedCount > 0) {
          score += sharedCount * 3;
          reasons.push(`In ${sharedCount} of your server${sharedCount === 1 ? '' : 's'}`);
        }
        if (p.status === 'online') {
          score += 2;
          if (reasons.length === 0) reasons.push('Online now');
        }
        if (p.bio && p.bio.trim().length > 5) {
          score += 1;
        }
        if (p.created_date) {
          const ageMs = Date.now() - new Date(p.created_date).getTime();
          if (ageMs < 30 * 24 * 60 * 60 * 1000) {
            score += 1;
            if (reasons.length === 0) reasons.push('New to Spidr');
          }
        }
        // Last-resort reason so the card never shows empty
        if (reasons.length === 0) {
          reasons.push(p.bio?.trim() || 'Suggested for you');
        }
        return { profile: p, score, reason: reasons[0] };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ profile, score, reason }) => ({
        ...profile,
        reason,
        match_score: Math.min(95, 40 + score * 8),
      }));
  }

  // ── Try to get suggestions via the LLM, with algorithmic fallback ──────────
  // `silent` = first auto-load (shows results without spinner if cache hits).
  // When the user explicitly clicks Rescan we re-shuffle the candidate pool so
  // they see different suggestions even if the LLM is unavailable.
  const generateSuggestions = async (silent = false) => {
    if (!silent) setIsGenerating(true);

    if (candidates.length === 0) {
      setSuggestions([]);
      setIsGenerating(false);
      setHasLoadedOnce(true);
      return;
    }

    // Always compute the fallback first — we'll show it if the LLM fails OR
    // we'll use it to enrich the LLM's response. On explicit rescans, shuffle
    // the candidate pool so the algorithmic ranking lands on different people.
    const pool = silent ? candidates : [...candidates].sort(() => Math.random() - 0.5);
    const algorithmic = rankAlgorithmic(pool);

    // If the LLM has failed before in this session, skip straight to fallback.
    if (!aiAvailable) {
      setSuggestions(algorithmic);
      setIsGenerating(false);
      setHasLoadedOnce(true);
      return;
    }

    try {
      const myServers = servers.filter(s => mySharedServerIds.has(s.id));
      const myServerNames = myServers.map(s => s.name).join(', ') || '(none yet)';
      const myInterests = myProfile?.bio?.trim() || 'No bio set';

      const candidateList = candidates.slice(0, 20).map(p => ({
        id: p.user_id,
        name: p.display_name || 'Unknown',
        bio: (p.bio || '').slice(0, 200),
        status: p.status,
        servers: servers.filter(s => s.members?.some(m => m.user_id === p.user_id)).map(s => s.name).slice(0, 5).join(', '),
      }));

      const result = await integrations.Core.InvokeLLM({
        prompt: `You are a social matching AI for the Spidr chat platform.

Current user's bio: "${myInterests}"
Current user's servers: "${myServerNames}"

Here are potential users to suggest:
${JSON.stringify(candidateList, null, 2)}

Pick the top 5 most relevant users this person should connect with based on shared interests, server overlap, or complementary profiles. For each, write a short 1-sentence reason why they'd be a good match.

Return ONLY the JSON with no extra text.`,
        response_json_schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'string' },
                  reason: { type: 'string' },
                  match_score: { type: 'number' },
                },
              },
            },
          },
        },
      });

      const llmSuggestions = (result?.suggestions || [])
        .map(s => {
          const profile = allProfiles.find(p => p.user_id === s.user_id);
          if (!profile) return null;
          // Skip placeholder reasons returned by the no-key stub
          const isStub = typeof s.reason === 'string' && s.reason.startsWith('[AI not configured');
          return profile
            ? {
                ...profile,
                reason: isStub ? null : s.reason,
                match_score: s.match_score,
              }
            : null;
        })
        .filter(Boolean)
        .filter(s => !excludedIds.has(s.user_id));

      if (llmSuggestions.length > 0 && llmSuggestions.some(s => s.reason)) {
        // Real LLM response with at least one real reason — use it, but
        // backfill missing reasons from the algorithmic ranking
        const algorithmicReasonMap = Object.fromEntries(
          algorithmic.map(a => [a.user_id, a.reason])
        );
        setSuggestions(llmSuggestions.map(s => ({
          ...s,
          reason: s.reason || algorithmicReasonMap[s.user_id] || 'Suggested for you',
        })));
      } else {
        // Empty or stubbed response — fall back to algorithmic suggestions
        setAiAvailable(false);
        setSuggestions(algorithmic);
      }
    } catch (err) {
      // Network error, 500, etc. — fall back gracefully
      console.warn('DiscoverUsers: LLM unavailable, using algorithmic fallback:', err?.message);
      setAiAvailable(false);
      setSuggestions(algorithmic);
    } finally {
      setIsGenerating(false);
      setHasLoadedOnce(true);
    }
  };

  // Auto-load suggestions once the candidate pool is available.
  // Re-runs if the user's friend list changes (e.g., after sending a request).
  useEffect(() => {
    if (hasLoadedOnce) return;
    if (!currentUser?.id) return;
    if (allProfiles.length === 0) return; // wait for profiles to load
    generateSuggestions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, allProfiles.length]);

  const sendRequest = useMutation({
    mutationFn: async (targetProfile) => {
      await entities.Friend.create({
        user_id: currentUser?.id,
        friend_id: targetProfile.user_id,
        friend_name: targetProfile.display_name,
        friend_avatar: targetProfile.avatar_url,
        status: 'pending_outgoing',
      });
      await entities.Friend.create({
        user_id: targetProfile.user_id,
        friend_id: currentUser?.id,
        friend_name: myProfile?.display_name || currentUser?.full_name,
        friend_avatar: myProfile?.avatar_url,
        status: 'pending_incoming',
      });
      return targetProfile;
    },
    onSuccess: (target) => {
      toast.success(`Request sent to ${target.display_name || 'user'}!`);
      setSentToUserIds(prev => new Set(prev).add(target.user_id));
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friends-discover', currentUser?.id] });
    },
    onError: (err) => {
      toast.error('Could not send request: ' + (err?.message || 'unknown'));
    },
  });

  // Filter out the people we just sent requests to so the list refreshes visually
  const visibleSuggestions = suggestions.filter(s => !sentToUserIds.has(s.user_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-bold text-white">
            {aiAvailable ? 'Discover People' : 'Suggested for you'}
          </h3>
        </div>
        <Button
          onClick={() => generateSuggestions(false)}
          disabled={isGenerating}
          size="sm"
          className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          {isGenerating ? 'Scanning...' : visibleSuggestions.length ? 'Rescan' : 'Refresh'}
        </Button>
      </div>

      {isGenerating && visibleSuggestions.length === 0 && (
        <div className="text-center py-10">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkles className="w-8 h-8 text-yellow-500 mx-auto" />
          </motion.div>
          <p className="text-zinc-400 text-sm mt-3">Looking for people you might know...</p>
        </div>
      )}

      {!isGenerating && hasLoadedOnce && visibleSuggestions.length === 0 && (
        <div className="text-center py-8 bg-zinc-800/30 rounded-xl border border-red-900/20">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">
            {candidates.length === 0
              ? "You're connected with everyone on Spidr right now!"
              : "No more suggestions for now — try Rescan."}
          </p>
        </div>
      )}

      <AnimatePresence>
        {visibleSuggestions.map((user, i) => {
          const alreadySent = sentToUserIds.has(user.user_id);
          return (
            <motion.div
              key={user.user_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-transparent hover:border-red-900/30"
            >
              <div className="relative cursor-pointer" onClick={() => setSelectedProfileId(user.user_id)}>
                <Avatar className="w-11 h-11">
                  {user.avatar_url ? <AvatarImage src={user.avatar_url} /> : (
                    <AvatarFallback className="bg-red-900 text-white">{user.display_name?.charAt(0) || 'U'}</AvatarFallback>
                  )}
                </Avatar>
                {user.match_score && (
                  <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-zinc-900">
                    {Math.round(user.match_score)}%
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{user.display_name || 'User'}</p>
                <p className="text-[11px] text-yellow-400/80 truncate flex items-center gap-1">
                  <Zap className="w-3 h-3 shrink-0" /> {user.reason}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => sendRequest.mutate(user)}
                disabled={sendRequest.isPending || alreadySent}
                className={alreadySent ? 'bg-zinc-700 cursor-default' : 'bg-red-600 hover:bg-red-700 shrink-0'}
              >
                {alreadySent ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <HolographicProfile
        open={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
        userId={selectedProfileId}
        currentUser={currentUser}
        onOpenDM={(friendId, conversationId) => {
          setSelectedProfileId(null);
          if (onNavigateToDM) onNavigateToDM(friendId, conversationId);
        }}
      />
    </div>
  );
}
