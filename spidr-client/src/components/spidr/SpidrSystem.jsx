import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  { id: 'p1981', title: 'Patch 1.9.81 — Shared DM backgrounds, actually shared', date: '2026-08-30', type: 'FIX', description: 'Moving DM wallpapers onto a shared conversation document last patch was the right change but not the whole fix. The remaining problem: two people in the same DM can be using DIFFERENT conversation_id strings for it — a thread opened from each side, or ids created before the sorted-pair convention was applied everywhere. That same split is what produced duplicate heads in the SPIDR WEB strip. With divergent ids each client read and wrote a DIFFERENT settings row, so a background set by one person was invisible to the other even though the storage, the route, the socket room and the broadcast were all working correctly. Settings are now keyed on the PARTICIPANTS rather than on whichever id string a client happens to send: the server resolves both parties from the thread and rebuilds the canonical sorted id for every read and write, so both sides always land on one row. The change also broadcasts to both id variants, and the client accepts a broadcast matching either, since the other person may have joined the room under their own variant. Finally, the settings query now refetches when you open or refocus a conversation — you only sit in a DM socket room while that chat is open, so a background changed while you were elsewhere used to be missed entirely rather than picked up on return.' },
  { id: 'p1980', title: 'Patch 1.9.80 — Ghost presence exorcised', date: '2026-08-30', type: 'FIX', description: 'A game you closed hours ago could stay pinned to your profile as CURRENTLY IN LOBBY forever. The desktop watcher was never the problem — it reports "no game running" the instant you close one. The problem was that nobody was listening: the code that saved status changes lived inside the gaming widget on your profile page, so it only ran while you were actually looking at your own profile. Close a game while reading a DM or sitting in a server and the clear event fired into an empty room, leaving the stale title in the database. Detection now lives at the app shell and runs for your entire session no matter what screen you are on. Three more layers of defence, because presence rots in more ways than one. Quitting Spidr fires a clear on the way out. If you force-quit or your wifi drops mid-game, no client event can possibly fire — so the server now wipes your game status when your last socket disconnects, on the reasoning that a connection that no longer exists cannot be observing a running game. And any status carries the timestamp of the reading that produced it, so a row that somehow outlives all of that gets aged out after fifteen minutes rather than displayed as a live session indefinitely. Status changes also broadcast now, so a friend closing their game clears the card on your screen immediately instead of after a refresh.' },
  { id: 'p1979', title: 'Patch 1.9.79 — DM backgrounds are shared now', date: '2026-08-30', type: 'FIX', description: 'Setting a DM background only changed it for you — the other person never saw it. That was not a sync bug so much as a storage decision that turned out wrong: wallpapers were saved on YOUR profile, keyed by conversation, because direct messages had no shared document to attach anything to. Stored per-user, they were private by construction. DMs now have a real container: a ConversationSettings document keyed by conversation id, so a background set by either side belongs to the conversation itself. Changing it writes the value, drops a system row into the thread, and broadcasts to the conversation room, so the other person\'s chat repaints instantly rather than after a refresh. The change also leaves a mark in the history — a centered frosted pill reading X set the background image as, with a thumbnail of the new wallpaper, or X removed the background image when cleared. It is a real message row rather than a toast, so it survives reloads and both sides see it in the timeline. Groups already worked this way, since a group chat always had a document of its own. Two supporting details: the route verifies you are actually a participant before reading or writing, because a conversation id is not a capability and without that check anyone could repaper a stranger\'s thread by guessing an id; and the client API gained a PUT verb it never had, which the new endpoint needed.' },
  { id: 'p1978', title: 'Patch 1.9.78 — Connections, two ways in', date: '2026-08-30', type: 'UPDATE', description: 'Neural Links — the panel where you connect Spotify, Apple Music and the rest — is now reachable straight from your profile card in the bottom-left corner, not just buried in Settings. A new link icon sits beside the gear on the profile popover and opens the panel as a floating glass modal over whatever you were doing. It is the SAME component the Settings tab renders, not a copy: passing an onClose handler is the only difference, and that flag is what makes the panel draw its own dismiss button and size itself for a modal instead of filling the settings pane. So when a new integration gets added later it appears in both places automatically, with no chance of the two drifting apart. One structural detail: the modal renders through a portal to the document body rather than inside the profile chip. The chip is a small hover-driven popover pinned in the sidebar corner — a modal nested inside it would have been clipped by the rail, and worse, it would have unmounted the instant the popover closed on mouse-leave, so the panel would vanish the moment you moved the cursor toward it.' },
  { id: 'p1977', title: 'Patch 1.9.77 — Signal Radar goes glass', date: '2026-08-30', type: 'UPDATE', description: 'Signal Radar was the last screen still wearing the old retro-terminal look — repeating scanlines, opaque black panels, hard neon borders and angular clipped corners — and it read as a different application next to the rest of Spidr. It is now built the same way as the Bot Lab and the sidebar. The scanline grain is gone, replaced by a single enormous heavily-blurred red bloom sitting deep behind the interface like a radar sweep, which the cards above it can actually catch. Server cards became frosted glass: rounded, highly translucent, a faint white border that warms to red on hover with a soft diagonal wash instead of a hard neon outline. The search field lost its solid black fill and HUD corner ticks for the same frosted treatment, and the Establish Uplink button now reads as a glass action rather than a flat outlined box. New on every card: a View Info button beside the uplink action. Clicking it slides a Signal Dossier panel up over the card face — the full description, the total roster (everyone who has ever joined, which the card front never showed since the front counts only who is live right now), how many are on air, when the server last had a pulse rendered as a human relative time, and its first-contact date. It opens in place rather than routing away, so you never lose your spot in the grid.' },
  { id: 'p1976', title: 'Patch 1.9.76 — The @ popup surfaces', date: '2026-08-30', type: 'FIX', description: 'The mention popup was rendering UNDER the chat box. It already had z-50 and bottom-full, which is why it looked correct in the code — but z-index only competes inside its own stacking context, so no value would ever have lifted it above an ancestor that clips or paints over it. The popup now renders through a portal to the document body, positioned from the input\'s measured rect and re-measured on scroll and resize. That is the same technique the slash-command palette in the same component was already using — the mention popup had simply never been converted. You can also @ people the popup used to hide. Server members were dropped from the mention list entirely if their denormalized user_name field was missing, and that field goes unstamped on plenty of rows — dormant accounts most of all, which is why it read as not being able to mention offline users. Members are now kept on user_id alone and their name resolves through nickname, then the stored name, then their live profile, then a short id fallback, so there is always a usable label and nobody silently disappears from the list. The composer input also gained its own paint layer so nothing decorative in the bar can sit on top of typed text.' },
  { id: 'p1975', title: 'Patch 1.9.75 — One command column', date: '2026-08-30', type: 'UPDATE', description: 'Jump Back In now sits directly beneath Top Creators instead of floating as its own third column. Trending Servers, Top Creators and Jump Back In share a single fixed-width right rail that stacks vertically with even spacing, which gives the main dashboard — Web Tension, Find Friends, Discover People, the Activity Feed — the full remaining width instead of competing with a second rail for it. The rail widened slightly to fit the conversation rows comfortably and stays shrink-proof when the window narrows. Two structural details worth noting: Jump Back In no longer carries its own sticky positioning, because the rail wrapper already owns that for the whole stack and a nested sticky inside a scrolling container pins to the container rather than the viewport — it would have stuck to the rail\'s own scrollbar. And the mobile copy of the panel had its breakpoint corrected from xl to lg to match the rail exactly: the rail used to appear at xl and the in-column copy hid at xl, which lined up, but consolidating moved the rail to lg and leaving the copy at xl would have rendered Jump Back In TWICE on every laptop-width screen between those two breakpoints.' },
  { id: 'p1974', title: 'Patch 1.9.74 — Merge + duplicate heads and sticky badges', date: '2026-08-30', type: 'FIX', description: 'This build merges two branches that had diverged: the notification overhaul (scoped mobile push, permission primers, per-group notify modes) and the search/tags/wallpaper line (Search and Media Hub, word tags, chat backgrounds, bulletproof server avatars, the tactical server matrix). Both are now in one tree with nothing dropped from either. Two bugs from QA squashed. The duplicate head in SPIDR WEB was not a missing dedupe — the code already collapsed conversations into a map, but keyed it by conversation_id, and the same person can hold two conversation ids when a thread was started from each side. Keyed that way, one friend rendered as two identical heads. Conversations now fold by PERSON: the newest thread wins for opening, unread counts are SUMMED across the merged threads so opening the head clears everything the badge was counting, and whichever record actually resolved a name and avatar is kept. The sticky red badges had a separate cause: opening a conversation marks it read and invalidates several caches, but the SPIDR WEB strip reads its own quickheads query key which was never in that list — so its badges survived until a full page reload even though the messages were genuinely read. That key is now invalidated too. The friends list below also gained defensive dedupe by friend id, since mirrored friend rows or an accept racing an invite could duplicate a person there in exactly the same way.' },
  { id: 'p1969', title: 'Patch 1.9.69 — Notification overhaul', date: '2026-08-26', type: 'UPDATE', description: 'Notifications from a person now show that person\'s profile picture and the actual message instead of the Spidr logo and a bare "New message". Mentions and group chats get the full group treatment: the server or group picture, who posted, where they posted it, and what they said — and when a server or group has no picture of its own, the sender\'s shows instead. Servers and group chats now ping you on every message by default, with new switches to narrow either one down to @mentions only, plus a per-server and per-group control so you can set any single one to All, @mentions only, or Muted without touching the rest. Signing in now asks for microphone, camera and notification access in one short setup step rather than interrupting your first call. Also includes a background security update to the realtime connection layer.' },
  { id: 'p1968', title: 'Patch 1.9.68 — Symbiote edit bar', date: '2026-08-22', type: 'UPDATE', description: 'Editing a message no longer shows a flat gray box with an OS emoji glued to it. The bar is now a symbiote clamp over the composer: a crimson-tinted chassis with a red border whose aura BREATHES on a 2.8 second loop, and a bright highlight that crawls along the top edge like something moving under the surface. The pencil is a sharp vector now rather than the platform emoji, which rendered differently on every operating system and made the whole component read as a web template. Editing message sits in red above a small mono esc to cancel hint, with an explicit Cancel pill on the right. One thing that had to be fixed to ship this honestly: the design advertises esc to cancel, but Escape only ever dismissed the slash-command palette and then fell through with nothing listening — the label would have been a lie. Escape now genuinely cancels an in-progress edit. The animation respects prefers-reduced-motion: the glow stays, the breathing and the crawl stop.' },
  { id: 'p1967', title: 'Patch 1.9.67 — Sidebar pop-outs + Bot Lab chassis', date: '2026-08-22', type: 'UPDATE', description: 'Every sidebar icon now slides open on hover into a glowing pill that names it — the icon holds position while the chassis expands rightward with a red border and aura, and the label fades in a beat later on a slide, giving it that HUD feel. Bot Lab gets its own grade of the same physics: the aggressive mech-border chassis with angled cybernetic corners cut at each edge, a brighter aura, black italic type, and its real badge artwork in place of the generic chat glyph. Identical expansion timing across both grades so the rail stays cohesive when you run the mouse down it. Two engineering notes. The Bot Lab art was converted to TRUE transparency rather than the usual mix-blend-screen trick — screen-blending makes every black pixel vanish, which would have gutted the badge\'s own black outlines, the spider\'s shading, and the dark panel behind the circuit traces, and it only looks right on a pure-black backdrop. Instead the background was flood-filled from the image borders, so the black BEHIND the badge is stripped while every black pixel INSIDE the artwork survives, and the cut edge is feathered so the neon glow does not look razor-cut. The pop-out itself is rendered as a viewport-anchored overlay measured from each item, because the nav rail clips horizontal overflow at 72px — an in-flow hover expansion would have been sliced flat at the rail edge.' },
  { id: 'p1966', title: 'Patch 1.9.66 — Friends flow self-heals', date: '2026-08-22', type: 'FIX', description: 'Accepting a friend request no longer leaves your friends list one-sided — if the sender\'s side never mirrored to you the first time, accepting now creates the missing row so both of you actually see each other as friends. Unfriending someone also clears both sides at once, so nobody is left with a phantom friend that has no record of them. And on a shared browser, your pinned conversations and pinned group chats are now scoped to your account, so switching users doesn\'t leak the last person\'s pins into your sidebar.' },
  { id: 'p1965', title: 'Patch 1.9.65 — Account safety + mobile polish', date: '2026-08-21', type: 'UPDATE', description: 'Sign-in, verification, and account-recovery messages no longer reveal whether an email is registered, so nobody can fish for who has a Spidr account. Rate limits on those flows now apply per email address instead of only per network, so someone rotating networks can\'t keep hammering one account. The mobile app also picks up its new branded icon and splash screen, the Settings screen is stripped down to clean rows, and a maintenance fix backfills friend requests that could get stuck showing accepted on one side and still pending on the other.' },
  { id: 'p1964', title: 'Patch 1.9.64 — iOS notifications now work', date: '2026-08-20', type: 'FIX', description: 'iOS notifications finally light up your lock screen — you\'ll get a banner when a friend messages you or calls, even with the app closed. The mobile home tab also gets a Jump Back In shortcut and a pinned-favorites panel alongside your recent servers.' },
  { id: 'p1963', title: 'Patch 1.9.63 — Mobile DM unread badges', date: '2026-08-20', type: 'FIX', description: 'Direct message unread counts on mobile now show up the moment a friend messages you and clear the moment you open the chat. The badge appears in three places instead of one: the Friends tab, the home page Friends tile, and each friend\'s avatar in your Recents strip. A DM that lands overnight bumps the badge the moment you reopen the app.' },
  { id: 'p1962', title: 'Patch 1.9.62 — Cleaner missed-call notes', date: '2026-08-19', type: 'FIX', description: 'Missed call notes in your chats got three fixes. Group calls now leave a proper "you tried calling this group" or "<name> called this group" note, hanging up a connected call no longer stamps a fake "didn\'t answer" row on top of it, and every note now shows the real caller name instead of "Someone". Mobile chat threads render missed calls as clean centered alerts instead of raw message bubbles.' },
  { id: 'p1961', title: 'Patch 1.9.61 — Notification controls + Close Friends', date: '2026-08-19', type: 'UPDATE', description: 'Notification toggles on mobile finally do what they say — every switch (DMs, mentions, friend requests, calls) is now enforced on the server, and Do Not Disturb actually silences pushes. Close Friends is a real feature now: tap the star on any friend\'s profile and they can break through DND when it matters. The DM header video button now actually starts a video call (it was silently starting voice), and tapping a notification takes you straight to the right conversation, server, or friend request.' },
  { id: 'p1960', title: 'Patch 1.9.60 — Native mobile calls', date: '2026-08-18', type: 'UPDATE', description: 'Native mobile calling is back online. An incoming Spidr call now lights up your phone\'s real lock-screen call UI, just like a normal phone call. Mobile callers land in the exact same voice room as web callers so everyone joins one session, and your Voice & Video settings (mic, camera-on-join, speaker default) apply automatically. The in-call screen is a fresh full-screen UI with a pulsing avatar for voice and self-view picture-in-picture for video.' },
  { id: 'p1959', title: 'Patch 1.9.59 — The Spidr Web Matrix', date: '2026-08-18', type: 'UPDATE', description: 'Jump Back In and the Spidr Web pinned strip are now ONE tabbed panel on the homepage. The Jump Back In tab lists recent DMs and group chats with hover rings in symbiote red. The Spidr Web tab shows your pinned connections wearing the signature red-to-purple gradient ring with a pushpin badge, a live presence dot on pinned DMs, and a hover wash that bleeds red into purple. Pins update instantly when you pin someone from anywhere in the app, and the panel appears at every screen size.' },
  { id: 'p1958', title: 'Patch 1.9.58 — The Core actually lands this time', date: '2026-08-18', type: 'FIX', description: 'The Spidr Core — the breathing home button — is now in the desktop sidebar where you\'ll actually see it (last patch put it in a dead file nobody rendered). Hover it to lunge the spider to full color, click it to fire a synthesized symbiote heartbeat, and when you\'re on the home page the mascot and its red aura breathe on a three-second loop with a glowing red bar on the left rail.' },
  { id: 'p1957', title: 'Patch 1.9.57 — The Spidr Core breathes + native title bar', date: '2026-08-18', type: 'UPDATE', description: 'The home button in the floating dock is now the Spidr Core. Dormant it sits desaturated and dim; hovering lunges it to full color and scale; active it BREATHES on a three-second loop, so the app\'s anchor point feels alive instead of static. Clicking fires a synthesized symbiote heartbeat — a two-beat low thump. Windows and Linux now use the real system minimize/maximize/close buttons on the header (like VS Code and Discord). A broken avatar or server icon anywhere in the app now falls back to a spider placeholder instead of the browser\'s torn-page glyph.' },
  { id: 'p1956', title: 'Patch 1.9.56 — In-app updates + "Likes" rename', date: '2026-07-26', type: 'UPDATE', description: 'The desktop app now updates itself — a new patch drops, you see "Update available", and it installs when you next quit. No more manual re-download from spidrapp.com. "Resonance" on profiles is now called "Likes" everywhere (web and mobile). Also picked up: tap-to-react and share sheets on mobile, a proper Not Found screen for dead links, and a home page card that mirrors the SPIDR_SYS terminal.' },
  { id: 'p1955', title: 'Patch 1.9.55 — APEX store knows you\'re already subscribed', date: '2026-07-22', type: 'FIX', description: 'Opening APEX while you\'re already subscribed no longer pitches you the price again. The panel now shows a clear "YOU ALREADY HAVE APEX" confirmation with a Manage Subscription button, and the header pill switches from UNLOCKED to ACTIVE. The feature grid and the top-right settings gear are unchanged, so managing the subscription is still one click away.' },
  { id: 'p1954', title: 'Patch 1.9.54 — Landing redesign + safer desktop links', date: '2026-07-22', type: 'UPDATE', description: 'The spidrapp.com landing site got a full design refresh across Hero, Navbar, Community, Platforms, WhySpidr, and Footer, and the "SPOTS LEFT" counter is live again on first paint. On desktop, every clicked link is now validated before it can leave the app — anything that isn\'t a normal http, https, or mailto link is blocked, so a crafted chat link can\'t hijack your system.' },
  { id: 'p1953', title: 'Patch 1.9.53 — Signals tab no longer erases requests', date: '2026-07-21', type: 'FIX', description: 'Two fixes for the Signals inbox on the Friends panel. Peeking at a stranger\'s DM used to make their request vanish with no way to accept or block — requests now stay put until you actually act on one. And DMs from deleted accounts no longer show up as ghost conversations in Jump Back In or your DM list.' },
  { id: 'p1952', title: 'Patch 1.9.52 — Ghost members purged + real fly-catch DMs', date: '2026-07-21', type: 'FIX', description: 'Deleted accounts no longer leave ghost avatars behind. Their leftover rows in server member lists, friend lists, group chats, and DMs are now cleaned up in one sweep instead of lingering in your sidebars. And when you catch a fly for Biomass, the "+N Biomass" note now comes from the real Spidr System account instead of a fake sender that landed in a broken thread.' },
  { id: 'p1925', title: 'Patch 1.9.25 — Spidr Apex + platform hardening', date: '2026-07-05', type: 'UPDATE', description: 'Spidr Apex ($7.99/mo, $69.99/yr) is live end-to-end — start a 30-day trial, upgrade, or manage your subscription from the app. Under the hood: every user-owned area (DMs, groups, friends, servers, saved audio, custom bots, collections, feeds, reports) is now locked to the owner, so nobody can edit anyone else\'s data. Server audit logs are permanent.' },
  { id: 'p1924', title: 'Patch 1.9.24 — Streak Counter + Steam Now Playing unlocked', date: '2026-07-02', type: 'UPDATE', description: 'Two modules step out of "Coming Soon". The Daily Streak Counter now tracks a real day-by-day login streak on your profile — miss a day and it resets, keep showing up and current, best, and total-days climb alongside it. Steam Now Playing is installable: enter your Steam ID, pick a game from your library, and your profile shows the game\'s art, hours played, and achievement progress.' },
  { id: 'p1923', title: 'Patch 1.9.23 — Bot Lab tidy + Spidr Protocol fixes', date: '2026-06-30', type: 'FIX', description: 'The Bot Laboratory drops the Data Analyst bot and lays every remaining bot out in a single alphabetical A→Z list instead of separate category grids. The Spidr Protocol overlay now sends messages properly to DMs, group chats, and server channels (group chats were silently hitting the wrong place), and dragging the top rail no longer flips interactive mode off mid-move so it stays where you drop it.' },
  { id: 'p1922', title: 'Patch 1.9.22 — Tablet chat headers + server avatars', date: '2026-06-30', type: 'FIX', description: 'Chat headers on tablets no longer crowd themselves — they collapse into the same hamburger menu mobile uses. "Sticky Web" is now called "Memory Web" in the quick-actions dropdown. And server channel messages now update people\'s avatars in real time, just like DMs and group chats already did.' },
  { id: 'p1921', title: 'Patch 1.9.21 — Spotify module privacy fix', date: '2026-06-29', type: 'FIX', description: 'The Spotify Now Playing widget on profiles used to show YOUR current track on everyone else\'s profile. It now shows the profile owner\'s track, so visitors see what THAT person is listening to. Connect and disconnect controls only appear on your own profile.' },
  { id: 'p192', title: 'Patch 1.9.2 — Bot Lab cleanup + mobile polish', date: '2026-06-28', type: 'UPDATE', description: 'A focused cleanup. Music Master and Game Master are retired — the Bot Laboratory now only ships the official bots that are fully working. "My Bots" is hidden until user-created bots are ready. Mobile polish lands across DMs, Friends, Servers, the Bot Lab, and the home dashboard — headers collapse cleanly on small screens, action rails tuck into dropdowns, and the Friends tab strip scrolls horizontally instead of wrapping. Flickery signals (typing banners, web alerts) are now smoothed.' },
  { id: 'p191', title: 'Patch 1.9.1 — Home + chat polish', date: '2026-06-27', type: 'FIX', description: 'A polish pass for the home page and chats. Activity Feed and Recent Servers on the home page now collapse with a chevron and remember your choice. Biomass fly-catches no longer spam whichever chat you\'re in — they log into your Spidr System DM instead. And message avatars in DMs and group chats now update everywhere the moment someone changes their profile picture.' },
  { id: 'p19m', title: 'Patch 1.9 — Spidr Mobile (Phase 1) is now live', date: '2026-06-20', type: 'UPDATE', description: 'Spidr is officially on iPhone and Android. Your friends, DMs, servers, and clips all come with you — log in once, everything stays in sync with the web app. THE WEB feed swipes vertically like TikTok, comments slide up from the bottom, and likes and follows count toward your personalized feed across web and mobile. Voice channels and the upload studio are coming in Phase 2.' },
  { id: 'p185', title: 'Patch 1.8.5 is now live', date: '2026-06-16', type: 'UPDATE', description: 'Three changes this patch. Friend avatars are now live everywhere — when a friend changes their profile picture, you see it instantly across the Friends panel, Spidr Web, and pending requests. Spotify presence is faster and lighter on traffic. And there\'s a brand-new 404 page — a hand-drawn cave-and-web scene with the Spidr mascot lost in the middle of the web.' },
  { id: 'p184', title: 'Patch 1.8.4 — DJ Booth in voice channels', date: '2026-06-16', type: 'UPDATE', description: 'DJ Booth is live in voice channels. Hit the green Music icon in the call dock, search Spotify, and the whole room sees synchronized DJ visuals — spinning album art, pulse rings, and a bouncing audience. Each listener still plays the host\'s track on their own Spotify. Also: Spotify search actually returns results now, expanding a minimized call routes you home properly, and the Mutuals tab is hidden on your own profile.' },
  { id: 'p183', title: 'Patch 1.8.3 — Weather widget privacy fix', date: '2026-06-15', type: 'FIX', description: 'The Weather widget used to show YOUR weather on every profile. Now each user has their own saved location, and viewing a profile shows THEIR weather. The city and region are hidden from the display so the profile owner\'s exact location stays private.' },
  { id: 'p182', title: 'Patch 1.8.2 is now live', date: '2026-06-15', type: 'UPDATE', description: 'A big features patch. Voice channels get Theater Mode when someone shares their screen, and minimized calls now show a live preview of what\'s happening. Repost lands on THE WEB — share any clip to your feed. Profile Anthem lets you set a song that auto-plays (muted) when someone views your profile. Plus: a nameplate cropper, shareable server invite cards, clickable links in chat, a Join by Invite Code tab on the Create Server dialog, comment replies in the notification center, and Spotify Now Playing in your browser (closed beta — ping Chris for access).' },
  { id: 'p181', title: 'Patch 1.8.1 is now live', date: '2026-06-12', type: 'FIX', description: 'Welcome Bot now greets every new member, not just the ones who joined via invite link. Browse-and-Join users get the greeting too.' },
  { id: 'p18web', title: 'Patch 1.8 — The Web Fixes', date: '2026-06-12', type: 'FIX', description: 'Slash commands got a serious upgrade. The autocomplete popup is now grouped by bot with avatars and colors, hides admin-only commands from non-admins, and shows up to 30 results with arrow-key navigation. New Auto Moderator commands: /modhelp, /modreset, /modtest, /modset unban all. New Welcome Bot commands: /welcomehelp, /welcomeconfig, /welcomedelete. Admins can now delete bot and system messages in their server. Plus a fix for the Copy Channel ID toast that flashed before the copy actually finished.' },
  { id: 'p18', title: 'Patch 1.8 is now live', date: '2026-06-10', type: 'UPDATE', description: 'All four official bots are now fully working. Auto Moderator scans every message for spam and banned words — configure thresholds and word lists in the Bot Laboratory. Welcome Bot greets new members in your server\'s first text channel with a template you control. Game Master runs trivia: /trivia posts a question with four options, first correct answer wins. Music Master\'s /play now shows the actual song title, and /skip and /stop clear cleanly.' },
  { id: 'p172', title: 'Patch 1.7.2 is now live', date: '2026-06-09', type: 'FIX', description: 'A polish pass on THE WEB. "Cocoons" is now called "Saved" everywhere — feed, profile tabs, and collections. The volume slider no longer disappears when you reach for it. GIF and image panels in comments close automatically when you scroll to a new video. And clicking a saved clip jumps you straight to it in the feed.' },
  { id: 'p171', title: 'Patch 1.7.1 is now live', date: '2026-06-08', type: 'FIX', description: 'Adding a friend you\'ve already added now shows "You already added this user!" instead of a confusing error. And SPIDR_SYS got caught up — patches 1.6.2, 1.7, and the deploy fix are all in the feed now.' },
  { id: 'p17', title: 'Patch 1.7 is now live', date: '2026-06-03', type: 'UPDATE', description: 'Module Nexus got a big overhaul. Gaming Uplink now detects games from every launcher — League of Legends, VALORANT, TFT, Steam, Epic, Battle.net, Game Pass, and more — with auto-extracted icons. Background apps (Medal, Discord, Spotify, OBS) no longer get mistaken for games. Spotify Now Playing is live in the desktop app: connect Spotify in Settings and your current track shows on your profile. New "Don\'t see your game?" form lets you flag missing detection. Plus desktop app polish: Spidr icon, drag the window from the top, resize, and the APEX upgrade dialog actually shows up now.' },
  { id: 'p162', title: 'Patch 1.6.2 is now live', date: '2026-06-02', type: 'UPDATE', description: 'A behind-the-scenes rebuild of the app\'s shell — same look, but the mobile menu is cleaner and pages load faster. A few legacy pages were retired to make room for the newer home dashboard and integrated profile flows.' },
  { id: 'p162b', title: 'Deploy pipeline fixed', date: '2026-06-02', type: 'FIX', description: 'Fixed the production deploy pipeline — releases to the web app no longer time out, so updates land reliably again.' },
  { id: 'p161', title: 'Patch 1.6.1 is now live', date: '2026-05-31', type: 'FIX', description: 'A polish pass on Patch 1.6. Voice channels now drop a vertical "web thread" to glowing crimson avatar nodes. The expanded call deck got a cleaner glass look, and screen share splits into a proper Main Stage with a collapsible sidebar of audio-reactive user pills. Minimized calls became a tiny "Micro-Tactical HUD" pill that fades when idle. New: a transparent "Spidr Protocol" overlay (desktop) lets you chat over a game without leaving it. Fixes: group chats no longer render blank, voice calls no longer show duplicate users, the message feed is cleaner, and the profile widget stopped overlapping content.' },
  { id: 'p16', title: 'Patch 1.6 is now live', date: '2026-05-31', type: 'UPDATE', description: 'The biggest visual and functionality pass yet. THE WEB feed: trending posts physically pulse, The Weaver upload studio gets signature filters, a precision dual-handle video scrubber, and external audio from YouTube / Spotify / Apple Music. New: tap-to-expand image lightbox in chat, rich GIF and image comments, and long-press menus on mobile. The channel sidebar, server chat, and Bot Laboratory all got reskinned in the crimson palette. Custom backgrounds now flow across the whole app. Plus a bunch of fixes: minimized calls work reliably, server permissions are correct, mute and deafen are properly distinct, "Pin to Web" confirms, tapping a Memory Web message jumps to it, voice channels show their members, and mobile is fully responsive.' },
  { id: 'p15', title: 'Patch 1.5 is now live', date: '2026-05-29', type: 'UPDATE', description: 'APEX Symbiote suite lands: Profile Takeover overlay, Stream HUD with live telemetry, Frame Vault, Nexus Grid sidebar, and custom Nameplates & Badges. Plus fixes: minimized calls use the new Web Node design everywhere, minimizing no longer disconnects you, the sidebar logo box is gone, APEX activation is fixed, and trending servers no longer 404.' },
  { id: 'p14', title: 'Patch 1.4 is now live', date: '2026-05-24', type: 'UPDATE', description: 'APEX gets hanging threads and mini voice visualizers. Calls auto-minimize when you navigate, the desktop app supports picture-in-picture, and you can now "Pin to Spidr Web" across Friends, DMs, and Groups.' },
  { id: 'voicefix', title: 'Voice messages fixed everywhere', date: '2026-05-24', type: 'FIX', description: 'Voice messages now send everywhere — DMs, group chats, and server channels. Fixed the upload error that was blocking them.' },
  { id: 'webnode', title: 'Suspended Web Node', date: '2026-05-23', type: 'UPDATE', description: 'Minimized calls now appear as a draggable "web node" — a glowing radial pill with an active-speaker waveform and your APEX-colored thread.' },
  { id: 'unicall', title: 'Universal calling', date: '2026-05-23', type: 'UPDATE', description: 'DM and group calls now use the exact same voice deck and screen share as server channels — one unified call experience.' },
  { id: 'trending', title: 'Trending server join flow', date: '2026-05-22', type: 'FIX', description: 'Opening a server from Trending no longer 404s. Non-members now see a proper Join / Request Invite screen.' },
];

