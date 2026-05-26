import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { toast } from 'sonner';
import { Hash, Volume2, Plus, Trash2, Shield, Users, Settings, Image, X, FileText, Globe, Lock, Flag, ShieldCheck, BookOpen, ListChecks, GripVertical, MoreVertical } from 'lucide-react';
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

  // Which member row's actions dropdown is open (by index), and a small set of
  // member-management actions usable from the Members tab. These mirror the
  // right-click admin tools available elsewhere.
  const [memberMenuIdx, setMemberMenuIdx] = useState(null);

  const kickMember = async (userId) => {
    if (!window.confirm('Remove this member from the server?')) return;
    try {
      const updated = (server.members || []).filter(m => m.user_id !== userId);
      await entities.Server.update(server.id, { members: updated });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['server', server.id] });
      toast.success('Member removed');
    } catch (err) {
      toast.error(err?.data?.error || 'Could not remove member');
    }
    setMemberMenuIdx(null);
  };

  const changeMemberRole = async (userId, newRole) => {
    try {
      const updated = (server.members || []).map(m =>
        m.user_id === userId ? { ...m, role: newRole } : m
      );
      await entities.Server.update(server.id, { members: updated });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['server', server.id] });
      toast.success(`Role set to ${newRole}`);
    } catch (err) {
      toast.error(err?.data?.error || 'Could not change role');
    }
    setMemberMenuIdx(null);
  };

  // Resolve member display info from UserProfile so the members tab shows
  // @username#discriminator (the user's actual identity) instead of raw
  // user_ids (which are sometimes emails for legacy accounts).
  const memberUserIds = React.useMemo(
    () => [...new Set((server?.members || []).map(m => m.user_id).filter(Boolean))],
    [server?.members]
  );
  const { data: memberProfiles = [] } = useQuery({
    queryKey: ['server-member-profiles', server?.id, memberUserIds.length],
    queryFn: () => entities.UserProfile.filter({ user_id: memberUserIds.join(',') }),
    enabled: open && memberUserIds.length > 0,
    staleTime: 30000,
  });
  const profileByUserId = React.useMemo(
    () => Object.fromEntries(memberProfiles.map(p => [p.user_id, p])),
    [memberProfiles]
  );

  const updateServerMutation = useMutation({
    mutationFn: (data) => entities.Server.update(server.id, data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server updated!');
      // Log the settings change
      entities.ServerAuditLog.create({
        server_id: server.id,
        actor_id: currentUser?.id,
        actor_name: currentUser?.full_name || currentUser?.username,
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
    entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.username,
      action: 'CHANNEL_CREATE', category: 'admin',
      target_name: newChannel.name, details: `Type: ${newChannel.type}`
    });
    setNewChannel({ name: '', type: 'text' });
  };

  const removeChannel = (id) => {
    const ch = channels.find(c => c.id === id);
    setChannels(channels.filter(c => c.id !== id));
    entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.username,
      action: 'CHANNEL_DELETE', category: 'admin',
      target_name: ch?.name || id, details: `Channel removed`
    });
  };

  const addRole = () => {
    if (!newRole.name.trim()) return;
    const roleId = newRole.name.toLowerCase().replace(/\s+/g, '-');
    setRoles([...roles, { id: roleId, ...newRole, permissions: ['send_messages', 'read_messages'] }]);
    entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.username,
      action: 'ROLE_CREATE', category: 'admin',
      target_name: newRole.name, details: `New role created`
    });
    setNewRole({ name: '', color: '#dc2626' });
  };

  const removeRole = (id) => {
    if (['admin', 'member'].includes(id)) return;
    const role = roles.find(r => r.id === id);
    setRoles(roles.filter(r => r.id !== id));
    entities.ServerAuditLog.create({
      server_id: server.id, actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || currentUser?.username,
      action: 'ROLE_DELETE', category: 'admin',
      target_name: role?.name || id, details: `Role removed`
    });
  };

  const addEmoji = async () => {
    if (!newEmoji.name.trim() || !newEmoji.url.trim()) {
      toast.error('Need both a name and an image');
      return;
    }
    const emojiId = newEmoji.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
    if (emojis.some(e => e.id === emojiId)) {
      toast.error('An emoji with that name already exists');
      return;
    }
    const newList = [...emojis, { id: emojiId, name: newEmoji.name.trim(), url: newEmoji.url }];
    setEmojis(newList);
    setNewEmoji({ name: '', url: '' });
    // Persist immediately so user doesn't have to remember to click Save
    try {
      await entities.Server.update(server.id, { emojis: newList });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['all-servers'] });
      queryClient.invalidateQueries({ queryKey: ['community-emojis-picker'] });
      toast.success(`Emoji :${emojiId}: added!`);
    } catch (err) {
      // Roll back local state if the save failed
      setEmojis(emojis);
      toast.error('Could not save emoji: ' + (err?.message || 'unknown'));
    }
  };

  const removeEmoji = async (id) => {
    const newList = emojis.filter(e => e.id !== id);
    setEmojis(newList);
    try {
      await entities.Server.update(server.id, { emojis: newList });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['community-emojis-picker'] });
    } catch (err) {
      setEmojis(emojis);
      toast.error('Could not remove emoji: ' + (err?.message || 'unknown'));
    }
  };

  const handleEmojiUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url: file_url } = await integrations.Core.UploadFile({ file });
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

  // Update an arbitrary field on a role (tag, icon_url, etc.) — 3.1.
  const updateRoleField = (roleId, field, value) => {
    setRoles(roles.map(r => r.id === roleId ? { ...r, [field]: value } : r));
  };

  // Upload a custom icon image for a role (3.1). 1 MB cap, image only.
  const uploadRoleIcon = async (roleId, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image.'); return; }
    if (file.size > 1024 * 1024) { toast.error('Icon must be under 1 MB.'); return; }
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      if (url) { updateRoleField(roleId, 'icon_url', url); toast.success('Role icon set.'); }
    } catch {
      toast.error('Icon upload failed.');
    }
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
      const { url: file_url } = await integrations.Core.UploadFile({ file });
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

  // ── Vertical tab definitions ───────────────────────────────────────────
  // Centralized so the left rail and the tab content stay in sync.
  const TAB_GROUPS = [
    {
      label: 'Server',
      items: [
        { id: 'overview',   label: 'Overview',   icon: Settings,    color: 'text-white' },
        { id: 'channels',   label: 'Channels',   icon: Hash,        color: 'text-white' },
        { id: 'roles',      label: 'Roles',      icon: Shield,      color: 'text-white' },
        { id: 'emojis',     label: 'Emojis',     icon: Image,       color: 'text-white' },
        { id: 'visibility', label: 'Visibility', icon: Globe,       color: 'text-white' },
      ],
    },
    {
      label: 'Community',
      items: [
        { id: 'members',    label: 'Members',    icon: Users,       color: 'text-white' },
      ],
    },
    {
      label: 'Moderation',
      items: [
        { id: 'reports',    label: 'Reports',    icon: Flag,        color: 'text-orange-400' },
        { id: 'airlock',    label: 'Airlock',    icon: ShieldCheck, color: 'text-purple-400' },
        { id: 'sanctuary',  label: 'Safety',     icon: Lock,        color: 'text-red-400' },
        { id: 'logs',       label: 'Audit Log',  icon: ListChecks,  color: 'text-yellow-400' },
      ],
    },
  ];
  const [activeTab, setActiveTab] = useState('overview');

  if (!server) return null;
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="bg-[#020202] border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(220,38,38,0.15)] overflow-hidden flex w-full max-w-5xl"
          style={{ height: 'min(80vh, 720px)' }}
        >
          {/* ─── Left rail ──────────────────────────────────────────────── */}
          <aside className="w-60 shrink-0 bg-[#050505] border-r border-white/5 flex flex-col">
            {/* Server identity header */}
            <div className="px-5 py-5 border-b border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/15 to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3">
                {server.icon_url ? (
                  <img src={server.icon_url} alt={server.name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white text-base font-bold">
                    {server.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest leading-none">Settings</p>
                  <p className="text-white text-sm font-bold truncate mt-1">{server.name}</p>
                </div>
              </div>
            </div>

            {/* Tab nav */}
            <nav className="flex-1 overflow-y-auto py-3">
              {TAB_GROUPS.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="px-5 mb-1.5 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                    {group.label}
                  </p>
                  <div className="space-y-0.5 px-2">
                    {group.items.map((tab) => {
                      const isActive = activeTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all relative group ${
                            isActive
                              ? 'bg-red-600/10 text-white'
                              : `${tab.color} opacity-70 hover:opacity-100 hover:bg-white/5`
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="server-settings-pill"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-red-500 rounded-r-full"
                              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                          )}
                          <Icon className={`w-3.5 h-3.5 ${isActive ? tab.color : ''}`} />
                          <span className="text-xs font-semibold">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer — close button */}
            <div className="border-t border-white/5 p-3">
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </button>
            </div>
          </aside>

          {/* ─── Right content panel ─────────────────────────────────────── */}
          <section className="flex-1 flex flex-col min-w-0 bg-[#020202]">
            {/* Content header */}
            <div className="px-8 py-5 border-b border-white/5 bg-[#0a0a0a] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
                    {TAB_GROUPS.flatMap(g => g.items).find(t => t.id === activeTab)?.label || 'Settings'}
                  </h2>
                  <p className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1">
                    {'>'} {activeTab.toUpperCase()} :: {server.id?.slice(-6).toUpperCase()}
                  </p>
                </div>
                {isOwner && updateServerMutation && (
                  <Button
                    onClick={handleSave}
                    disabled={updateServerMutation.isPending}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider px-5"
                  >
                    Save Changes
                  </Button>
                )}
              </div>
            </div>

            {/* Tab content area */}
            <Tabs value={activeTab} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 px-8 py-6">
                <TabsContent value="overview" className="space-y-4 mt-0">
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
                <DragDropContext
                  onDragEnd={(result) => {
                    if (!result.destination || !isOwner) return;
                    if (result.source.index === result.destination.index) return;
                    // Reorder within text-channels only. Reconstruct the full
                    // channels list by interleaving the reordered text list
                    // with the untouched voice list, preserving original order
                    // of voice channels.
                    const textChannels = channels.filter(c => c.type === 'text');
                    const voiceChannels = channels.filter(c => c.type === 'voice');
                    const [moved] = textChannels.splice(result.source.index, 1);
                    textChannels.splice(result.destination.index, 0, moved);
                    setChannels([...textChannels, ...voiceChannels]);
                  }}
                >
                  <Droppable droppableId="text-channels">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {channels.filter(c => c.type === 'text').map((channel, idx) => (
                          <Draggable
                            key={channel.id}
                            draggableId={`tch-${channel.id}`}
                            index={idx}
                            isDragDisabled={!isOwner}
                          >
                            {(p, snapshot) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                className={`flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2 ${
                                  snapshot.isDragging ? 'ring-2 ring-red-500 shadow-xl' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isOwner && (
                                    <span {...p.dragHandleProps} className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
                                  <span className="text-white truncate">{channel.name}</span>
                                </div>
                                {isOwner && channel.id !== 'general' && (
                                  <Button size="icon" variant="ghost" onClick={() => removeChannel(channel.id)} className="text-red-500 hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                <p className="text-xs text-zinc-500 uppercase font-semibold mt-4">Voice Channels</p>
                <DragDropContext
                  onDragEnd={(result) => {
                    if (!result.destination || !isOwner) return;
                    if (result.source.index === result.destination.index) return;
                    const textChannels = channels.filter(c => c.type === 'text');
                    const voiceChannels = channels.filter(c => c.type === 'voice');
                    const [moved] = voiceChannels.splice(result.source.index, 1);
                    voiceChannels.splice(result.destination.index, 0, moved);
                    setChannels([...textChannels, ...voiceChannels]);
                  }}
                >
                  <Droppable droppableId="voice-channels">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {channels.filter(c => c.type === 'voice').map((channel, idx) => (
                          <Draggable
                            key={channel.id}
                            draggableId={`vch-${channel.id}`}
                            index={idx}
                            isDragDisabled={!isOwner}
                          >
                            {(p, snapshot) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                className={`flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2 ${
                                  snapshot.isDragging ? 'ring-2 ring-red-500 shadow-xl' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isOwner && (
                                    <span {...p.dragHandleProps} className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <Volume2 className="w-4 h-4 text-zinc-500 shrink-0" />
                                  <span className="text-white truncate">{channel.name}</span>
                                </div>
                                {isOwner && (
                                  <Button size="icon" variant="ghost" onClick={() => removeChannel(channel.id)} className="text-red-500 hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
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

              <DragDropContext
                onDragEnd={(result) => {
                  if (!result.destination || !isOwner) return;
                  if (result.source.index === result.destination.index) return;
                  // Reorder roles by their position. Note: admin/member are
                  // special system roles — we still let them move because some
                  // servers genuinely want admin below others, but the delete
                  // guard below still prevents removing them.
                  const next = [...roles];
                  const [moved] = next.splice(result.source.index, 1);
                  next.splice(result.destination.index, 0, moved);
                  // Stamp position so the live member list sorts by hierarchy.
                  setRoles(next.map((r, i) => ({ ...r, position: i })));
                }}
              >
                <Droppable droppableId="roles">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                      {roles.map((role, idx) => (
                        <Draggable
                          key={role.id}
                          draggableId={`role-${role.id}`}
                          index={idx}
                          isDragDisabled={!isOwner}
                        >
                          {(p, snapshot) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              className={`bg-zinc-800 rounded-lg p-3 ${snapshot.isDragging ? 'ring-2 ring-red-500 shadow-xl' : ''}`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isOwner && (
                                    <span {...p.dragHandleProps} className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <Shield className="w-4 h-4 shrink-0" style={{ color: role.color }} />
                                  {isOwner && !['admin', 'member'].includes(role.id) ? (
                                    <input
                                      value={role.name}
                                      onChange={(e) => updateRoleField(role.id, 'name', e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="bg-transparent text-white font-semibold truncate border-b border-transparent hover:border-white/20 focus:border-[#FF3333] focus:outline-none transition-colors min-w-0"
                                      title="Click to rename this role"
                                    />
                                  ) : (
                                    <span className="text-white font-semibold truncate">{role.name}</span>
                                  )}
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

                              {/* Custom icon + tag (3.1) — render next to usernames */}
                              {isOwner && (
                                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    {role.icon_url
                                      ? <img src={role.icon_url} alt="" className="w-6 h-6 rounded object-cover border border-white/10" />
                                      : <span className="w-6 h-6 rounded bg-zinc-700 flex items-center justify-center"><Shield className="w-3 h-3 text-zinc-500" /></span>}
                                    <label className="text-[11px] font-bold text-zinc-300 px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 cursor-pointer transition-colors">
                                      Icon
                                      <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadRoleIcon(role.id, f); }} />
                                    </label>
                                    {role.icon_url && (
                                      <button onClick={() => updateRoleField(role.id, 'icon_url', '')}
                                        className="text-[10px] text-red-400 hover:text-red-300">Clear</button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Tag</span>
                                    <Input
                                      value={role.tag || ''}
                                      onChange={(e) => updateRoleField(role.id, 'tag', e.target.value.slice(0, 12))}
                                      placeholder="e.g. MOD"
                                      className="bg-zinc-900 border-zinc-700 text-white h-7 w-24 text-xs"
                                    />
                                    {role.tag && (
                                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: `${role.color}33`, color: role.color, border: `1px solid ${role.color}66` }}>
                                        {role.tag}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
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

              {/* Show role labels in chat */}
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-white font-semibold">Show role labels next to usernames</p>
                    <p className="text-xs text-zinc-400 mt-1">When on, each member's role appears as a small colored badge next to their name in chat. Turn off for a cleaner look.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={server.show_role_labels !== false}
                    onChange={(e) => updateServerMutation.mutate({ show_role_labels: e.target.checked })}
                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 cursor-pointer accent-red-600 flex-shrink-0 mt-0.5"
                    disabled={!isOwner}
                  />
                </label>
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
                    {(server.members || []).filter(m => m.verified === false).map((member, idx) => {
                      const profile = profileByUserId[member.user_id];
                      const displayName = profile?.display_name || member.user_name || 'User';
                      const handle = profile?.username
                        ? `@${profile.username}${profile.discriminator ? '#' + profile.discriminator : ''}`
                        : null;
                      return (
                      <div key={`pend-${idx}`} className="flex items-center justify-between bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-yellow-900 flex items-center justify-center text-white text-sm">
                              {displayName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-white text-sm leading-tight truncate">{displayName}</p>
                            {handle && <p className="text-zinc-500 text-[10px] font-mono leading-tight truncate">{handle}</p>}
                          </div>
                        </div>
                        {isOwner && (
                          <button
                            onClick={async () => {
                              const updatedMembers = (server.members || []).map(m =>
                                m.user_id === member.user_id ? { ...m, verified: true } : m
                              );
                              await entities.Server.update(server.id, { members: updatedMembers });
                              queryClient.invalidateQueries({ queryKey: ['servers'] });
                              toast.success(`${displayName} verified!`);
                            }}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            ✓ Verify
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(server.members || []).filter(m => m.verified !== false).map((member, idx) => {
                  const profile = profileByUserId[member.user_id];
                  const displayName = member.nickname || profile?.display_name || member.user_name || 'User';
                  const handle = profile?.username
                    ? `@${profile.username}${profile.discriminator ? '#' + profile.discriminator : ''}`
                    : null;
                  return (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2 relative"
                    onContextMenu={(e) => {
                      if (!isOwner || member.user_id === currentUser?.id) return;
                      e.preventDefault();
                      setMemberMenuIdx(memberMenuIdx === idx ? null : idx);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-900 flex items-center justify-center text-white text-sm">
                          {displayName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-white text-sm leading-tight truncate">{displayName}</p>
                        {handle && <p className="text-zinc-500 text-[10px] font-mono leading-tight truncate">{handle}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300">
                        {member.role || 'member'}
                      </span>
                      {/* Admin actions — owner only, not on self */}
                      {isOwner && member.user_id !== currentUser?.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMemberMenuIdx(memberMenuIdx === idx ? null : idx); }}
                          className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-700"
                          title="Member actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {/* Actions dropdown */}
                    {memberMenuIdx === idx && isOwner && member.user_id !== currentUser?.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMemberMenuIdx(null)} />
                        <div className="absolute right-2 top-full mt-1 z-50 w-44 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl py-1">
                          <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Set role</p>
                          {(roles || []).map(r => (
                            <button
                              key={r.id}
                              onClick={() => changeMemberRole(member.user_id, r.name)}
                              className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color || '#888' }} />
                              {r.name}
                            </button>
                          ))}
                          <div className="h-px bg-white/5 my-1" />
                          <button
                            onClick={() => { navigator.clipboard?.writeText(member.user_id).catch(() => {}); toast.success('User ID copied'); setMemberMenuIdx(null); }}
                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                          >
                            Copy User ID
                          </button>
                          <button
                            onClick={() => kickMember(member.user_id)}
                            className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40"
                          >
                            Kick from server
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  );
                })}
                {(!server.members || server.members.length === 0) && (
                  <p className="text-zinc-500 text-center py-4">No members yet</p>
                )}
              </div>
            </TabsContent>
              </ScrollArea>
            </Tabs>
          </section>
        </motion.div>

        <ContentBlockedModal
          open={!!blockedCategory}
          onClose={() => setBlockedCategory(null)}
          category={blockedCategory}
        />
      </motion.div>
    </AnimatePresence>
  );
}
