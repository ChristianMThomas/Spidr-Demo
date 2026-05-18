import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { useAppShell } from '@/context/AppShellContext';
import { toast } from 'sonner';

/**
 * useGlobalMenuActions — single listener for context-menu actions that aren't
 * tied to a specific chat panel.
 *
 * The pattern: SpidrMenu dispatches `spidr-menu-action` events with
 *   { action, type, data }
 * Where:
 *   - `action` is the specific verb ('copy-link', 'block-user', etc.)
 *   - `type` is the menu kind ('media', 'profile', 'friend', etc.)
 *   - `data` carries the contextual payload (the user ID, image URL, etc.)
 *
 * Chat panels (ServersPanel, DirectMessages, KineticChat) handle context-
 * specific actions (reply, edit, delete, pin, react) themselves. This hook
 * picks up the universal actions that apply everywhere: copy-link,
 * download, block, mute, copy-id, navigate-to-profile, etc.
 *
 * Mount this once at the SpidrShell level (already done) so the listener
 * is always active.
 */
export function useGlobalMenuActions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser, navigateToDM } = useAppShell();

  useEffect(() => {
    const handler = async (event) => {
      const { action, type, data } = event.detail || {};
      if (!action) return;

      try {
        switch (action) {
          // ── Media actions (right-click on an image, video thumbnail, etc.) ─
          case 'open-new-tab': {
            const url = data?.url || data?.src;
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            break;
          }
          case 'copy-image-link':
          case 'copy-link': {
            const url = data?.url || data?.src || data?.link;
            if (url) {
              await navigator.clipboard.writeText(url);
              toast.success('Link copied');
            }
            break;
          }
          case 'download': {
            const url = data?.url || data?.src;
            if (!url) return;
            // Programmatic download via a temp anchor.
            const a = document.createElement('a');
            a.href = url;
            a.download = data?.filename || url.split('/').pop()?.split('?')[0] || 'download';
            a.rel = 'noopener noreferrer';
            // Open in same tab for cross-origin URLs (browser will handle it)
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            break;
          }
          case 'save-to-collection': {
            const url = data?.url || data?.src;
            if (!url || !currentUser?.id) return;
            // Find or create a "Saved Media" collection and add this URL as
            // a typed item. Items is a Mixed array on the Collection schema,
            // so we tag each entry with a `kind` for future querying.
            const cols = await entities.Collection.filter({ user_id: currentUser.id });
            let col = cols.find(c => c.name === 'Saved Media');
            if (!col) {
              col = await entities.Collection.create({
                user_id: currentUser.id,
                name: 'Saved Media',
                clip_ids: [],
                items: [{ kind: 'media', url, saved_at: new Date().toISOString() }],
              });
            } else {
              const items = Array.isArray(col.items) ? col.items : [];
              const alreadySaved = items.some(it => it?.kind === 'media' && it?.url === url);
              if (!alreadySaved) {
                await entities.Collection.update(col.id, {
                  items: [...items, { kind: 'media', url, saved_at: new Date().toISOString() }],
                });
              }
            }
            toast.success('Saved to your collection');
            queryClient.invalidateQueries({ queryKey: ['collections'] });
            break;
          }
          case 'report-media':
          case 'report': {
            if (type === 'media') {
              const reason = window.prompt('Why are you reporting this image?');
              if (!reason) return;
              await entities.Report.create({
                reporter_id: currentUser?.id,
                target_type: 'media',
                target_name: data?.filename || data?.name || 'Image',
                evidence_url: data?.url || data?.src,
                reason,
                status: 'pending',
              });
              toast.success('Report submitted to moderators');
            }
            // For non-media, the chat panel handlers own this action
            break;
          }

          // ── Profile / user actions ────────────────────────────────────────
          case 'view-profile':
          case 'profile': {
            // The HolographicProfile lives inside chat panels; for global
            // contexts (friend list, sidebar avatars) we dispatch a higher-
            // level event so whichever panel is currently visible can open
            // the profile modal.
            window.dispatchEvent(new CustomEvent('spidr-open-profile', {
              detail: { userId: data?.id || data?.user_id },
            }));
            break;
          }
          case 'send-message':
          case 'message':
          case 'dm': {
            const targetId = data?.id || data?.user_id;
            if (targetId && navigateToDM) {
              navigateToDM(targetId);
            }
            break;
          }
          case 'mention': {
            // Drop an @<name> into the global input event buffer; chat panels
            // listen for this and prepend it to their input.
            window.dispatchEvent(new CustomEvent('spidr-prepend-mention', {
              detail: { name: data?.name || data?.user_name },
            }));
            break;
          }
          case 'copy-user-id':
          case 'copy-id': {
            const id = data?.id || data?.user_id || data?.server_id || data?.channel_id;
            if (id) {
              await navigator.clipboard.writeText(String(id));
              toast.success('ID copied');
            }
            break;
          }
          case 'block-user':
          case 'block': {
            const targetId = data?.id || data?.user_id;
            if (!targetId || !currentUser?.id) return;
            if (targetId === currentUser.id) {
              toast.error("You can't block yourself");
              return;
            }
            if (!window.confirm(`Block ${data?.name || 'this user'}? You won't see their messages anymore.`)) return;
            // Friend row from me → them with status=blocked
            const existing = await entities.Friend.filter({
              user_id: currentUser.id, friend_id: targetId,
            });
            if (existing[0]) {
              await entities.Friend.update(existing[0].id, { status: 'blocked' });
            } else {
              await entities.Friend.create({
                user_id: currentUser.id,
                friend_id: targetId,
                friend_name: data?.name || 'Blocked user',
                friend_avatar: data?.avatar || '',
                status: 'blocked',
              });
            }
            toast.success(`Blocked ${data?.name || 'user'}`);
            queryClient.invalidateQueries({ queryKey: ['friends'] });
            break;
          }
          case 'unblock': {
            const targetId = data?.id || data?.user_id;
            if (!targetId || !currentUser?.id) return;
            const existing = await entities.Friend.filter({
              user_id: currentUser.id, friend_id: targetId, status: 'blocked',
            });
            if (existing[0]) {
              await entities.Friend.delete(existing[0].id);
              toast.success('Unblocked');
              queryClient.invalidateQueries({ queryKey: ['friends'] });
            }
            break;
          }

          // ── Sidebar server actions ────────────────────────────────────────
          case 'mark-read': {
            // No persisted unread counter in this build yet — just acknowledge
            // so the menu feels responsive. When unread counters land they'll
            // wire up here.
            if (data?.server_id || data?.id) {
              localStorage.setItem(`spidr_lastread_${data.server_id || data.id}`, String(Date.now()));
              toast.success('Marked as read');
              queryClient.invalidateQueries({ queryKey: ['servers'] });
            }
            break;
          }
          case 'mute-server': {
            const sid = data?.server_id || data?.id;
            if (!sid) return;
            // Persist client-side; chat panels can read this list to suppress notifications.
            const muted = JSON.parse(localStorage.getItem('spidr_muted_servers') || '[]');
            const next = muted.includes(sid) ? muted.filter(x => x !== sid) : [...muted, sid];
            localStorage.setItem('spidr_muted_servers', JSON.stringify(next));
            toast.success(next.includes(sid) ? 'Server muted' : 'Server unmuted');
            break;
          }
          case 'leave-server':
          case 'leave': {
            const sid = data?.server_id || data?.id;
            if (!sid || !currentUser?.id) return;
            if (!window.confirm(`Leave "${data?.name || 'this server'}"? You'll have to be re-invited to rejoin.`)) return;
            let srv;
            try { srv = await entities.Server.get(sid); }
            catch { return toast.error('Could not load server'); }
            if (!srv) return;
            if (srv.owner_id === currentUser.id) {
              toast.error("You're the owner — transfer ownership or delete the server instead.");
              return;
            }
            const newMembers = (srv.members || []).filter(m => m.user_id !== currentUser.id);
            await entities.Server.update(sid, { members: newMembers });
            toast.success(`Left ${srv.name}`);
            queryClient.invalidateQueries({ queryKey: ['servers'] });
            navigate('/home');
            break;
          }
          case 'invite': {
            // Surface the invite modal — handled by the active server panel
            window.dispatchEvent(new CustomEvent('spidr-open-invite-modal', {
              detail: { serverId: data?.server_id || data?.id },
            }));
            break;
          }
          case 'server-settings': {
            window.dispatchEvent(new CustomEvent('spidr-open-server-settings', {
              detail: { serverId: data?.server_id || data?.id },
            }));
            break;
          }

          // ── Friend list actions ───────────────────────────────────────────
          case 'remove-friend': {
            const targetId = data?.id || data?.user_id;
            if (!targetId || !currentUser?.id) return;
            if (!window.confirm(`Remove ${data?.name || 'this friend'}?`)) return;
            const a = await entities.Friend.filter({ user_id: currentUser.id, friend_id: targetId });
            const b = await entities.Friend.filter({ user_id: targetId, friend_id: currentUser.id });
            for (const f of [...a, ...b]) {
              await entities.Friend.delete(f.id);
            }
            toast.success(`Removed ${data?.name || 'friend'}`);
            queryClient.invalidateQueries({ queryKey: ['friends'] });
            break;
          }

          default:
            // Action wasn't a global one — chat panels handle their own.
            break;
        }
      } catch (err) {
        console.warn('Menu action failed:', action, err?.message);
        toast.error('Could not complete that action');
      }
    };

    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, [navigate, queryClient, currentUser, navigateToDM]);
}