const API_BASE = (import.meta.env.VITE_API_URL) || 'http://localhost:4000';
const TYPE_COLORS = {
  UPDATE: 'text-[#FF3333] border-[#FF3333]/40',
  ALERT:  'text-amber-400 border-amber-400/40',
  FIX:    'text-emerald-400 border-emerald-400/40',
};

export default function SpidrSystem() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // On <md, the X button fully dismisses the terminal (ticker disappears too)
  // instead of just collapsing it. Re-opening is then only possible via the
  // sidebar's "Spidr System" row (which fires `spidr-system-open`). On desktop
  // we keep the original collapse-to-ticker behavior since desktop has no
  // sidebar trigger to bring it back from a full dismiss.
  const [dismissed, setDismissed] = useState(false);
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
  // pop the terminal open (e.g. the MobileMenuPanel row). Also un-dismisses
  // so the sidebar can resurrect the terminal after the user X'd it on mobile.
  useEffect(() => {
    const handler = () => { setDismissed(false); setOpen(true); };
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

  // On mobile, the user has explicitly told the terminal to go away — render
  // nothing until the sidebar resurrects it via `spidr-system-open`.
  if (dismissed && isMobile) return null;

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
              <button
                onClick={() => { if (isMobile) setDismissed(true); else setOpen(false); }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
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
