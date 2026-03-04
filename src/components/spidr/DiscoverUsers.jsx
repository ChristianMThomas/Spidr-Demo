import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles, UserPlus, RefreshCw, Loader2, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import HolographicProfile from './HolographicProfile';

export default function DiscoverUsers({ currentUser, onNavigateToDM }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const queryClient = useQueryClient();

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles-discover'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 50),
    staleTime: 60000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-discover', currentUser?.id],
    queryFn: () => base44.entities.Friend.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
  });

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-discover', currentUser?.id],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id,
  });

  const { data: servers = [] } = useQuery({
    queryKey: ['servers-discover'],
    queryFn: () => base44.entities.Server.list('-created_date', 50),
    staleTime: 60000,
  });

  const friendIds = new Set(friends.map(f => f.friend_id));

  const generateSuggestions = async () => {
    setIsGenerating(true);
    
    // Get non-friend profiles
    const candidates = allProfiles.filter(p => 
      p.user_id !== currentUser?.id && !friendIds.has(p.user_id)
    );

    if (candidates.length === 0) {
      toast.info('No new users to discover!');
      setIsGenerating(false);
      return;
    }

    // Build context about the user
    const myServers = servers.filter(s => s.members?.some(m => m.user_id === currentUser?.id));
    const myServerNames = myServers.map(s => s.name).join(', ');
    const myInterests = myProfile?.bio || 'No bio';
    
    const candidateList = candidates.slice(0, 20).map(p => ({
      id: p.user_id,
      name: p.display_name || 'Unknown',
      bio: p.bio || '',
      status: p.status,
      servers: servers.filter(s => s.members?.some(m => m.user_id === p.user_id)).map(s => s.name).join(', ')
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a social matching AI for the Spidr chat platform. 
      
Current user's bio: "${myInterests}"
Current user's servers: "${myServerNames}"

Here are potential users to suggest:
${JSON.stringify(candidateList, null, 2)}

Pick the top 5 most relevant users this person should connect with based on shared interests, server overlap, or complementary profiles. For each, write a short 1-sentence reason why they'd be a good match.

Return ONLY the JSON with no extra text.`,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                user_id: { type: "string" },
                reason: { type: "string" },
                match_score: { type: "number" }
              }
            }
          }
        }
      }
    });

    const matched = (result.suggestions || []).map(s => {
      const profile = allProfiles.find(p => p.user_id === s.user_id);
      return profile ? { ...profile, reason: s.reason, match_score: s.match_score } : null;
    }).filter(Boolean);

    setSuggestions(matched);
    setIsGenerating(false);
  };

  const sendRequest = useMutation({
    mutationFn: async (targetProfile) => {
      await base44.entities.Friend.create({
        user_id: currentUser?.id, friend_id: targetProfile.user_id,
        friend_name: targetProfile.display_name, friend_avatar: targetProfile.avatar_url,
        status: 'pending_outgoing'
      });
      await base44.entities.Friend.create({
        user_id: targetProfile.user_id, friend_id: currentUser?.id,
        friend_name: myProfile?.display_name || currentUser?.full_name,
        friend_avatar: myProfile?.avatar_url,
        status: 'pending_incoming'
      });
    },
    onSuccess: (_, target) => {
      toast.success(`Request sent to ${target.display_name}!`);
      queryClient.invalidateQueries(['friends']);
      setSuggestions(prev => prev.filter(s => s.user_id !== target.user_id));
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-bold text-white">AI Discovery</h3>
        </div>
        <Button
          onClick={generateSuggestions}
          disabled={isGenerating}
          size="sm"
          className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          {isGenerating ? 'Scanning...' : suggestions.length ? 'Rescan' : 'Find People'}
        </Button>
      </div>

      {suggestions.length === 0 && !isGenerating && (
        <div className="text-center py-8 bg-zinc-800/30 rounded-xl border border-red-900/20">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Hit "Find People" to discover users matched to your interests</p>
        </div>
      )}

      {isGenerating && (
        <div className="text-center py-10">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkles className="w-8 h-8 text-yellow-500 mx-auto" />
          </motion.div>
          <p className="text-zinc-400 text-sm mt-3">AI is analyzing profiles...</p>
        </div>
      )}

      <AnimatePresence>
        {suggestions.map((user, i) => (
          <motion.div
            key={user.user_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-transparent hover:border-red-900/30"
          >
            <div className="relative cursor-pointer" onClick={() => setSelectedProfileId(user.user_id)}>
              <Avatar className="w-11 h-11">
                {user.avatar_url ? <AvatarImage src={user.avatar_url} /> : (
                  <AvatarFallback className="bg-red-900 text-white">{user.display_name?.charAt(0)}</AvatarFallback>
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
              disabled={sendRequest.isPending}
              className="bg-red-600 hover:bg-red-700 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </motion.div>
        ))}
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