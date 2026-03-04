import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateGroupChatModal({ open, onClose, currentUser, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const queryClient = useQueryClient();

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-for-group'],
    queryFn: async () => {
      const allFriends = await base44.entities.Friend.filter({ 
        user_id: currentUser?.id,
        status: 'accepted'
      });
      return allFriends;
    },
    enabled: open && !!currentUser?.id
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.GroupChat.create(data);
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries(['group-chats']);
      toast.success('Group chat created!');
      onGroupCreated?.(newGroup);
      handleClose();
    }
  });

  const toggleFriend = (friend) => {
    setSelectedFriends(prev => {
      const exists = prev.find(f => f.friend_id === friend.friend_id);
      if (exists) {
        return prev.filter(f => f.friend_id !== friend.friend_id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleCreate = () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    const members = [
      {
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || currentUser?.email,
        user_avatar: currentUser?.avatar_url || '',
        role: 'admin'
      },
      ...selectedFriends.map(f => ({
        user_id: f.friend_id,
        user_name: f.friend_name,
        user_avatar: f.friend_avatar,
        role: 'member'
      }))
    ];

    createGroupMutation.mutate({
      name: groupName,
      creator_id: currentUser?.id,
      members
    });
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedFriends([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-red-900/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            Create Group Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Group Name</label>
            <Input
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400 mb-2 block">
              Select Friends ({selectedFriends.length} selected) - Optional for solo testing
            </label>
            <ScrollArea className="h-64 border border-zinc-800 rounded-lg p-2">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <p>No friends to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => {
                    const isSelected = selectedFriends.find(f => f.friend_id === friend.friend_id);
                    return (
                      <button
                        key={friend.id}
                        onClick={() => toggleFriend(friend)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          isSelected 
                            ? 'bg-red-600/20 border border-red-600/50' 
                            : 'hover:bg-zinc-800'
                        }`}
                      >
                        <Avatar className="w-10 h-10">
                          {friend.friend_avatar ? (
                            <AvatarImage src={friend.friend_avatar} />
                          ) : (
                            <AvatarFallback className="bg-red-900">
                              {friend.friend_name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{friend.friend_name}</p>
                          <p className="text-xs text-zinc-500">
                            {friend.friend_discriminator}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-zinc-700 text-white hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createGroupMutation.isPending}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}