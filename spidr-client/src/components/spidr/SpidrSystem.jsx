import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal } from 'lucide-react';

/**
 * SpidrSystem — a "system terminal" news/patch feed anchored bottom-right of the
 * home page. Collapsed: a one-line ticker. Expanded: a scrollable panel of
 * announcements with a typewriter intro on the newest note.
 *
 * Data: ships with mock notes so it renders instantly, then tries to refresh
 * from GET {API}/system/news. A glowing "Spider-Sense" badge appears when there
 * are unread notes (tracked by the newest id in localStorage).
 */

const MOCK_NEWS = [
  { id: 'p182', title: 'Patch 1.8.2 is now live', date: '2026-06-15', type: 'UPDATE', description: 'Voice channel Theater Mode: when someone shares their screen, a full-bleed Theater Stage now fills the view instead of the old grid layout. Minimized calls now show a live Picture-in-Picture preview of the active stream — screen share takes priority over camera. Repost is live on THE WEB — tap the repost button on any clip to share it to your feed. Profile Anthem: set a song on your profile that auto-plays (muted) when someone views it. Nameplate Cropper: resize and reposition your nameplate image directly in-app. Server Invite Cards: generate a shareable invite card for your server. Linkify: URLs in chat are now automatically converted to clickable links. Create Server modal rebuilt from scratch — fixed animation glitches and added a Join by Invite Code tab so you can enter a code without leaving the dialog. Activity-feed reply notifications: when someone comments on your post you get a Holo-Ping (purple) in the notification center, and the post glows in your feed until you read it. Spotify Now Playing on web (closed beta): the widget used to only work in the Electron desktop app because browsers are sandboxed and can\'t read the OS media session. Now it ships a "Connect Spotify" button on your profile — link your account via OAuth and Spidr polls the Spotify API every 10s to keep your current track in sync. Tokens are stored server-side and auto-refreshed. Currently capped at 25 whitelisted testers per Spotify dev-mode rules — ping Chris for access. Non-whitelisted users now get a friendly "closed beta" toast instead of a cryptic Spotify error. Holographic Profile rate-limit fix: the timezone auto-detect was firing on every render and flooding the server with 429s — now runs once when your timezone is missing and never again. Electron desktop app: custom title bar with minimize, maximize/restore, and close buttons — no more borderless window with no controls.' },
  { id: 'p181', title: 'Patch 1.8.1 is now live', date: '2026-06-12', type: 'FIX', description: 'Welcome Bot now fires for every join path. Previously the greeting only triggered when a member joined via an invite link — users who joined a public server through the Browse / Join button were silently skipped. Welcome Bot logic is now in a shared server utility so it runs consistently across all join routes, and failures are logged without blocking the join itself.' },
  { id: 'p18web', title: 'Patch 1.8 — The Web Fixes', date: '2026-06-12', type: 'FIX', description: 'Slash command autocomplete rebuilt as Discord-style grouped cards — commands are sorted by bot (avatar, color, name) and rendered in a portal so the popup never clips inside the chat panel. Shows up to 30 commands at once with keyboard navigation (↑↓ to move, ↵ to select, Esc to dismiss) and auto-scroll to keep the highlighted row in view. Admin-only commands (/modset, /modlog, /modreset, /modtest, /welcomeset, /welcomeconfig, /welcomedelete) are hidden from non-admins in the autocomplete and blocked at execution if typed manually. Commands from bots not installed on the server are filtered out. New Auto Moderator commands: /modhelp (full usage guide), /modreset (wipe all config), /modtest <text> (dry-run text against the live filter without sending), and /modset unban all (clear every banned word at once). New Welcome Bot commands: /welcomehelp (usage guide), /welcomeconfig (show current message and channel), /welcomedelete (remove the welcome message). Admins can now delete bot responses and system messages — a trash button appears on hover. Server owners and admins can delete any message in their server (previously author-only). Copy Channel ID now properly awaits the clipboard write before showing a success toast — fixes phantom "Copied" in Electron.' },
  { id: 'p18', title: 'Patch 1.8 is now live', date: '2026-06-10', type: 'UPDATE', description: 'Bot system overhaul — all four official bots are now fully functional. Auto Moderator runs server-side on every message: spam detection flags users who send too many messages in a short window, and a word filter blocks slurs and any custom banned words before the message lands in chat. Configure thresholds, banned words, and allowed exceptions from the Bot Laboratory\'s new Configure panel. Welcome Bot fires a customizable greeting in your server\'s first text channel whenever a new member joins — set your own template with {user} and {server} placeholders. Game Master trivia is live: /trivia posts a question with four options, players answer with a single letter, and the first correct answer wins — a 30-second timer reveals the answer if nobody gets it. Music Master improvements: /play now fetches the YouTube video title for the queue display, and /skip and /stop reliably clear the cinema stream from the voice channel.' },
  { id: 'p172', title: 'Patch 1.7.2 is now live', date: '2026-06-09', type: 'FIX', description: 'Polish and UX pass. "Cocoons" renamed to "Saved" across THE WEB feed, profile tabs, and collections. Volume slider in the feed no longer disappears when you move the mouse to adjust it — fixed a CSS hover gap that was losing the pointer. GIF picker and image upload panels in comments now collapse automatically when you scroll to a new video. Clicking a saved clip in your Saved collections now jumps directly to that video in the feed.' },
  { id: 'p171', title: 'Patch 1.7.1 is now live', date: '2026-06-08', type: 'FIX', description: 'Security and polish pass. Adding a friend you\'ve already added now shows "You already added this user!" instead of leaking internal database errors. SPIDR_SYS was missing patches 1.6.2, 1.7, and the deploy pipeline fix — the server feed is now fully in sync with all release history.' },
  { id: 'p17', title: 'Patch 1.7 is now live', date: '2026-06-03', type: 'UPDATE', description: 'Module Nexus overhaul. Gaming Uplink now detects games from any launcher with automatic icon extraction — League of Legends, VALORANT, TFT, Steam, Epic, Battle.net, Game Pass, and more. Background apps (Medal, Discord, Spotify, OBS) are no longer misidentified as games. Spotify Now Playing is live: connect your Spotify account in Settings → Neural and your current track appears in your profile widget. New: a "Don\'t see your game?" report form lets users flag missing detection. Module Nexus now clearly marks which widgets are under construction vs. live. Electron desktop app improvements: Spidr branding icon, window dragging from the top edge, and resizable window. APEX upgrade dialog fixed — it was rendering behind the store overlay and appearing invisible. Two new support routes added to the server: /spotify for OAuth and /support/game-report for the feedback form.' },
  { id: 'p162', title: 'Patch 1.6.2 is now live', date: '2026-06-02', type: 'UPDATE', description: 'Shell architecture overhaul. SpidrShell is now the unified layout wrapper for the entire app — the old AppShell has been retired. Mobile navigation is rebuilt: a new MobileMenuPanel gives a clean, full-featured drawer for phones and tablets. Legacy components removed: TopFeedBar, UserProfilePod, GroupChatMembers, and the old Home page are gone, replaced by the HomeDashboard and integrated profile flows. KineticChat, NotificationCenter, Sidebar, BotLaboratory, DirectMessages, FriendsPanel, ServersPanel, NerveCenter, SettingsPanel, MobileBottomBar, and UserStatusChip all received updates to wire into the new shell and clean up stale references.' },
  { id: 'p162b', title: 'Deploy pipeline fixed', date: '2026-06-02', type: 'FIX', description: 'Switched the production deploy workflow from plain FTP to FTPS (FTP over TLS). The old config was timing out due to firewall restrictions on GitHub Actions runners — FTPS resolves the control socket timeout so web deploys to Hostinger complete reliably again.' },
  { id: 'p161', title: 'Patch 1.6.1 is now live', date: '2026-05-31', type: 'FIX', description: 'A polish-and-stability pass on top of 1.6. Voice channels: connected users now drop down a vertical "web thread" to glowing crimson avatar nodes instead of the old branch. The expanded voice deck got a cleaner glass reskin with a soft crimson glow and smooth-cornered participant tiles. Screen share now splits into a proper Main Stage (with a > LIVE_FEED tag) plus a vertical glass sidebar of compact, audio-reactive user pills you can collapse for full-screen. The minimized call is now a tiny "Micro-Tactical HUD" pill that fades out when idle and expands on hover into mute / deafen / volume / record controls. New: an out-of-app "Spidr Protocol" transparent overlay (desktop) so you can read and send chat over a game without leaving it — with click-through and a Shift+Enter typing hotkey. Fixes: group chats no longer render blank (a media-only message could crash them); DM/group voice calls no longer show duplicate users when someone joins; the clean no-lines message feed; and the top-right profile widget no longer overlaps content.' },
  { id: 'p16', title: 'Patch 1.6 is now live', date: '2026-05-31', type: 'UPDATE', description: 'The biggest visual + functionality pass yet. THE WEB feed: trending posts now physically pulse, The Weaver upload studio gets signature filters (Dormant / Glitch / Neon Tear) + a terminal caption, a precision dual-handle video scrubber, and external audio grafting from YouTube / Spotify / Apple Music with scroll-based auto-play. New: tap-to-expand image lightbox in chat, rich GIF/image comments, and long-press context menus for mobile. Channel sidebar rebuilt as glowing pill-nodes; server chat reskinned to the crimson palette with status dots, role badges and themed media embeds; and the Bot Laboratory got the full terminal/glass treatment. Custom backgrounds now flow across the whole app (home, THE WEB, Signal Radar, Settings, and the sidebar) and render far smoother. Fixes: the minimized voice node now animates and its buttons work reliably (no more vanishing calls); server permissions no longer treat everyone as admin; deafen and mute are properly distinct and you can\'t deafen others in DMs/groups; "Pin to Web" confirms; tapping a message in the Memory Web jumps to it; voice channels show who joined again; full mobile responsiveness with no cut-off sidebars.' },
  { id: 'p15', title: 'Patch 1.5 is now live', date: '2026-05-29', type: 'UPDATE', description: 'APEX Symbiote suite: Profile Takeover overlay, Stream HUD with live telemetry, Frame Vault, Nexus Grid sidebar, and custom Nameplates & Badges. Plus fixes: the minimized call now uses the new Web Node design across servers, DMs, and groups; minimizing no longer disconnects you; the sidebar logo box is gone; APEX activation and access are fixed; and trending servers no longer 404.' },
  { id: 'p14', title: 'Patch 1.4 is now live', date: '2026-05-24', type: 'UPDATE', description: 'APEX hanging threads + mini voice visualizers, auto-minimize on navigation, Electron picture-in-picture, and "Pin to Spidr Web" across Friends, DMs, and Groups.' },
  { id: 'voicefix', title: 'Voice messages fixed everywhere', date: '2026-05-24', type: 'FIX', description: 'Voice messages now send in DMs, group chats, and server channels.' },
  { id: 'webnode', title: 'Suspended Web Node', date: '2026-05-23', type: 'UPDATE', description: 'The minimized call is now a draggable radial web node with a radial active-speaker waveform.' },
  { id: 'unicall', title: 'Universal calling', date: '2026-05-23', type: 'UPDATE', description: 'DM and group calls use the exact same voice deck as server channels.' },
  { id: 'trending', title: 'Trending server join flow', date: '2026-05-22', type: 'FIX', description: 'Opening a server from Trending no longer 404s — non-members get a Join / Request Invite screen.' },
];

