import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Hash, Volume2, Plus, Trash2, Shield, Settings, Image, Globe, Lock } from 'lucide-react';
import SanctuaryProtocols from './SanctuaryProtocols';
import ServerAuditLog from './ServerAuditLog';
import ServerReportsPanel from './ServerReportsPanel';
import AirlockSettings from './AirlockSettings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { scanContent } from './ContentScanner';
import ContentBlockedModal from './ContentBlockedModal';

export default function ServerSettingsModal({ open, onClose, server, currentUser }) {
  const [formData, setFormData] = useState({
    name: server?.name || '',
    description: server?.description || '',
    icon_url: server?.icon_url || '',
    banner_url: server?.banner_url || ''
  });
  const [channels, setChannels] = useState(server?.channels || []);
  const [roles, setRoles] = useState(server?.roles || [
    { id: 'admin', name: 'Admin', color: '#dc2626', permissions: ['all'] },
    { id: 'moderator', name: 'Moderator', color: '#f59e0b', permissions: ['kick', 'mute', 'manage_messages'] },
    { id: 'member', name: 'Member', color: '#6b7280', permissions: ['send_messages', 'read_messages'] }
  ]);

  // Sync state when server prop changes
  React.useEffect(() => {
    if (server) {
      setFormData({
        name: server.name || '',
        description: server.description || '',
        icon_url: server.icon_url || '',
        banner_url: server.banner_url || ''
      });
      setChannels(server.channels || []);
      setEmojis(server.emojis || []);
      setHiddenRoles(server.hidden_roles || []);
      setSanctuarySettings(server.sanctuary || {});
      setAirlockSettings(server.airlock || { enabled: false, quarantine_channel: '' });
      setRoles(server.roles || [
        { id: 'admin', name: 'Admin', color: '#dc2626', permissions: ['all'] },
        { id: 'moderator', name: 'Moderator', color: '#f59e0b', permissions: ['kick', 'mute', 'manage_messages'] },
        { id: 'member', name: 'Member', color: '#6b7280', permissions: ['send_messages', 'read_messages'] }
      ]);
    }
  }, [server]);
  const [newChannel, setNewChannel] = useState({ name: '', type: 'text' });
  const [newRole, setNewRole] = useState({ name: '', color: '#dc2626' });
  const [emojis, setEmojis] = useState(server?.emojis || []);
  const [newEmoji, setNewEmoji] = useState({ name: '', url: '' });
  const [hiddenRoles, setHiddenRoles] = useState(server?.hidden_roles || []);
  const [sanctuarySettings, setSanctuarySettings] = useState(server?.sanctuary || {});
  const [airlockSettings, setAirlockSettings] = useState(server?.airlock || { enabled: false, quarantine_channel: '' });
  const [blockedCategory, setBlockedCategory] = useState(null);

  const queryClient = useQueryClient();

  const updateServerMutation = useMutation({
    mutationFn: (data) => base44.entities.Server.update(server.id, data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server updated!');
      // Log the settings change
      base44.entities.ServerAuditLog.create({
        server_id: server.id,
        actor_id: currentUser?.id,
        actor_name: currentUser?.full_name || currentUser?.email,
        action: 'SERVER_SETTINGS_UPDATE',
        category: 'admin',
        target_name: server.name,
        details: `Updated server settings`
      });
      onClose();
    }
  });

  const handleSave = () => {
    const data = {
      name: formData.name,
      description: formData.description,
      icon_url: formData.icon_url,
      banner_url: formData.banner_url,
      channels,
      roles,
      emojis,
      hidden_roles: hiddenRoles,
      sanctuary: sanctuarySettings,
      airlock: airlockSettings
    };
    
    updateServerMutation.mutate(data);
  };

  const addChannel = () => {
    if (!newChannel.name.trim()) return;
    const channelId = newChannel.name.toLowerCase().replace(/\s+/g, '-');
    setChannels([...channels, { id: channelId, ...newChannel }]);
    base44.entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.email,
      action: 'CHANNEL_CREATE', category: 'admin',
      target_name: newChannel.name, details: `Type: ${newChannel.type}`
    });
    setNewChannel({ name: '', type: 'text' });
  };

  const removeChannel = (id) => {
    const ch = channels.find(c => c.id === id);
    setChannels(channels.filter(c => c.id !== id));
    base44.entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.email,
      action: 'CHANNEL_DELETE', category: 'admin',
      target_name: ch?.name || id, details: `Channel removed`
    });
  };

  const addRole = () => {
    if (!newRole.name.trim()) return;
    const roleId = newRole.name.toLowerCase().replace(/\s+/g, '-');
    setRoles([...roles, { id: roleId, ...newRole, permissions: ['send_messages', 'read_messages'] }]);
    base44.entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.email,
      action: 'ROLE_CREATE', category: 'admin',
      target_name: newRole.name, details: `New role created`
    });
    setNewRole({ name: '', color: '#dc2626' });
  };

  const removeRole = (id) => {
    if (['admin', 'member'].includes(id)) return;
    const role = roles.find(r => r.id === id);
    setRoles(roles.filter(r => r.id !== id));
    base44.entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.email,
      action: 'ROLE_DELETE', category: 'admin',
      target_name: role?.name || id, details: `Role removed`
    });
  };

  const addEmoji = async () => {
    if (!newEmoji.name.trim() || !newEmoji.url.trim()) return;
    const emojiId = newEmoji.name.toLowerCase().replace(/\s+/g, '-');
    setEmojis([...emojis, { id: emojiId, ...newEmoji }]);
    setNewEmoji({ name: '', url: '' });
  };

  const removeEmoji = (id) => {
    setEmojis(emojis.filter(e => e.id !== id));
  };

  const handleEmojiUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const scan = await scanContent(file_url);
      if (!scan.safe) {
        setBlockedCategory(scan.category);
        return;
      }
      setNewEmoji({ ...newEmoji, url: file_url });
      toast.success(`Emoji uploaded${file.type === 'image/gif' ? ' (GIF)' : ''}!`);
    } catch {
      toast.error('Upload failed');
    }
  };

  const updateRolePermissions = (roleId, newPermissions) => {
    setRoles(roles.map(r => r.id === roleId ? { ...r, permissions: newPermissions } : r));
  };

  const availablePermissions = [
    { id: 'send_messages', label: 'Send Messages' },
    { id: 'read_messages', label: 'Read Messages' },
    { id: 'manage_messages', label: 'Manage Messages' },
    { id: 'kick', label: 'Kick Members' },
    { id: 'mute', label: 'Mute Members' },
    { id: 'manage_channels', label: 'Manage Channels' },
    { id: 'manage_roles', label: 'Manage Roles' },
    { id: 'give_nicknames', label: 'Give Nicknames' },
    { id: 'administrator', label: 'Administrator' }
  ];

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const scan = await scanContent(file_url);
      if (!scan.safe) {
        setBlockedCategory(scan.category);
        return;
      }
      setFormData({ ...formData, [field]: file_url });
      toast.success('Image uploaded!');
    } catch {
      toast.error('Upload failed');
    }
  };

  const isOwner = currentUser?.id === server?.owner_id || currentUser?.email === server?.owner_id;

  if (!server) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-red-900/30 max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-red-500" />
            Server Settings - {server.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="bg-zinc-800 border-red-900/30 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="visibility">Visibility</TabsTrigger>
            <TabsTrigger value="emojis">Emojis</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="reports" className="text-orange-400">🚩 Reports</TabsTrigger>
            <TabsTrigger value="airlock" className="text-purple-400">🛡️ Airlock</TabsTrigger>
            <TabsTrigger value="sanctuary" className="text-red-400">🔒 Safety</TabsTrigger>
            <TabsTrigger value="logs" className="text-yellow-400">📋 Logs</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="overview" className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Server Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  disabled={!isOwner}
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  disabled={!isOwner}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Server Icon</label>
                  <div className="flex items-center gap-3">
                    {formData.icon_url ? (
                      <img src={formData.icon_url} className="w-16 h-16 rounded-xl object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center">
                        <Image className="w-6 h-6 text-zinc-500" />
                      </div>
                    )}
                    {isOwner && (
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>Upload</span>
                        </Button>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'icon_url')} />
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Server Banner</label>
                  <div className="flex items-center gap-3">
                    {formData.banner_url ? (
                      <img src={formData.banner_url} className="w-24 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-24 h-16 rounded-lg bg-zinc-800 flex items-center justify-center">
                        <Image className="w-6 h-6 text-zinc-500" />
                      </div>
                    )}
                    {isOwner && (
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>Upload</span>
                        </Button>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'banner_url')} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="channels" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Channel name"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white flex-1"
                />
                <select
                  value={newChannel.type}
                  onChange={(e) => setNewChannel({ ...newChannel, type: e.target.value })}
                  className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-3"
                >
                  <option value="text">Text</option>
                  <option value="voice">Voice</option>
                </select>
                <Button onClick={addChannel} className="bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Text Channels</p>
                {channels.filter(c => c.type === 'text').map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-zinc-500" />
                      <span className="text-white">{channel.name}</span>
                    </div>
                    {isOwner && channel.id !== 'general' && (
                      <Button size="icon" variant="ghost" onClick={() => removeChannel(channel.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <p className="text-xs text-zinc-500 uppercase font-semibold mt-4">Voice Channels</p>
                {channels.filter(c => c.type === 'voice').map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-zinc-500" />
                      <span className="text-white">{channel.name}</span>
                    </div>
                    {isOwner && (
                      <Button size="icon" variant="ghost" onClick={() => removeChannel(channel.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="roles" className="space-y-4">
              {isOwner && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Role name"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white flex-1"
                  />
                  <input
                    type="color"
                    value={newRole.color}
                    onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                    className="w-10 h-10 rounded-md cursor-pointer"
                  />
                  <Button onClick={addRole} className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {roles.map((role) => (
                  <div key={role.id} className="bg-zinc-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" style={{ color: role.color }} />
                        <span className="text-white font-semibold">{role.name}</span>
                      </div>
                      {isOwner && !['admin', 'member'].includes(role.id) && (
                        <Button size="icon" variant="ghost" onClick={() => removeRole(role.id)} className="text-red-500 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {isOwner && (
                      <div className="grid grid-cols-2 gap-2">
                        {availablePermissions.map((perm) => (
                          <label key={perm.id} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white">
                            <input
                              type="checkbox"
                              checked={role.permissions?.includes(perm.id) || false}
                              onChange={(e) => {
                                const newPerms = e.target.checked
                                  ? [...(role.permissions || []), perm.id]
                                  : (role.permissions || []).filter(p => p !== perm.id);
                                updateRolePermissions(role.id, newPerms);
                              }}
                              className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 cursor-pointer"
                            />
                            {perm.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="visibility" className="space-y-4">
              {/* Public / Invite Only Toggle */}
              {isOwner && (
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <p className="text-white font-semibold mb-3">Server Visibility</p>
                  <p className="text-xs text-zinc-400 mb-4">Control whether your server is discoverable publicly or invite-only:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateServerMutation.mutate({ is_public: true })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        server.is_public !== false
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                      }`}
                    >
                      <Globe className={`w-6 h-6 ${server.is_public !== false ? 'text-blue-500' : 'text-zinc-500'}`} />
                      <p className="text-xs font-bold text-white uppercase">Public</p>
                      <p className="text-[10px] text-zinc-500">Discoverable on Signal Radar</p>
                    </button>
                    <button
                      onClick={() => updateServerMutation.mutate({ is_public: false })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        server.is_public === false
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                      }`}
                    >
                      <Lock className={`w-6 h-6 ${server.is_public === false ? 'text-red-500' : 'text-zinc-500'}`} />
                      <p className="text-xs font-bold text-white uppercase">Invite Only</p>
                      <p className="text-[10px] text-zinc-500">Hidden, requires invite link</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Hide Roles */}
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <p className="text-white font-semibold mb-3">Hide Roles in Community Sidebar</p>
                <p className="text-xs text-zinc-400 mb-4">Select which roles should be hidden from the community member list:</p>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-3 p-2 rounded hover:bg-zinc-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hiddenRoles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setHiddenRoles([...hiddenRoles, role.id]);
                          } else {
                            setHiddenRoles(hiddenRoles.filter(id => id !== role.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 cursor-pointer"
                        disabled={['admin', 'member'].includes(role.id)}
                      />
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" style={{ color: role.color }} />
                        <span className="text-white">{role.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="emojis" className="space-y-4">
              {isOwner && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Emoji Name</label>
                    <Input
                      placeholder="e.g., heart, flame, custom"
                      value={newEmoji.name}
                      onChange={(e) => setNewEmoji({ ...newEmoji, name: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Emoji Image</label>
                    <div className="flex items-center gap-3">
                      {newEmoji.url ? (
                        <img src={newEmoji.url} alt="emoji" className="w-12 h-12 rounded" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center">
                          <Image className="w-6 h-6 text-zinc-500" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>Upload</span>
                        </Button>
                        <input type="file" className="hidden" accept="image/*,.gif" onChange={handleEmojiUpload} />
                      </label>
                    </div>
                  </div>
                  <Button onClick={addEmoji} className="bg-red-600 hover:bg-red-700 w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Emoji
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Server Emojis</p>
                {emojis.length === 0 ? (
                  <p className="text-zinc-500 text-sm py-4 text-center">No custom emojis yet</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {emojis.map((emoji) => (
                      <div key={emoji.id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <img src={emoji.url} alt={emoji.name} className="w-8 h-8" />
                          <span className="text-white text-sm">{emoji.name}</span>
                        </div>
                        {isOwner && (
                          <Button size="icon" variant="ghost" onClick={() => removeEmoji(emoji.id)} className="text-red-500 hover:text-red-400 h-6 w-6">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <ServerReportsPanel serverId={server?.id} currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="airlock" className="space-y-4">
              <AirlockSettings
                server={server}
                airlock={airlockSettings}
                onChange={setAirlockSettings}
                channels={channels}
              />
            </TabsContent>

            <TabsContent value="sanctuary" className="space-y-4">
              <SanctuaryProtocols
                server={server}
                settings={sanctuarySettings}
                onChange={setSanctuarySettings}
              />
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <ServerAuditLog serverId={server?.id} />
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              {/* Show pending verification members first if airlock is on */}
              {server.airlock?.enabled && (server.members || []).some(m => m.verified === false) && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-2">⏳ Pending Verification</p>
                  <div className="space-y-2">
                    {(server.members || []).filter(m => m.verified === false).map((member, idx) => (
                      <div key={`pend-${idx}`} className="flex items-center justify-between bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-yellow-900 flex items-center justify-center text-white text-sm">
                            {member.user_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-white">{member.user_name || member.user_id}</span>
                        </div>
                        {isOwner && (
                          <button
                            onClick={async () => {
                              const updatedMembers = (server.members || []).map(m =>
                                m.user_id === member.user_id ? { ...m, verified: true } : m
                              );
                              await base44.entities.Server.update(server.id, { members: updatedMembers });
                              queryClient.invalidateQueries({ queryKey: ['servers'] });
                              toast.success(`${member.user_name || 'User'} verified!`);
                            }}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            ✓ Verify
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(server.members || []).filter(m => m.verified !== false).map((member, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-900 flex items-center justify-center text-white text-sm">
                        {member.user_name?.charAt(0) || member.user_id?.charAt(0) || '?'}
                      </div>
                      <span className="text-white">{member.user_name || member.user_id}</span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300">
                      {member.role || 'member'}
                    </span>
                  </div>
                ))}
                {(!server.members || server.members.length === 0) && (
                  <p className="text-zinc-500 text-center py-4">No members yet</p>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-800">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {isOwner && (
            <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700" disabled={updateServerMutation.isPending}>
              Save Changes
            </Button>
          )}
        </div>
        <ContentBlockedModal
          open={!!blockedCategory}
          onClose={() => setBlockedCategory(null)}
          category={blockedCategory}
        />
      </DialogContent>
    </Dialog>
  );
}