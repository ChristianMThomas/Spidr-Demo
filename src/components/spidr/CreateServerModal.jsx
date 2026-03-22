import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, X, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateServerModal({ open, onClose, currentUser }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon_url: '',
    banner_url: '',
    is_public: true
  });

  const createServerMutation = useMutation({
    mutationFn: async (data) => {
      const newServer = await base44.entities.Server.create({
        ...data,
        owner_id: currentUser?.id,
        members: [{
          user_id: currentUser?.id,
          user_name: currentUser?.full_name || currentUser?.email,
          user_avatar: currentUser?.avatar_url || '',
          role: 'admin'
        }],
        channels: [
          { id: 'general', name: 'general', type: 'text' },
          { id: 'random', name: 'random', type: 'text' },
          { id: 'voice', name: 'General Voice', type: 'voice' }
        ],
        roles: [
          { id: 'admin', name: 'Admin', color: '#dc2626', permissions: ['all'] },
          { id: 'moderator', name: 'Moderator', color: '#f59e0b', permissions: ['kick', 'mute', 'manage_messages'] },
          { id: 'member', name: 'Member', color: '#6b7280', permissions: ['send_messages', 'read_messages'] }
        ]
      });
      return newServer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server created!');
      onClose();
      setFormData({ name: '', description: '', icon_url: '', banner_url: '', is_public: true });
    },
    onError: (err) => toast.error(err?.message || 'Failed to create server. Please try again.'),
  });

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, [field]: file_url }));
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Server name is required');
      return;
    }
    createServerMutation.mutate({
      name: formData.name,
      description: formData.description,
      icon_url: formData.icon_url,
      banner_url: formData.banner_url,
      is_public: formData.is_public
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-red-900/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Your Server</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon Preview */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-600 flex items-center justify-center overflow-hidden group-hover:border-red-500 transition-colors">
                {formData.icon_url ? (
                  <img src={formData.icon_url} alt="Icon" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-8 h-8 text-zinc-500 group-hover:text-red-400 transition-colors" />
                )}
              </div>
              <input type="file" accept="image/*,.gif" className="hidden" onChange={(e) => handleFileUpload(e, 'icon_url')} />
              {formData.icon_url && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFormData(prev => ({ ...prev, icon_url: '' }));
                  }}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </label>
          </div>
          <p className="text-center text-xs text-zinc-500">Upload icon (GIFs supported!)</p>

          <div>
            <Label className="text-zinc-300">Server Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Awesome Server"
              className="bg-zinc-800 border-zinc-700 text-white mt-1"
            />
          </div>

          <div>
            <Label className="text-zinc-300">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What's your server about?"
              className="bg-zinc-800 border-zinc-700 text-white mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label className="text-zinc-300">Banner URL (GIFs supported!)</Label>
            <Input
              value={formData.banner_url}
              onChange={(e) => setFormData(prev => ({ ...prev, banner_url: e.target.value }))}
              placeholder="https://example.com/banner.gif"
              className="bg-zinc-800 border-zinc-700 text-white mt-1"
            />
          </div>

          {/* Visibility Toggle */}
          <div>
            <Label className="text-zinc-300 mb-2 block">Visibility</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, is_public: true }))}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  formData.is_public 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                }`}
              >
                <Globe className={`w-6 h-6 ${formData.is_public ? 'text-blue-500' : 'text-zinc-500'}`} />
                <div className="text-center">
                  <p className="text-xs font-bold text-white uppercase">Public</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Discoverable on Signal Radar</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, is_public: false }))}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  !formData.is_public 
                    ? 'border-red-500 bg-red-500/10' 
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                }`}
              >
                <Lock className={`w-6 h-6 ${!formData.is_public ? 'text-red-500' : 'text-zinc-500'}`} />
                <div className="text-center">
                  <p className="text-xs font-bold text-white uppercase">Invite Only</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Hidden, requires invite link</p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700" disabled={createServerMutation.isPending}>
              {createServerMutation.isPending ? 'Creating...' : 'Create Server'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}