const API_BASE = (import.meta.env.VITE_API_URL) || 'http://localhost:4000';
const TYPE_COLORS = {
  UPDATE: 'text-[#FF3333] border-[#FF3333]/40',
  ALERT:  'text-amber-400 border-amber-400/40',
  FIX:    'text-emerald-400 border-emerald-400/40',
};

export default function SpidrSystem() {
  const [open, setOpen] = useState(false);
  const [news, setNews] = useState(MOCK_NEWS);
  const [hasUnread, setHasUnread] = useState(false);
  const [typed, setTyped] = useState('');
  const typeTimer = useRef(null);

  // Fetch live news (best-effort; falls back to mock).
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/system/news`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive && Array.isArray(data) && data.length) setNews(data); })
      .catch(() => { /* keep mock */ });
    return () => { alive = false; };
  }, []);

  // Unread = newest id differs from the last one the user saw.
  useEffect(() => {
    const newestId = news[0]?.id;
    if (!newestId) return;
    let seen = null;
    try { seen = localStorage.getItem('spidr_system_seen'); } catch {}
    setHasUnread(seen !== newestId);
  }, [news]);

  // External open trigger — any component can fire `spidr-system-open` to
  // pop the terminal open (e.g. the MobileMenuPanel row).
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('spidr-system-open', handler);
    return () => window.removeEventListener('spidr-system-open', handler);
  }, []);

  // Typewriter the newest note's description when the terminal opens.
  useEffect(() => {
    clearInterval(typeTimer.current);
    if (!open) { setTyped(''); return; }
    const full = news[0]?.description || '';
    let i = 0;
    typeTimer.current = setInterval(() => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(typeTimer.current);
    }, 16);
    // Mark newest as seen.
    try { if (news[0]?.id) localStorage.setItem('spidr_system_seen', news[0].id); } catch {}
    setHasUnread(false);
    return () => clearInterval(typeTimer.current);
  }, [open, news]);

  const latest = news[0];

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 30, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 384 }}
            exit={{ opacity: 0, y: 30, height: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-80 bg-[#050505]/90 backdrop-blur-md border border-red-900/30 rounded-lg overflow-hidden flex flex-col shadow-2xl shadow-black/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-red-900/30">
              <span className="flex items-center gap-2 font-mono text-xs text-[#FF3333]">
                <Terminal size={13} /> SPIDR_SYS
              </span>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs">
              {news.map((item, idx) => (
                <div key={item.id} className={idx > 0 ? 'pt-3 border-t border-red-900/20' : ''}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${TYPE_COLORS[item.type] || TYPE_COLORS.UPDATE}`}>
                      {item.type}
                    </span>
                    <span className="text-zinc-600 text-[10px]">{item.date}</span>
                  </div>
                  <p className="text-zinc-200 font-bold text-[11px]">{item.title}</p>
                  <p className="text-zinc-400 mt-0.5 leading-relaxed">
                    {idx === 0 ? typed : item.description}
                    {idx === 0 && typed.length < (item.description?.length || 0) && (
                      <span className="inline-block w-1.5 h-3 bg-[#FF3333] ml-0.5 animate-pulse align-middle" />
                    )}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(true)}
            className="relative bg-[#050505]/80 backdrop-blur-md border border-red-900/30 rounded-md px-4 py-2 flex items-center gap-2 max-w-[320px] hover:border-red-900/50 transition-colors"
          >
            <span className="font-mono text-xs text-[#FF3333] shrink-0">{'>'} SPIDR_SYS:</span>
            <span className="font-mono text-xs text-zinc-300 truncate">{latest?.title || 'All systems nominal.'}</span>

            {/* Spider-Sense unread badge — glowing node + jagged line */}
            {hasUnread && (
              <span className="absolute -top-1.5 -right-1.5">
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M4 14 L8 10 L6 8 L11 4" fill="none" stroke="#FF3333" strokeWidth="1.2" opacity="0.8" />
                  <circle cx="14" cy="6" r="4" fill="#FF3333">
                    <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="14" cy="6" r="6" fill="none" stroke="#FF3333" strokeWidth="1" opacity="0.4" />
                </svg>
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
