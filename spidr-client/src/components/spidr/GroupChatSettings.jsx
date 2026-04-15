import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { entities, auth, integrations } from '@/api/apiClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, X, UserPlus, Crown, Trash2, LogOut, Users, Image as ImageIcon } from 'lucide-react';
import ImageCropper from './ImageCropper';

export default function GroupChatSettings({ open, onClose, group, currentUser }) {
  const [groupName, setGroupName] = useState(group?.name || '');
  const [groupAvatar, setGroupAvatar] = useState(group?.avatar_url || '');
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  
  const queryClient = useQueryClient();

  const updateGroupMutation = useMutation({
    mutationFn: async (data) => {
      await entities.GroupChat.update(group.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success('Group updated successfully!');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId) => {
      const updatedMembers = group.members.filter(m => m.user_id !== userId);
      await entities.GroupChat.update(group.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      toast.success('Member removed');
    }
  });

  const promoteMemberMutation = useMutation({
    mutationFn: async (userId) => {
      const updatedMembers = group.members.map(m => 
        m.user_id === userId ? { ...m, role: m.role === 'admin' ? 'member' : 'admin' } : m
      );
      await entities.GroupChat.update(group.id, { members: updatedMembers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      toast.success('Member role updated');
    }
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const updatedMembers = group.members.filter(m => m.user_id !== currentUser.id);
      if (updatedMembers.length === 0) {
        await entities.GroupChat.delete(group.id);
      } else {
        await entities.GroupChat.update(group.id, { members: updatedMembers });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success('Left group');
      onClose();
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      await entities.GroupChat.delete(group.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success('Group deleted');
      onClose();
    }
  });

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImage(reader.result);
        setShowImageCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAvatar = async (croppedImage) => {
    const blob = await fetch(croppedImage).then(r => r.blob());
    const file = new File([blob], 'avatar.png', { type: 'image/png' });
    const { url: file_url } = await integrations.Core.UploadFile({ file });
    setGroupAvatar(file_url);
    setShowImageCropper(false);
    toast.success('Avatar uploaded!');
  };

  const handleSaveSettings = async () => {
    updateGroupMutation.mutate({ name: groupName, avatar_url: groupAvatar });
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) return;
    
    try {
      const users = await entities.User.list();
      const user = users.find(u => u.email === newMemberEmail);
      
      if (!user) {
        toast.error('User not found');
        return;
      }

      if (group.members.some(m => m.user_id === user.id)) {
        toast.error('User already in group');
        return;
      }

      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      const profile = profiles[0];

      const newMember = {
        user_id: user.id,
        user_name: profile?.display_name || user.full_name,
        user_avatar: profile?.avatar_url || '',
        role: 'member'
      };

      await entities.GroupChat.update(group.id, {
        members: [...group.members, newMember]
      });

      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      toast.success('Member added!');
      setNewMemberEmail('');
      setShowAddMember(false);
    } catch (error) {
      toast.error('Failed to add member');
    }
  };

  const isAdmin = group?.members?.find(m => m.user_id === currentUser?.id)?.role === 'admin';
  const isCreator = group?.creator_id === currentUser?.id;

  if (!group) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-zinc-900 border-red-900/30 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-500">Group Settings</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="bg-zinc-800 border border-red-900/30 grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6 mt-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="w-32 h-32 border-4 border-red-600">
                    <AvatarImage src={groupAvatar} />
                    <AvatarFallback className="bg-gradient-to-br from-red-700 to-red-900 text-white text-3xl">
                      <Users className="w-16 h-16" />
                    </AvatarFallback>
                  </Avatar>
                  {isAdmin && (
                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                      <Upload className="w-8 h-8 text-white" />
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              {/* Group Name */}
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-zinc-800 border-red-900/30"
                  placeholder="Enter group name"
                />
              </div>

              {/* Save Button */}
              {isAdmin && (
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateGroupMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {updateGroupMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              )}

              {/* Danger Zone */}
              <div className="pt-4 border-t border-red-900/30 space-y-3">
                <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
                
                <Button
                  onClick={() => leaveGroupMutation.mutate()}
                  disabled={leaveGroupMutation.isPending}
                  variant="outline"
                  className="w-full border-red-900/50 hover:bg-red-950/50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Group
                </Button>

                {isCreator && (
                  <Button
                    onClick={() => {
                      if (confirm('Delete this group permanently? This cannot be undone.')) {
                        deleteGroupMutation.mutate();
                      }
                    }}
                    disabled={deleteGroupMutation.isPending}
                    variant="destructive"
                    className="w-full bg-red-700 hover:bg-red-800"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Group
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="mt-4 space-y-4">
              {/* Add Member */}
              {isAdmin && (
                <div className="space-y-3">
                  {showAddMember ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter user email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="bg-zinc-800 border-red-900/30"
                      />
                      <Button onClick={handleAddMember} className="bg-red-600 hover:bg-red-700">
                        Add
                      </Button>
                      <Button onClick={() => setShowAddMember(false)} variant="outline">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setShowAddMember(true)} className="w-full bg-red-600 hover:bg-red-700">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Member
                    </Button>
                  )}
                </div>
              )}

              {/* Members List */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {group.members?.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-red-900/20"
                    >
                      <Avatar>
                        <AvatarImage src={member.user_avatar} />
                        <AvatarFallback className="bg-red-800 text-white">
                          {member.user_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <p className="font-medium">{member.user_name}</p>
                        <p className="text-sm text-zinc-400 flex items-center gap-2">
                          {member.role === 'admin' && <Crown className="w-3 h-3 text-yellow-500" />}
                          {member.role === 'admin' ? 'Admin' : 'Member'}
                          {member.user_id === group.creator_id && ' • Creator'}
                        </p>
                      </div>

                      {isAdmin && member.user_id !== currentUser.id && (
                        <div className="flex gap-2">
                          {member.user_id !== group.creator_id && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => promoteMemberMutation.mutate(member.user_id)}
                                className="border-red-900/30"
                              >
                                {member.role === 'admin' ? 'Demote' : 'Promote'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(`Remove ${member.user_name} from group?`)) {
                                    removeMemberMutation.mutate(member.user_id);
                                  }
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Image Cropper */}
      {showImageCropper && (
        <ImageCropper
          image={tempImage}
          onSave={handleSaveAvatar}
          onCancel={() => setShowImageCropper(false)}
        />
      )}
    </>
  );
}
