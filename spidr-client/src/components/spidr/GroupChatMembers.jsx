import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Crown, User } from 'lucide-react';

const statusColors = {
  online: '#22c55e',
  offline: '#6b7280',
  idle: '#eab308',
  dnd: '#ef4444'
};

export default function GroupChatMembers({ group, onProfileClick }) {
  const members = group?.members || [];

  // Fetch profiles for all members
  const { data: profiles = [] } = useQuery({
    queryKey: ['group-member-profiles', group?.id],
    queryFn: async () => {
      const userIds = members.map(m => m.user_id);
      if (userIds.length === 0) return [];
      const allProfiles = await entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: members.length > 0
  });

  const admins = members.filter(m => m.role === 'admin');
  const regularMembers = members.filter(m => m.role !== 'admin');

  const getMemberProfile = (userId) => profiles.find(p => p.user_id === userId);

  const renderMember = (member) => {
    const profile = getMemberProfile(member.user_id);
    const status = profile?.status || 'offline';

    return (
      <button
        key={member.user_id}
        onClick={() => onProfileClick(member.user_id)}
        className="w-full flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg transition-colors group"
      >
        <div className="relative">
          <Avatar className="w-10 h-10 border-2 border-zinc-700">
            <AvatarImage src={member.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`} />
            <AvatarFallback className="bg-red-900">
              {member.user_name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div 
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-900"
            style={{ backgroundColor: statusColors[status] }}
          />
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white group-hover:text-red-500 transition-colors">
              {member.user_name}
            </span>
            {member.role === 'admin' && (
              <Crown className="w-3.5 h-3.5 text-yellow-500" />
            )}
          </div>
          {profile?.custom_status && (
            <p className="text-xs text-zinc-500 truncate">{profile.custom_status}</p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="w-60 bg-zinc-900/80 border-l border-zinc-800 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Members — {members.length}
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {admins.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-2 mb-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Admin — {admins.length}
                </h4>
              </div>
              <div className="space-y-1">
                {admins.map(renderMember)}
              </div>
            </div>
          )}

          {regularMembers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-2 mb-2">
                <User className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Members — {regularMembers.length}
                </h4>
              </div>
              <div className="space-y-1">
                {regularMembers.map(renderMember)}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}