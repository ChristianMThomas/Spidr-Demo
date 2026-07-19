import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMenu } from '@/components/MenuContext';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import {
  Copy, Trash2, Edit, User, Ban, VolumeX, MessageSquare,
  CheckCircle, BellOff, Pin, Lock, Settings, Mic, Monitor,
  UserPlus, LogOut, Shield, Hash, Volume2, Zap, Eye, EyeOff,
  Bell, Bookmark, Share2, Flag, Clock, Pencil, Users,
  Link, Download, Image as ImageIcon, Reply, SmilePlus,
  AtSign, ExternalLink, UserX,
} from 'lucide-react';

export default function SpidrMenu() {
  const { menu, setMenu } = useMenu();
  const [showCustomEmojis, setShowCustomEmojis] = useState(false);

  const hasAttachments = menu.data?.attachments?.length > 0;

  // Fetch server emojis for custom reactions
  const { data: allServers = [] } = useQuery({
    queryKey: ['all-servers-menu'],
    queryFn: () => entities.Server.list('-created_date', 100),
    staleTime: 60000,
  });

  const serverEmojis = useMemo(() => {
    const emojis = [];
    allServers.forEach(server => {
      if (server.emojis?.length) {
        server.emojis.forEach(e => {
          emojis.push({ ...e, serverName: server.name });
        });
      }
    });
    return emojis;
  }, [allServers]);

  const getOptions = useMemo(() => {
    switch (menu.type) {
      case 'message':
        return [
          { icon: Reply, label: 'Reply', color: 'text-white', action: 'reply' },
          { icon: Copy, label: 'Copy Text', color: 'text-white', action: 'copy' },
          { icon: Link, label: 'Copy Message Link', color: 'text-white', action: 'copy-link' },
          { icon: Pin, label: 'Pin to Web', color: 'text-white', action: 'pin' },
          { icon: Bookmark, label: 'Save Message', color: 'text-white', action: 'save-msg' },
          { icon: Share2, label: 'Forward / Share', color: 'text-white', action: 'share' },
          ...(hasAttachments ? [
            { separator: true },
            { icon: Download, label: 'Save Image', color: 'text-white', action: 'save-image' },
            { icon: ImageIcon, label: 'Copy Image', color: 'text-white', action: 'copy-image' },
            { icon: Link, label: 'Copy Image Link', color: 'text-white', action: 'copy-image-link' },
          ] : []),
          { separator: true },
          { icon: Edit, label: 'Edit Message', color: 'text-white', action: 'edit' },
          { icon: Flag, label: 'Report Message', color: 'text-yellow-400', action: 'report' },
          { separator: true },
          { icon: Trash2, label: 'Delete Message', color: 'text-[#FF3333]', action: 'delete' },
        ];

      // ─── THE WEB: right-click a comment ─────────────────────────────────
      case 'web_comment':
        return [
          { icon: Reply, label: 'Reply', color: 'text-white', action: 'reply' },
          { icon: Copy, label: 'Copy Text', color: 'text-white', action: 'copy' },
          { icon: User, label: 'View Profile', color: 'text-white', action: 'profile' },
          { separator: true },
          { icon: Flag, label: 'Report Comment', color: 'text-yellow-400', action: 'report' },
          ...(menu.data?.is_own ? [
            { separator: true },
            { icon: Trash2, label: 'Delete Comment', color: 'text-[#FF3333]', action: 'delete-comment' },
          ] : []),
        ];

      // ─── THE WEB: right-click a post / clip ─────────────────────────────
      // ─── Server member (right-click in the community/member list) ───────
      // Replaces the legacy emoji DOM menu. Options derive from capability
      // flags in data; tones follow the tactical palette — neutral actions
      // white, reversible moderation orange, destructive red.
      case 'server-member': {
        const d = menu.data || {};
        const items = [
          { icon: User, label: 'Profile', color: 'text-white', action: 'view-profile' },
          { icon: MessageSquare, label: 'Direct Message', color: 'text-white', action: 'send-message' },
        ];
        if (d.can_nickname) {
          items.push({ separator: true });
          items.push({ icon: Pencil, label: 'Change Nickname', color: 'text-white', action: 'nickname' });
        }
        if (d.in_voice) {
          items.push({ separator: true });
          if (d.can_mute) {
            items.push({ icon: d.is_voice_muted ? Volume2 : VolumeX, label: d.is_voice_muted ? 'Server Unmute' : 'Server Mute', color: 'text-white', action: 'server-mute' });
            items.push({ icon: d.is_voice_deafened ? Bell : BellOff, label: d.is_voice_deafened ? 'Server Undeafen' : 'Server Deafen', color: 'text-white', action: 'server-deafen' });
          }
          if (d.can_manage) {
            items.push({ icon: LogOut, label: 'Disconnect from Voice', color: 'text-orange-400', tone: 'warn', action: 'disconnect-voice' });
            if (Array.isArray(d.move_channels) && d.move_channels.length) {
              items.push({
                icon: Hash, label: 'Move to Channel', color: 'text-white', submenu: d.move_channels.map(vc => ({
                  icon: Volume2, label: vc.name, color: 'text-white', action: 'move-channel', payload: { channelId: vc.id },
                })),
              });
            }
          }
        }
        if (d.can_kick) {
          items.push({ separator: true });
          items.push({ icon: LogOut, label: 'Kick from Server', color: 'text-orange-400', tone: 'warn', action: 'kick' });
          items.push({ icon: Ban, label: 'Ban Permanently', color: 'text-red-500', tone: 'danger', action: 'ban' });
        }
        return items;
      }

      case 'web_post':
        return [
          { icon: Copy, label: 'Copy Link', color: 'text-white', action: 'copy-link' },
          { icon: Share2, label: 'Sling to DMs', color: 'text-white', action: 'sling' },
          { icon: Lock, label: 'Encrypt (Save)', color: 'text-white', action: 'encrypt' },
          { icon: Bookmark, label: 'Save to Collection…', color: 'text-white', action: 'save-to-collection' },
          { icon: Share2, label: menu.data?.is_relayed ? 'Un-Relay' : 'Relay to Your Web', color: 'text-white', action: 'relay' },
          { separator: true },
          { icon: Zap, label: '[APEX] Web-Strike', color: 'text-[#FF3333]', action: 'web-strike' },
          { icon: Zap, label: '[APEX] Overclock Post', color: 'text-orange-400', action: 'overclock' },
          { separator: true },
          { icon: User, label: 'View Their Web', color: 'text-white', action: 'profile' },
          { icon: Flag, label: 'Report Post', color: 'text-yellow-400', action: 'report' },
          ...(menu.data?.is_own ? [
            { separator: true },
            { icon: Trash2, label: 'Delete Post', color: 'text-red-500', tone: 'danger', action: 'delete-post' },
          ] : []),
        ];

      // ─── Profile (avatar in friend list, home dashboard, etc.) ──────────
      case 'profile':
        return [
          { icon: User, label: 'View Profile', color: 'text-white', action: 'view-profile' },
          { icon: MessageSquare, label: 'Send Message', color: 'text-white', action: 'send-message' },
          { icon: AtSign, label: 'Mention', color: 'text-white', action: 'mention' },
          { separator: true },
          { icon: UserPlus, label: 'Add Friend', color: 'text-white', action: 'add-friend' },
          { icon: VolumeX, label: 'Mute User', color: 'text-white', action: 'mute' },
          { icon: Ban, label: 'Block User', color: 'text-[#FF3333]', action: 'block-user' },
          { separator: true },
          { icon: Flag, label: 'Report User', color: 'text-yellow-400', action: 'report' },
          { icon: Copy, label: 'Copy User ID', color: 'text-zinc-400', action: 'copy-user-id' },
        ];

      // ─── Friend (avatar/row inside Friends panel) ───────────────────────
      case 'friend':
        return [
          { icon: MessageSquare, label: 'Send Message', color: 'text-white', action: 'send-message' },
          { icon: User, label: 'View Profile', color: 'text-white', action: 'view-profile' },
          { icon: AtSign, label: 'Mention', color: 'text-white', action: 'mention' },
          { separator: true },
          { icon: Pin, label: menu.data?.is_pinned ? 'Unpin from Spidr Web' : 'Pin to Spidr Web', color: 'text-[#FF3333]', action: 'pin-web' },
          { icon: VolumeX, label: 'Mute', color: 'text-white', action: 'mute' },
          { icon: UserX, label: 'Remove Friend', color: 'text-orange-400', action: 'remove-friend' },
          { icon: Ban, label: 'Block User', color: 'text-[#FF3333]', action: 'block-user' },
          { separator: true },
          { icon: Copy, label: 'Copy User ID', color: 'text-zinc-400', action: 'copy-user-id' },
        ];

      // ─── Group chat (row in the Friends → Groups / "Spidr Web" tab) ──────
      case 'web_group':
        return [
          { icon: MessageSquare, label: 'Open Group', color: 'text-white', action: 'open-group' },
          { icon: Pin, label: menu.data?.is_pinned ? 'Unpin from Web' : 'Pin to Web', color: 'text-white', action: 'pin-group' },
        ];

      // ─── Media (right-click on an image/GIF/video thumbnail) ────────────
      case 'media':
        return [
          { icon: ExternalLink, label: 'Open in New Tab', color: 'text-white', action: 'open-new-tab' },
          { icon: Link, label: 'Copy Image Link', color: 'text-white', action: 'copy-image-link' },
          { icon: Download, label: 'Save Image', color: 'text-white', action: 'download' },
          { icon: Bookmark, label: 'Save to Collection', color: 'text-white', action: 'save-to-collection' },
          { separator: true },
          { icon: Flag, label: 'Report Image', color: 'text-yellow-400', action: 'report-media' },
        ];

      case 'user':
        return [
          { icon: User, label: 'View Profile', color: 'text-white', action: 'profile' },
          { icon: MessageSquare, label: 'Message', color: 'text-white', action: 'message' },
          { icon: UserPlus, label: 'Add Friend', color: 'text-white', action: 'add-friend' },
          { icon: Pencil, label: 'Set Nickname', color: 'text-white', action: 'nickname' },
          { icon: Shield, label: 'Assign Role', color: 'text-white', action: 'assign-role' },
          { separator: true },
          { icon: VolumeX, label: 'Mute in Server', color: 'text-white', action: 'mute' },
          { icon: Volume2, label: 'Adjust Volume', color: 'text-white', action: 'volume' },
          { icon: Clock, label: 'Timeout (10 min)', color: 'text-yellow-400', action: 'timeout' },
          { separator: true },
          { icon: Ban, label: 'Kick from Server', color: 'text-orange-400', action: 'kick' },
          { icon: Ban, label: 'Ban from Server', color: 'text-[#FF3333]', action: 'ban' },
          { separator: true },
          { icon: Flag, label: 'Report User', color: 'text-yellow-400', action: 'report' },
          { icon: Copy, label: 'Copy User ID', color: 'text-zinc-400', action: 'copy-user-id' },
        ];
      case 'server':
        return [
          { icon: CheckCircle, label: 'Mark as Read', color: 'text-white', action: 'mark-read' },
          { icon: Bell, label: 'Notification Settings', color: 'text-white', action: 'notif-settings' },
          { icon: Shield, label: 'Privacy Settings', color: 'text-white', action: 'privacy' },
          { icon: Settings, label: 'Server Settings', color: 'text-white', action: 'server-settings' },
          { icon: UserPlus, label: 'Invite People', color: 'text-white', action: 'invite' },
          { separator: true },
          { icon: EyeOff, label: 'Hide Muted Channels', color: 'text-zinc-400', action: 'hide-muted' },
          { icon: Copy, label: 'Copy Server ID', color: 'text-zinc-400', action: 'copy-id' },
          { separator: true },
          { icon: LogOut, label: 'Leave Server', color: 'text-[#FF3333]', action: 'leave' },
        ];
      case 'channel_text':
        return [
          { icon: CheckCircle, label: 'Mark as Read', color: 'text-white', action: 'mark-read' },
          { icon: BellOff, label: 'Mute Channel', color: 'text-white', action: 'mute-channel' },
          { icon: Pin, label: 'Pin to Top', color: 'text-white', action: 'pin-channel' },
          { icon: UserPlus, label: 'Create Invite', color: 'text-white', action: 'invite' },
          { separator: true },
          { icon: Pencil, label: 'Edit Channel', color: 'text-white', action: 'edit-channel' },
          { icon: Copy, label: 'Clone Channel', color: 'text-white', action: 'clone-channel' },
          { icon: Copy, label: 'Copy Channel ID', color: 'text-zinc-400', action: 'copy-channel-id' },
          { separator: true },
          { icon: Lock, label: 'Lockdown Channel', color: 'text-yellow-400', action: 'lockdown' },
          { icon: Trash2, label: 'Purge Messages', color: 'text-[#FF3333]', action: 'purge' },
          { icon: Trash2, label: 'Delete Channel', color: 'text-[#FF3333]', action: 'delete-channel' },
        ];
      case 'channel_voice':
        return [
          { icon: Mic, label: 'Join Voice', color: 'text-white', action: 'join-voice' },
          { icon: Monitor, label: 'Start Stream', color: 'text-white', action: 'start-stream' },
          { icon: UserPlus, label: 'Create Invite', color: 'text-white', action: 'invite' },
          { separator: true },
          { icon: BellOff, label: 'Mute Channel', color: 'text-white', action: 'mute-channel' },
          { icon: Pencil, label: 'Edit Channel', color: 'text-white', action: 'edit-channel' },
          { icon: Zap, label: 'Boost Audio', color: 'text-yellow-400', action: 'boost-audio' },
          { icon: Copy, label: 'Copy Channel ID', color: 'text-zinc-400', action: 'copy-channel-id' },
          { separator: true },
          { icon: LogOut, label: 'Disconnect All Users', color: 'text-[#FF3333]', action: 'disconnect-all' },
          { icon: Trash2, label: 'Delete Channel', color: 'text-[#FF3333]', action: 'delete-channel' },
        ];
      case 'server_sidebar':
        return [
          { icon: CheckCircle, label: 'Mark as Read', color: 'text-white', action: 'mark-read' },
          { icon: BellOff, label: 'Mute Server', color: 'text-white', action: 'mute-server' },
          { icon: UserPlus, label: 'Invite People', color: 'text-white', action: 'invite' },
          { icon: Settings, label: 'Server Settings', color: 'text-white', action: 'server-settings' },
          { separator: true },
          { icon: Copy, label: 'Copy Server ID', color: 'text-zinc-400', action: 'copy-id' },
          { separator: true },
          { icon: LogOut, label: 'Leave Server', color: 'text-[#FF3333]', action: 'leave' },
        ];
      default:
        return [];
    }
  }, [menu.type, menu.data]);

  const QUICK_REACTIONS = ['🔥', '❤️', '😂', '👍', '💀', '😱'];

  if (!menu.visible) return null;

  const isMessageMenu = menu.type === 'message';
  const optionsList = getOptions;

  // Edge-detection positioning. We measure intent from menu.x/y (where the
  // click was) and adjust to keep the menu fully on-screen. Flip vertically
  // when there isn't enough room below, horizontally when not enough room
  // to the right. Corners are handled implicitly because both checks run.
  const MENU_WIDTH = 240;
  const optionRows = optionsList.filter(o => !o.separator).length;
  const separatorRows = optionsList.filter(o => o.separator).length;
  const headerHeight = 40;
  const quickReactionHeight = isMessageMenu ? 44 : 0;
  const menuHeight = optionRows * 36 + separatorRows * 9 + headerHeight + quickReactionHeight + 12;

  const winW = typeof window !== 'undefined' ? window.innerWidth  : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const PADDING = 8;

  let adjustedX = menu.x;
  let adjustedY = menu.y;

  // Horizontal: flip to the left of the cursor if we'd overflow right
  if (adjustedX + MENU_WIDTH + PADDING > winW) {
    adjustedX = Math.max(PADDING, menu.x - MENU_WIDTH);
  }
  // Vertical: flip above the cursor if we'd overflow bottom
  if (adjustedY + menuHeight + PADDING > winH) {
    adjustedY = Math.max(PADDING, menu.y - menuHeight);
  }
  // Final clamp in case the menu itself is taller than the viewport
  adjustedX = Math.max(PADDING, Math.min(adjustedX, winW - MENU_WIDTH - PADDING));
  adjustedY = Math.max(PADDING, Math.min(adjustedY, winH - menuHeight - PADDING));

  const handleReact = (emoji) => {
    window.dispatchEvent(new CustomEvent('spidr-menu-action', {
      detail: { action: 'react', data: { ...menu.data, emoji }, type: menu.type }
    }));
    setMenu(prev => ({ ...prev, visible: false }));
    setShowCustomEmojis(false);
  };

  const handleCustomReact = (emojiData) => {
    window.dispatchEvent(new CustomEvent('spidr-menu-action', {
      detail: { action: 'react', data: { ...menu.data, emoji: `:${emojiData.name}:`, customEmojiUrl: emojiData.url }, type: menu.type }
    }));
    setMenu(prev => ({ ...prev, visible: false }));
    setShowCustomEmojis(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Red Silk Thread */}
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: Math.abs(adjustedY - menu.y) + 20 }}
          className="absolute w-[2px] bg-[#FF3333] shadow-[0_0_10px_#FF3333]"
          style={{ 
            left: menu.x, 
            top: Math.min(menu.y, adjustedY)
          }}
        />

        {/* Menu */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="absolute bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl pointer-events-auto min-w-[210px] max-h-[70vh] overflow-y-auto"
          style={{ left: adjustedX, top: adjustedY }}
        >
          {/* Quick Reaction Bar (messages only) */}
          {isMessageMenu && (
            <div className="border-b border-white/5">
              <div className="flex items-center gap-0.5 px-2 py-1.5 bg-zinc-900/50">
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:scale-125 transition-all text-base"
                  >
                    {emoji}
                  </button>
                ))}
                {/* Custom emoji toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCustomEmojis(p => !p); }}
                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${showCustomEmojis ? 'bg-[#FF3333]/20 text-[#FF3333]' : 'hover:bg-white/10 text-zinc-500 hover:text-white'}`}
                >
                  <SmilePlus size={14} />
                </button>
              </div>

              {/* Custom Server Emojis Grid */}
              {showCustomEmojis && serverEmojis.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-2 pb-2 bg-zinc-900/50 max-h-[160px] overflow-y-auto"
                >
                  <div className="grid grid-cols-7 gap-1">
                    {serverEmojis.map((emoji) => (
                      <button
                        key={emoji.id}
                        onClick={(e) => { e.stopPropagation(); handleCustomReact(emoji); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:scale-110 transition-all"
                        title={`:${emoji.name}: (${emoji.serverName})`}
                      >
                        <img src={emoji.url} alt={emoji.name} className="w-5 h-5 object-contain" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Header — rich identity block when the caller provides an avatar,
              otherwise the classic terminal-style tag line. */}
          {menu.data?.avatar_url || menu.data?.header_avatar ? (
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5">
              <div className="relative shrink-0">
                <img
                  src={menu.data.avatar_url || menu.data.header_avatar}
                  alt=""
                  className="w-8 h-8 rounded-full border border-white/10 object-cover"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#FF3333] rounded-full border-2 border-[#111]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-wide text-white truncate">{menu.data?.name || 'Node'}</span>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest truncate">{menu.data?.header_sub || menu.type?.replace(/[-_]/g, ' ')}</span>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 bg-[#FF3333]/10 border-b border-[#FF3333]/20 text-[10px] font-bold text-[#FF3333] uppercase tracking-wider truncate">
               {menu.data?.name || menu.type?.toUpperCase()} :: {menu.data?.id?.toString()?.slice(-6)?.toUpperCase() || 'NODE'}
            </div>
          )}

          {/* Options — tone-aware hovers: neutral actions glow white,
              reversible moderation (tone: warn) orange, destructive
              (tone: danger) red. Submenu items expand inline (tap-friendly). */}
          <div className="p-1">
            {optionsList.map((opt, i) => (
              opt.separator ? (
                <div key={i} className="h-[1px] bg-white/10 my-1 mx-2" />
              ) : opt.submenu ? (
                <SubmenuItem key={i} opt={opt} menu={menu} setMenu={setMenu} />
              ) : (
                <MenuButton key={i} opt={opt} menu={menu} setMenu={setMenu} />
              )
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ── Tactical item primitives ─────────────────────────────────────────────
 * MenuButton: tone drives the hover treatment —
 *   danger → red text/bg,   warn → orange,   default → white pill.
 * SubmenuItem: click-to-expand inline block (hover flyouts die on touch).
 */
function toneClasses(opt) {
  if (opt.tone === 'danger' || /red/.test(opt.color || '')) {
    return { btn: 'hover:bg-red-500/10', icon: 'group-hover:text-red-500', text: 'group-hover:text-red-400' };
  }
  if (opt.tone === 'warn' || /orange/.test(opt.color || '')) {
    return { btn: 'hover:bg-orange-400/10', icon: 'group-hover:text-orange-400', text: 'group-hover:text-orange-300' };
  }
  return { btn: 'hover:bg-white/10', icon: 'group-hover:text-white', text: 'group-hover:text-white' };
}

function MenuButton({ opt, menu, setMenu, payloadExtra }) {
  const t = toneClasses(opt);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('spidr-menu-action', {
          detail: { action: opt.action, data: { ...menu.data, ...(opt.payload || {}), ...(payloadExtra || {}) }, type: menu.type }
        }));
        setMenu(prev => ({ ...prev, visible: false }));
      }}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${t.btn} group transition-colors text-left`}
    >
      <opt.icon size={14} className={`${opt.color} ${t.icon} transition-colors`} />
      <span className={`text-xs font-medium text-gray-300 ${t.text} transition-colors`}>
        {opt.label}
      </span>
    </button>
  );
}

function SubmenuItem({ opt, menu, setMenu }) {
  const [open, setOpen] = useState(false);
  const t = toneClasses(opt);
  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${t.btn} group transition-colors text-left`}
      >
        <opt.icon size={14} className={`${opt.color} ${t.icon} transition-colors`} />
        <span className={`text-xs font-medium text-gray-300 ${t.text} transition-colors flex-1`}>{opt.label}</span>
        <span className={`text-[9px] text-zinc-600 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && (
        <div className="ml-6 border-l border-white/10 pl-1 my-0.5">
          {opt.submenu.map((sub, j) => (
            <MenuButton key={j} opt={sub} menu={menu} setMenu={setMenu} />
          ))}
        </div>
      )}
    </div>
  );
}
