const express = require('express');
const router = express.Router();

/**
 * GET /system/news — Spidr System announcements (patch notes, alerts, fixes).
 *
 * Server-curated list. Newest first. Each item:
 *   { id, title, date (ISO), type: 'UPDATE'|'ALERT'|'FIX', description }
 *
 * Kept in-code for now (no DB model needed); the client also ships a mock copy
 * so the terminal renders instantly even if this route is unreachable.
 *
 * WRITING PATCH NOTES — read this before editing:
 * These are shown to end users in the home-page terminal. Write them in plain
 * English. Explain what CHANGED for the user, not how the code got there.
 * No file paths, no function names, no library versions, no error codes.
 * Aim for 2–4 short sentences. Match the tone of recent entries.
 */
const NEWS = [
  {
    id: 'p1993',
    title: 'Patch 1.9.93 — The web welcome banner matches mobile',
    date: '2026-09-02',
    type: 'UPDATE',
    description:
      'The homepage welcome slab on web and desktop now behaves the same way as the one on mobile. The mascot floats over a soft red bloom instead of sitting inside a hard container, and the greeting cycles between welcoming you back by name and counting down the days until the beta release, typed out one character at a time with a blinking cursor. On mobile the mascot artwork was swapped over to the same spider used everywhere else in the app, so the icon on the homepage now matches the one you see when you download, on the loading screen, and in your browser tab, rather than being a slightly different variant. Also folds in a background sync fix: the home-page system terminal had fallen roughly nineteen patches behind on the server across the recent DJ booth work, so the unread badge could not fire for anything newer than late August. Server and client are back in lockstep on every entry, so new patches show up as unread again the moment they land.',
  },
  {
    id: 'p1992',
    title: 'Patch 1.9.92 — The booth stops depending on previews',
    date: '2026-09-01',
    type: 'FIX',
    description:
      'You were right that the buttons felt empty, and the cause was structural rather than a bug. The booth was built preview-first: a session could not even START without picking a track, and the audio everyone heard was Spotify\'s 30-second preview clip. But Spotify stopped serving preview_url for most of its catalogue, and the stricter matching added last patch correctly refuses to substitute a different recording rather than playing the wrong song — so the honest result was a session with nothing to play. Every feature layered on top, Share Audio and Pass the Aux included, was bolted to a foundation that mostly produced silence. Sharing is now the primary path rather than a side option. A DJ session can be opened with NO track at all — you hit Share Audio, pick the tab or window playing your music, and the whole call hears full-length audio, free-tier accounts included. Track metadata becomes optional annotation for the room display instead of the thing being played, which is also the honest answer to how Pass the Aux works: the aux IS the share, so handing it over moves who is sourcing the audio. The 30-second preview path still exists as a fallback and is now labelled as such in the picker. When a track genuinely has no preview, the banner no longer dead-ends with try another song — a suggestion that frequently has no working answer — it offers a one-click switch to sharing instead.',
  },
  {
    id: 'p1991',
    title: 'Patch 1.9.91 — DJ booth crash fixed',
    date: '2026-09-01',
    type: 'FIX',
    description:
      'The booth was white-screening with a Cannot access before initialization error, which is why the last few patches looked like nothing had changed — the component was crashing before it could render any of them. My fault, and the same trap that took out the friends page in 1.9.47: the visualiser block I added sat near the top of the component but referenced liveAudioActive, previewUrl and userPaused, all of which are declared further down. Const bindings are hoisted but stay unreachable until their own line executes, so every single render threw. The block now sits below its dependencies with a comment explaining why it must stay there. I also swept every component and hook in the app for the same pattern rather than just fixing this one instance — two other files flag but both are false positives, where a nested component takes a prop with the same name as outer state. Also verified this build: fifteen DJ booth features confirmed present in the source, every client file parses, the whole bundle builds, and every server file passes syntax check. On the logo 422 in your console: that file is a valid 640 by 640 PNG sitting in public and the app references it correctly, so a 422 is coming from the host or proxy rejecting the request rather than anything in the code — worth checking the deploy config, not the source.',
  },
  {
    id: 'p1990',
    title: 'Patch 1.9.90 — The booth reacts to the music',
    date: '2026-08-31',
    type: 'UPDATE',
    description:
      'The DJ booth no longer animates on a fixed timer pretending to feel the music — it reads the actual audio. Frequency data is split into lows, mids and highs, and each drives something different: bass thickens the neon rings and slams their glow so 808s visibly punch, mids swell the album disc slightly, highs add a faint shimmer across the background so hi-hats register without muddying the main pulse, and the ambient bloom behind everything breathes with the low end. The easing is asymmetric on purpose — values snap up fast so a kick lands on the beat and fall slowly so the HUD glows down instead of strobing. A symmetric ease makes percussion look mushy and no easing at all just flickers. On the architecture: each listener analyses the audio THEY are receiving rather than the DJ broadcasting numbers to everyone. Broadcasting would drift against each person\'s jitter buffer by tens of milliseconds and look visibly wrong, and the audio is already local so analysing it is cheaper anyway. It reads whichever source is actually audible — the DJ\'s incoming share on a live session, the local clip otherwise — and shuts off entirely when the booth is silent. Cost is one analyser for the whole booth at thirty samples a second, taking a five-person call from a hundred and twenty five audio passes per second to a hundred and fifty five. For reference the same call was running seven hundred and twenty before last patch\'s cleanup. Both audio sources come from the shared ref-counted registries rather than fresh nodes, including a new one for media elements — creating a second source on an element reroutes its output and silently mutes it unless you reconnect to the destination, which is exactly the trap that killed call audio twice before.',
  },
  {
    id: 'p1989',
    title: 'Patch 1.9.89 — Pass the Aux',
    date: '2026-08-31',
    type: 'UPDATE',
    description:
      'A DJ session can now outlive the person who started it. Until now the music lived on the DJ\'s machine, so when they left it died with them and the booth was stranded — only the host can change tracks or end a session, so an absent host meant a room nobody could control. That was the last thing a server-side music bot genuinely did better, because a bot never leaves the channel. The DJ now gets a Pass the Aux button listing everyone in the call. It is an offer, not a shove: the target sees a prompt and can take it or decline, and taking it drops them straight into the share flow, because accepting the role without starting a share leaves the room on the 30-second preview which is the confusing half-state. Offers expire after a minute, can be cancelled by the host, and are refused if the target has already left the call. The session also rescues itself when a DJ vanishes without handing off at all. Rather than leaving a dead booth, the server promotes whoever is still in the call — longest-present member first, a stable choice every client agrees on — resets the audio route to preview since the departed DJ\'s share is gone, and ends the session outright only if nobody is left. Handoff state lives on the session document rather than in server memory, so it survives a restart and both clients always agree on whether an offer is outstanding.',
  },
  {
    id: 'p1988',
    title: 'Patch 1.9.88 — Performance: I caused the lag',
    date: '2026-08-31',
    type: 'FIX',
    description:
      'The app got sluggish and it was my doing. Adding the always-on speaking broadcaster left every peer being analysed TWICE — once by their tile and once by the broadcaster — with a third loop for the status pill during screen shares, and each of those ran a full-buffer audio analysis on every single animation frame at 60Hz. I had also removed the gate that paused those loops while the call deck was hidden, so they kept running when nothing was on screen, and stacked a mic-level meter and a voice gate loop on top at the same rate. In a five-person call that adds up to roughly seven hundred audio analysis passes a second, which is exactly what sluggish feels like. Now one detector analyses each stream and publishes its result; the tiles and pills listen instead of recomputing. Sampling dropped from every frame to about fifteen times a second for speaking rings, thirty for the mic gate and twenty for the level meter — all indistinguishable on screen, because a speaking ring is a boolean with a three hundred millisecond hold and cannot benefit from sixty updates a second. The equalizer no longer animates while the deck is hidden, and the share-audio watchdog poll only runs while a share is actually live. Net effect in a five-person call: from about seven hundred and twenty analysis passes per second down to a hundred and twenty five, an eighty three percent reduction.',
  },
  {
    id: 'p1987',
    title: 'Patch 1.9.87 — Ghost apps deleted, zombie audio killed, pause works',
    date: '2026-08-31',
    type: 'FIX',
    description:
      'Four real bugs, and the first one is embarrassing: the share picker was showing League of Legends and Valorant with SPIDR SENSE DETECTED badges because they were HARDCODED FAKE ENTRIES in the source, alongside VS Code and Discord. They appeared whether or not those programs were installed, let alone running, and clicking any of them just opened the browser\'s own picker anyway. The whole fake grid is deleted. A browser fundamentally cannot enumerate your running applications — that would be a privacy hole — so the web build now hands straight off to the native picker and explains what to choose in it. The desktop app was always fine here: it lists real windows and screens with live thumbnails from the OS. The 30-second clip playing over a live share had two causes beyond the obvious. The cleanup never removed the pending canplay listener, so when the route flipped to live that listener fired afterwards and started playback on an element we thought was stopped; and an in-flight play promise resolves AFTER pause runs, resuming a beat later. Suppression now tears the element down completely — pause, drop the source, abort the fetch — and every run knows if it has been superseded before it is allowed to play. Pause did nothing because the transport buttons were hardcoded disabled with no handlers, AND the button component silently discarded any onClick it was given. Both fixed, and pause is now route-aware: it pauses the clip on preview, pauses MusicKit on full tracks, and on a live share it mutes the incoming audio for YOU while saying plainly that Spidr cannot pause the DJ\'s app. Wrong album art traced to a SECOND iTunes lookup — in the search route, not just the session route — still taking the first result blindly, so Spotify\'s correct title and art shipped with some other recording\'s audio. Both paths now verify title and artist before accepting a match.',
  },
  {
    id: 'p1986',
    title: 'Patch 1.9.86 — Dead-share detection for the DJ booth',
    date: '2026-08-31',
    type: 'FIX',
    description:
      'Answering a question that found three holes. Previously only ONE failure was handled: the DJ clicking stop, or closing the shared window, which ends the video track and tears the share down cleanly. Everything else left the room stranded on a live-audio route with nothing playing — silence behind a Live audio badge, with everyone\'s preview suppressed by a share that no longer existed. All three paths are covered now. If the AUDIO track dies on its own while video keeps running — the DJ quits Spotify, or the OS drops the loopback capture — the booth now watches that track\'s own ended, mute and unmute events rather than only re-checking when the stream object changes identity, which it does not in that case. A three-second poll backs it up, because some platforms flip the track to ended without firing any event at all, Windows loopback being the notable one. Listeners no longer take the session\'s word for it either: if the route says live but no screen stream is actually arriving from the host, each client independently decides the audio is dead and falls back to its own preview. And if the DJ\'s app crashes or their connection drops entirely, their client cannot report anything ever again — so the server now resets the session\'s audio route to preview when the host\'s last socket disconnects, the same failsafe pattern that stops a closed game staying pinned to a profile.',
  },
  {
    id: 'p1985',
    title: 'Patch 1.9.85 — Metadata and audio stop fighting',
    date: '2026-08-30',
    type: 'FIX',
    description:
      'Answering a question that turned out to be a bug. Yes, the DJ still drives the room display with the Spidr search bar — picking a track writes the name, artist and album art onto the session and every client in the call renders from that, so the neon centre-stage art is correct for everyone regardless of where the sound is coming from. But nothing stopped the 30-second preview from ALSO playing while audio was riding a screen share, which meant the room would have heard two copies of the same song at different offsets. The session now carries an explicit audio route — preview, live stream, or full track — and clients refuse to play the clip whenever the room is hearing the live share. The route flips automatically the instant a share starts or stops carrying sound, rather than being a toggle somebody has to remember, because the failure mode of forgetting is the doubled-audio mess. While a live share is running the booth relabels itself honestly: a green Live audio badge naming the DJ, and picking a track says Now showing rather than Now spinning, since at that point the search bar is updating the room art and not driving playback. Changing the announced track mid-share also preserves the live route, which otherwise would have quietly dropped everyone back onto the preview on top of the audio they were already hearing.',
  },
  {
    id: 'p1984',
    title: 'Patch 1.9.84 — Share Audio DJ mode',
    date: '2026-08-30',
    type: 'UPDATE',
    description:
      'Full-length music for everyone in a call, including free-tier users, without a music API in the loop. It rides the screen-share pipe that already forwards system audio with the voice filters switched off, so tracks arrive intact rather than squashed like a microphone. The hard part was never capture — it was that screen-share audio behaves completely differently depending on where you are running Spidr, and picking the wrong source gives you a share that is silently mute until somebody in the call says they cannot hear anything. The booth now works that out for you. In the Spidr desktop app on Windows the main process grabs the system mix, so you can pick the Spotify DESKTOP APP window and audio still comes through. In a browser, window shares can never carry audio on any operating system — that is a Chromium limitation, not a setting — so those tabs are now marked with a crossed-speaker icon and the picker steers you to the tab route instead. On macOS browsers, system audio cannot be captured at all, so the guidance points at the Spotify Web tab. A banner at the top of the picker states the one route that actually works in your environment before you choose. And if a share does start without audio, a warning fires immediately explaining why, rather than leaving you broadcasting silence. The DJ booth gained a Share Audio button next to the queue controls so the whole thing is discoverable from where you would look for it.',
  },
  {
    id: 'p1983',
    title: 'Patch 1.9.83 — DJ booth overhaul + collaborative queue',
    date: '2026-08-30',
    type: 'UPDATE',
    description:
      'Three DJ bugs fixed and the booth is now a shared session. The wrong-song bug had a specific cause: when a track ships no preview audio, the server searches iTunes for the title and artist and was blindly taking the FIRST result — which is routinely a cover, a live cut, or a same-titled song by someone else. The card showed one thing, the speakers played another. Candidates are now verified before use: both title AND artist must corroborate the track the DJ actually picked, with remaster and live and radio-edit noise stripped before comparing, and if nothing corroborates we ship no audio at all, because silence with correct metadata beats confidently playing the wrong song. When a substitute source IS used the booth now says so with a small Preview via iTunes label rather than passing it off as the original. The missing volume control is back — the host dock accepted volume props but never rendered a slider, lost in a branch merge; listeners always had one. And the booth is collaborative now. Anyone in the call can add tracks to an Up Next queue, each row showing who queued it; you can pull your own entry and the DJ can pull anyone\'s, and the DJ gets a Play Next button that advances the queue server-side so the list and the now-playing can never disagree. Queue is capped at fifty with duplicate rejection so nobody can flood the booth. On the thirty-second limit: that is Spotify policy, not a bug. Their API only exposes 30s previews, and full playback requires each listener to have their own Premium account driving the Web Playback SDK locally. Apple Music subscribers already get full tracks through the existing MusicKit path.',
  },
  {
    id: 'p1982',
    title: 'Patch 1.9.82 — The welcome banner breathes',
    date: '2026-08-30',
    type: 'UPDATE',
    description:
      'The mascot on the homepage banner was sitting inside a dark purple circle with a red border, which made it read as a pasted sticker rather than part of the interface. Worth being precise about why: the artwork itself was never the problem — it is a genuine transparent PNG, verified alpha zero at the corners — so swapping the image would have changed nothing. The circle was pure CSS wrapped around it, and its overflow-hidden was quietly clipping the spider\'s legs, because a 64px image was being rendered inside a 56px container. The container is gone. The mascot now floats free at a larger size against an ambient red bloom with no hard edge, so it reads as emitting light rather than sitting in a well, and it BREATHES on a four-second loop where the scale and the intensity of the red glow swell together. That is a slower, wider cousin of the animation the sidebar Core button uses — a big element always on screen needs a slower pulse, since the faster timing reads as flicker at that size. The copy went tactical too: WELCOME BACK became SYSTEM UPLINK ESTABLISHED behind a small pulsing red dot, the greeting got heavier and larger, and your name now carries a crimson gradient with a soft glow instead of flat red. The slab itself warms toward red on the left so the logo sits in light rather than on plain glass. The animation respects prefers-reduced-motion: the glow stays, the pulsing stops.',
  },
  {
    id: 'p1981',
    title: 'Patch 1.9.81 — Shared DM backgrounds, actually shared',
    date: '2026-08-30',
    type: 'FIX',
    description:
      'Moving DM wallpapers onto a shared conversation document last patch was the right change but not the whole fix. The remaining problem: two people in the same DM can be using DIFFERENT conversation_id strings for it — a thread opened from each side, or ids created before the sorted-pair convention was applied everywhere. That same split is what produced duplicate heads in the SPIDR WEB strip. With divergent ids each client read and wrote a DIFFERENT settings row, so a background set by one person was invisible to the other even though the storage, the route, the socket room and the broadcast were all working correctly. Settings are now keyed on the PARTICIPANTS rather than on whichever id string a client happens to send: the server resolves both parties from the thread and rebuilds the canonical sorted id for every read and write, so both sides always land on one row. The change also broadcasts to both id variants, and the client accepts a broadcast matching either, since the other person may have joined the room under their own variant. Finally, the settings query now refetches when you open or refocus a conversation — you only sit in a DM socket room while that chat is open, so a background changed while you were elsewhere used to be missed entirely rather than picked up on return.',
  },
  {
    id: 'p1980',
    title: 'Patch 1.9.80 — Ghost presence exorcised',
    date: '2026-08-30',
    type: 'FIX',
    description:
      'A game you closed hours ago could stay pinned to your profile as CURRENTLY IN LOBBY forever. The desktop watcher was never the problem — it reports "no game running" the instant you close one. The problem was that nobody was listening: the code that saved status changes lived inside the gaming widget on your profile page, so it only ran while you were actually looking at your own profile. Close a game while reading a DM or sitting in a server and the clear event fired into an empty room, leaving the stale title in the database. Detection now lives at the app shell and runs for your entire session no matter what screen you are on. Three more layers of defence, because presence rots in more ways than one. Quitting Spidr fires a clear on the way out. If you force-quit or your wifi drops mid-game, no client event can possibly fire — so the server now wipes your game status when your last socket disconnects, on the reasoning that a connection that no longer exists cannot be observing a running game. And any status carries the timestamp of the reading that produced it, so a row that somehow outlives all of that gets aged out after fifteen minutes rather than displayed as a live session indefinitely. Status changes also broadcast now, so a friend closing their game clears the card on your screen immediately instead of after a refresh.',
  },
  {
    id: 'p1979',
    title: 'Patch 1.9.79 — DM backgrounds are shared now',
    date: '2026-08-30',
    type: 'FIX',
    description:
      'Setting a DM background only changed it for you — the other person never saw it. That was not a sync bug so much as a storage decision that turned out wrong: wallpapers were saved on YOUR profile, keyed by conversation, because direct messages had no shared document to attach anything to. Stored per-user, they were private by construction. DMs now have a real container: a ConversationSettings document keyed by conversation id, so a background set by either side belongs to the conversation itself. Changing it writes the value, drops a system row into the thread, and broadcasts to the conversation room, so the other person\'s chat repaints instantly rather than after a refresh. The change also leaves a mark in the history — a centered frosted pill reading X set the background image as, with a thumbnail of the new wallpaper, or X removed the background image when cleared. It is a real message row rather than a toast, so it survives reloads and both sides see it in the timeline. Groups already worked this way, since a group chat always had a document of its own. Two supporting details: the route verifies you are actually a participant before reading or writing, because a conversation id is not a capability and without that check anyone could repaper a stranger\'s thread by guessing an id; and the client API gained a PUT verb it never had, which the new endpoint needed.',
  },
  {
    id: 'p1978',
    title: 'Patch 1.9.78 — Connections, two ways in',
    date: '2026-08-30',
    type: 'UPDATE',
    description:
      'Neural Links — the panel where you connect Spotify, Apple Music and the rest — is now reachable straight from your profile card in the bottom-left corner, not just buried in Settings. A new link icon sits beside the gear on the profile popover and opens the panel as a floating glass modal over whatever you were doing. It is the SAME component the Settings tab renders, not a copy: passing an onClose handler is the only difference, and that flag is what makes the panel draw its own dismiss button and size itself for a modal instead of filling the settings pane. So when a new integration gets added later it appears in both places automatically, with no chance of the two drifting apart. One structural detail: the modal renders through a portal to the document body rather than inside the profile chip. The chip is a small hover-driven popover pinned in the sidebar corner — a modal nested inside it would have been clipped by the rail, and worse, it would have unmounted the instant the popover closed on mouse-leave, so the panel would vanish the moment you moved the cursor toward it.',
  },
  {
    id: 'p1977',
    title: 'Patch 1.9.77 — Signal Radar goes glass',
    date: '2026-08-30',
    type: 'UPDATE',
    description:
      'Signal Radar was the last screen still wearing the old retro-terminal look — repeating scanlines, opaque black panels, hard neon borders and angular clipped corners — and it read as a different application next to the rest of Spidr. It is now built the same way as the Bot Lab and the sidebar. The scanline grain is gone, replaced by a single enormous heavily-blurred red bloom sitting deep behind the interface like a radar sweep, which the cards above it can actually catch. Server cards became frosted glass: rounded, highly translucent, a faint white border that warms to red on hover with a soft diagonal wash instead of a hard neon outline. The search field lost its solid black fill and HUD corner ticks for the same frosted treatment, and the Establish Uplink button now reads as a glass action rather than a flat outlined box. New on every card: a View Info button beside the uplink action. Clicking it slides a Signal Dossier panel up over the card face — the full description, the total roster (everyone who has ever joined, which the card front never showed since the front counts only who is live right now), how many are on air, when the server last had a pulse rendered as a human relative time, and its first-contact date. It opens in place rather than routing away, so you never lose your spot in the grid.',
  },
  {
    id: 'p1976',
    title: 'Patch 1.9.76 — The @ popup surfaces',
    date: '2026-08-30',
    type: 'FIX',
    description:
      'The mention popup was rendering UNDER the chat box. It already had z-50 and bottom-full, which is why it looked correct in the code — but z-index only competes inside its own stacking context, so no value would ever have lifted it above an ancestor that clips or paints over it. The popup now renders through a portal to the document body, positioned from the input\'s measured rect and re-measured on scroll and resize. That is the same technique the slash-command palette in the same component was already using — the mention popup had simply never been converted. You can also @ people the popup used to hide. Server members were dropped from the mention list entirely if their denormalized user_name field was missing, and that field goes unstamped on plenty of rows — dormant accounts most of all, which is why it read as not being able to mention offline users. Members are now kept on user_id alone and their name resolves through nickname, then the stored name, then their live profile, then a short id fallback, so there is always a usable label and nobody silently disappears from the list. The composer input also gained its own paint layer so nothing decorative in the bar can sit on top of typed text.',
  },
  {
    id: 'p1975',
    title: 'Patch 1.9.75 — One command column',
    date: '2026-08-30',
    type: 'UPDATE',
    description:
      'Jump Back In now sits directly beneath Top Creators instead of floating as its own third column. Trending Servers, Top Creators and Jump Back In share a single fixed-width right rail that stacks vertically with even spacing, which gives the main dashboard — Web Tension, Find Friends, Discover People, the Activity Feed — the full remaining width instead of competing with a second rail for it. The rail widened slightly to fit the conversation rows comfortably and stays shrink-proof when the window narrows. Two structural details worth noting: Jump Back In no longer carries its own sticky positioning, because the rail wrapper already owns that for the whole stack and a nested sticky inside a scrolling container pins to the container rather than the viewport — it would have stuck to the rail\'s own scrollbar. And the mobile copy of the panel had its breakpoint corrected from xl to lg to match the rail exactly: the rail used to appear at xl and the in-column copy hid at xl, which lined up, but consolidating moved the rail to lg and leaving the copy at xl would have rendered Jump Back In TWICE on every laptop-width screen between those two breakpoints.',
  },
  {
    id: 'p1974',
    title: 'Patch 1.9.74 — Merge + duplicate heads and sticky badges',
    date: '2026-08-30',
    type: 'FIX',
    description:
      'This build merges two branches that had diverged: the notification overhaul (scoped mobile push, permission primers, per-group notify modes) and the search/tags/wallpaper line (Search and Media Hub, word tags, chat backgrounds, bulletproof server avatars, the tactical server matrix). Both are now in one tree with nothing dropped from either. Two bugs from QA squashed. The duplicate head in SPIDR WEB was not a missing dedupe — the code already collapsed conversations into a map, but keyed it by conversation_id, and the same person can hold two conversation ids when a thread was started from each side. Keyed that way, one friend rendered as two identical heads. Conversations now fold by PERSON: the newest thread wins for opening, unread counts are SUMMED across the merged threads so opening the head clears everything the badge was counting, and whichever record actually resolved a name and avatar is kept. The sticky red badges had a separate cause: opening a conversation marks it read and invalidates several caches, but the SPIDR WEB strip reads its own quickheads query key which was never in that list — so its badges survived until a full page reload even though the messages were genuinely read. That key is now invalidated too. The friends list below also gained defensive dedupe by friend id, since mirrored friend rows or an accept racing an invite could duplicate a person there in exactly the same way.',
  },
  {
    id: 'p1969',
    title: 'Patch 1.9.69 — Notification overhaul',
    date: '2026-08-26',
    type: 'UPDATE',
    description:
      'Notifications from a person now show that person\'s profile picture and the actual message instead of the Spidr logo and a bare "New message". Mentions and group chats get the full group treatment: the server or group picture, who posted, where they posted it, and what they said — and when a server or group has no picture of its own, the sender\'s shows instead. Servers and group chats now ping you on every message by default, with new switches to narrow either one down to @mentions only, plus a per-server and per-group control so you can set any single one to All, @mentions only, or Muted without touching the rest. Signing in now asks for microphone, camera and notification access in one short setup step rather than interrupting your first call. Also includes a background security update to the realtime connection layer.',
  },
  {
    id: 'p1968',
    title: 'Patch 1.9.68 — Symbiote edit bar',
    date: '2026-08-22',
    type: 'UPDATE',
    description:
      'Editing a message no longer shows a flat gray box with an OS emoji glued to it. The bar is now a symbiote clamp over the composer: a crimson-tinted chassis with a red border whose aura BREATHES on a 2.8 second loop, and a bright highlight that crawls along the top edge like something moving under the surface. The pencil is a sharp vector now rather than the platform emoji, which rendered differently on every operating system and made the whole component read as a web template. Editing message sits in red above a small mono esc to cancel hint, with an explicit Cancel pill on the right. One thing that had to be fixed to ship this honestly: the design advertises esc to cancel, but Escape only ever dismissed the slash-command palette and then fell through with nothing listening — the label would have been a lie. Escape now genuinely cancels an in-progress edit. The animation respects prefers-reduced-motion: the glow stays, the breathing and the crawl stop.',
  },
  {
    id: 'p1967',
    title: 'Patch 1.9.67 — Sidebar pop-outs + Bot Lab chassis',
    date: '2026-08-22',
    type: 'UPDATE',
    description:
      'Every sidebar icon now slides open on hover into a glowing pill that names it — the icon holds position while the chassis expands rightward with a red border and aura, and the label fades in a beat later on a slide, giving it that HUD feel. Bot Lab gets its own grade of the same physics: the aggressive mech-border chassis with angled cybernetic corners cut at each edge, a brighter aura, black italic type, and its real badge artwork in place of the generic chat glyph. Identical expansion timing across both grades so the rail stays cohesive when you run the mouse down it. Two engineering notes. The Bot Lab art was converted to TRUE transparency rather than the usual mix-blend-screen trick — screen-blending makes every black pixel vanish, which would have gutted the badge\'s own black outlines, the spider\'s shading, and the dark panel behind the circuit traces, and it only looks right on a pure-black backdrop. Instead the background was flood-filled from the image borders, so the black BEHIND the badge is stripped while every black pixel INSIDE the artwork survives, and the cut edge is feathered so the neon glow does not look razor-cut. The pop-out itself is rendered as a viewport-anchored overlay measured from each item, because the nav rail clips horizontal overflow at 72px — an in-flow hover expansion would have been sliced flat at the rail edge.',
  },
  {
    id: 'p1966',
    title: 'Patch 1.9.66 — Friends flow self-heals',
    date: '2026-08-22',
    type: 'FIX',
    description: 'Accepting a friend request no longer leaves your friends list one-sided — if the sender\'s side never mirrored to you the first time, accepting now creates the missing row so both of you actually see each other as friends. Unfriending someone also clears both sides at once, so nobody is left with a phantom friend that has no record of them. And on a shared browser, your pinned conversations and pinned group chats are now scoped to your account, so switching users doesn\'t leak the last person\'s pins into your sidebar.',
  },
  {
    id: 'p1965',
    title: 'Patch 1.9.65 — Account safety + mobile polish',
    date: '2026-08-21',
    type: 'UPDATE',
    description: 'Sign-in, verification, and account-recovery messages no longer reveal whether an email is registered, so nobody can fish for who has a Spidr account. Rate limits on those flows now apply per email address instead of only per network, so someone rotating networks can\'t keep hammering one account. The mobile app also picks up its new branded icon and splash screen, the Settings screen is stripped down to clean rows, and a maintenance fix backfills friend requests that could get stuck showing accepted on one side and still pending on the other.',
  },
  {
    id: 'p1964',
    title: 'Patch 1.9.64 — iOS notifications now work',
    date: '2026-08-20',
    type: 'FIX',
    description: 'iOS notifications finally light up your lock screen — you\'ll get a banner when a friend messages you or calls, even with the app closed. The mobile home tab also gets a Jump Back In shortcut and a pinned-favorites panel alongside your recent servers.',
  },
  {
    id: 'p1963',
    title: 'Patch 1.9.63 — Mobile DM unread badges',
    date: '2026-08-20',
    type: 'FIX',
    description: 'Direct message unread counts on mobile now show up the moment a friend messages you and clear the moment you open the chat. The badge appears in three places instead of one: the Friends tab, the home page Friends tile, and each friend\'s avatar in your Recents strip. A DM that lands overnight bumps the badge the moment you reopen the app.',
  },
  {
    id: 'p1962',
    title: 'Patch 1.9.62 — Cleaner missed-call notes',
    date: '2026-08-19',
    type: 'FIX',
    description: 'Missed call notes in your chats got three fixes. Group calls now leave a proper "you tried calling this group" or "<name> called this group" note, hanging up a connected call no longer stamps a fake "didn\'t answer" row on top of it, and every note now shows the real caller name instead of "Someone". Mobile chat threads render missed calls as clean centered alerts instead of raw message bubbles.',
  },
  {
    id: 'p1961',
    title: 'Patch 1.9.61 — Notification controls + Close Friends',
    date: '2026-08-19',
    type: 'UPDATE',
    description: 'Notification toggles on mobile finally do what they say — every switch (DMs, mentions, friend requests, calls) is now enforced on the server, and Do Not Disturb actually silences pushes. Close Friends is a real feature now: tap the star on any friend\'s profile and they can break through DND when it matters. The DM header video button now actually starts a video call (it was silently starting voice), and tapping a notification takes you straight to the right conversation, server, or friend request.',
  },
  {
    id: 'p1960',
    title: 'Patch 1.9.60 — Native mobile calls',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'Native mobile calling is back online. An incoming Spidr call now lights up your phone\'s real lock-screen call UI, just like a normal phone call. Mobile callers land in the exact same voice room as web callers so everyone joins one session, and your Voice & Video settings (mic, camera-on-join, speaker default) apply automatically. The in-call screen is a fresh full-screen UI with a pulsing avatar for voice and self-view picture-in-picture for video.',
  },
  {
    id: 'p1959',
    title: 'Patch 1.9.59 — The Spidr Web Matrix',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'Jump Back In and the Spidr Web pinned strip are now ONE tabbed panel on the homepage. The Jump Back In tab lists recent DMs and group chats with hover rings in symbiote red. The Spidr Web tab shows your pinned connections wearing the signature red-to-purple gradient ring with a pushpin badge, a live presence dot on pinned DMs, and a hover wash that bleeds red into purple. Pins update instantly when you pin someone from anywhere in the app, and the panel appears at every screen size.',
  },
  {
    id: 'p1958',
    title: 'Patch 1.9.58 — The Core actually lands this time',
    date: '2026-08-18',
    type: 'FIX',
    description: 'The Spidr Core — the breathing home button — is now in the desktop sidebar where you\'ll actually see it (last patch put it in a dead file nobody rendered). Hover it to lunge the spider to full color, click it to fire a synthesized symbiote heartbeat, and when you\'re on the home page the mascot and its red aura breathe on a three-second loop with a glowing red bar on the left rail.',
  },
  {
    id: 'p1957',
    title: 'Patch 1.9.57 — The Spidr Core breathes + native title bar',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'The home button in the floating dock is now the Spidr Core. Dormant it sits desaturated and dim; hovering lunges it to full color and scale; active it BREATHES on a three-second loop, so the app\'s anchor point feels alive instead of static. Clicking fires a synthesized symbiote heartbeat — a two-beat low thump. Windows and Linux now use the real system minimize/maximize/close buttons on the header (like VS Code and Discord). A broken avatar or server icon anywhere in the app now falls back to a spider placeholder instead of the browser\'s torn-page glyph.',
  },
  {
    id: 'p1956',
    title: 'Patch 1.9.56 — In-app updates + "Likes" rename',
    date: '2026-07-26',
    type: 'UPDATE',
    description: 'The desktop app now updates itself — a new patch drops, you see "Update available", and it installs when you next quit. No more manual re-download from spidrapp.com. "Resonance" on profiles is now called "Likes" everywhere (web and mobile). Also picked up: tap-to-react and share sheets on mobile, a proper Not Found screen for dead links, and a home page card that mirrors the SPIDR_SYS terminal.',
  },
  {
    id: 'p1955',
    title: 'Patch 1.9.55 — APEX store knows you\'re already subscribed',
    date: '2026-07-22',
    type: 'FIX',
    description: 'Opening APEX while you\'re already subscribed no longer pitches you the price again. The panel now shows a clear "YOU ALREADY HAVE APEX" confirmation with a Manage Subscription button, and the header pill switches from UNLOCKED to ACTIVE. The feature grid and the top-right settings gear are unchanged, so managing the subscription is still one click away.',
  },
  {
    id: 'p1954',
    title: 'Patch 1.9.54 — Landing redesign + safer desktop links',
    date: '2026-07-22',
    type: 'UPDATE',
    description: 'The spidrapp.com landing site got a full design refresh across Hero, Navbar, Community, Platforms, WhySpidr, and Footer, and the "SPOTS LEFT" counter is live again on first paint. On desktop, every clicked link is now validated before it can leave the app — anything that isn\'t a normal http, https, or mailto link is blocked, so a crafted chat link can\'t hijack your system.',
  },
  {
    id: 'p1953',
    title: 'Patch 1.9.53 — Signals tab no longer erases requests',
    date: '2026-07-21',
    type: 'FIX',
    description: 'Two fixes for the Signals inbox on the Friends panel. Peeking at a stranger\'s DM used to make their request vanish with no way to accept or block — requests now stay put until you actually act on one. And DMs from deleted accounts no longer show up as ghost conversations in Jump Back In or your DM list.',
  },
  {
    id: 'p1952',
    title: 'Patch 1.9.52 — Ghost members purged + real fly-catch DMs',
    date: '2026-07-21',
    type: 'FIX',
    description: 'Deleted accounts no longer leave ghost avatars behind. Their leftover rows in server member lists, friend lists, group chats, and DMs are now cleaned up in one sweep instead of lingering in your sidebars. And when you catch a fly for Biomass, the "+N Biomass" note now comes from the real Spidr System account instead of a fake sender that landed in a broken thread.',
  },
  {
    id: 'p1925',
    title: 'Patch 1.9.25 — Spidr Apex + platform hardening',
    date: '2026-07-05',
    type: 'UPDATE',
    description: 'Spidr Apex ($7.99/mo, $69.99/yr) is live end-to-end — start a 30-day trial, upgrade, or manage your subscription from the app. Under the hood: every user-owned area (DMs, groups, friends, servers, saved audio, custom bots, collections, feeds, reports) is now locked to the owner, so nobody can edit anyone else\'s data. Server audit logs are permanent.',
  },
  {
    id: 'p1924',
    title: 'Patch 1.9.24 — Streak Counter + Steam Now Playing unlocked',
    date: '2026-07-02',
    type: 'UPDATE',
    description: 'Two modules step out of "Coming Soon". The Daily Streak Counter now tracks a real day-by-day login streak on your profile — miss a day and it resets, keep showing up and current, best, and total-days climb alongside it. Steam Now Playing is installable: enter your Steam ID, pick a game from your library, and your profile shows the game\'s art, hours played, and achievement progress.',
  },
  {
    id: 'p1923',
    title: 'Patch 1.9.23 — Bot Lab tidy + Spidr Protocol fixes',
    date: '2026-06-30',
    type: 'FIX',
    description: 'The Bot Laboratory drops the Data Analyst bot and lays every remaining bot out in a single alphabetical A→Z list instead of separate category grids. The Spidr Protocol overlay now sends messages properly to DMs, group chats, and server channels (group chats were silently hitting the wrong place), and dragging the top rail no longer flips interactive mode off mid-move so it stays where you drop it.',
  },
  {
    id: 'p1922',
    title: 'Patch 1.9.22 — Tablet chat headers + server avatars',
    date: '2026-06-30',
    type: 'FIX',
    description: 'Chat headers on tablets no longer crowd themselves — they collapse into the same hamburger menu mobile uses. "Sticky Web" is now called "Memory Web" in the quick-actions dropdown. And server channel messages now update people\'s avatars in real time, just like DMs and group chats already did.',
  },
  {
    id: 'p1921',
    title: 'Patch 1.9.21 — Spotify module privacy fix',
    date: '2026-06-29',
    type: 'FIX',
    description: 'The Spotify Now Playing widget on profiles used to show YOUR current track on everyone else\'s profile. It now shows the profile owner\'s track, so visitors see what THAT person is listening to. Connect and disconnect controls only appear on your own profile.',
  },
  {
    id: 'p192',
    title: 'Patch 1.9.2 — Bot Lab cleanup + mobile polish',
    date: '2026-06-28',
    type: 'UPDATE',
    description: 'A focused cleanup. Music Master and Game Master are retired — the Bot Laboratory now only ships the official bots that are fully working. "My Bots" is hidden until user-created bots are ready. Mobile polish lands across DMs, Friends, Servers, the Bot Lab, and the home dashboard — headers collapse cleanly on small screens, action rails tuck into dropdowns, and the Friends tab strip scrolls horizontally instead of wrapping. Flickery signals (typing banners, web alerts) are now smoothed.',
  },
  {
    id: 'p191',
    title: 'Patch 1.9.1 — Home + chat polish',
    date: '2026-06-27',
    type: 'FIX',
    description: 'A polish pass for the home page and chats. Activity Feed and Recent Servers on the home page now collapse with a chevron and remember your choice. Biomass fly-catches no longer spam whichever chat you\'re in — they log into your Spidr System DM instead. And message avatars in DMs and group chats now update everywhere the moment someone changes their profile picture.',
  },
  {
    id: 'p19m',
    title: 'Patch 1.9 — Spidr Mobile (Phase 1) is now live',
    date: '2026-06-20',
    type: 'UPDATE',
    description: 'Spidr is officially on iPhone and Android. Your friends, DMs, servers, and clips all come with you — log in once, everything stays in sync with the web app. THE WEB feed swipes vertically like TikTok, comments slide up from the bottom, and likes and follows count toward your personalized feed across web and mobile. Voice channels and the upload studio are coming in Phase 2.',
  },
  {
    id: 'p185',
    title: 'Patch 1.8.5 is now live',
    date: '2026-06-16',
    type: 'UPDATE',
    description: 'Three changes this patch. Friend avatars are now live everywhere — when a friend changes their profile picture, you see it instantly across the Friends panel, Spidr Web, and pending requests. Spotify presence is faster and lighter on traffic. And there\'s a brand-new 404 page — a hand-drawn cave-and-web scene with the Spidr mascot lost in the middle of the web.',
  },
  {
    id: 'p184',
    title: 'Patch 1.8.4 — DJ Booth in voice channels',
    date: '2026-06-16',
    type: 'UPDATE',
    description: 'DJ Booth is live in voice channels. Hit the green Music icon in the call dock, search Spotify, and the whole room sees synchronized DJ visuals — spinning album art, pulse rings, and a bouncing audience. Each listener still plays the host\'s track on their own Spotify. Also: Spotify search actually returns results now, expanding a minimized call routes you home properly, and the Mutuals tab is hidden on your own profile.',
  },
  {
    id: 'p183',
    title: 'Patch 1.8.3 — Weather widget privacy fix',
    date: '2026-06-15',
    type: 'FIX',
    description: 'The Weather widget used to show YOUR weather on every profile. Now each user has their own saved location, and viewing a profile shows THEIR weather. The city and region are hidden from the display so the profile owner\'s exact location stays private.',
  },
  {
    id: 'p182',
    title: 'Patch 1.8.2 is now live',
    date: '2026-06-15',
    type: 'UPDATE',
    description: 'A big features patch. Voice channels get Theater Mode when someone shares their screen, and minimized calls now show a live preview of what\'s happening. Repost lands on THE WEB — share any clip to your feed. Profile Anthem lets you set a song that auto-plays (muted) when someone views your profile. Plus: a nameplate cropper, shareable server invite cards, clickable links in chat, a Join by Invite Code tab on the Create Server dialog, comment replies in the notification center, and Spotify Now Playing in your browser (closed beta — ping Chris for access).',
  },
  {
    id: 'p181',
    title: 'Patch 1.8.1 is now live',
    date: '2026-06-12',
    type: 'FIX',
    description: 'Welcome Bot now greets every new member, not just the ones who joined via invite link. Browse-and-Join users get the greeting too.',
  },
  {
    id: 'p18web',
    title: 'Patch 1.8 — The Web Fixes',
    date: '2026-06-12',
    type: 'FIX',
    description: 'Slash commands got a serious upgrade. The autocomplete popup is now grouped by bot with avatars and colors, hides admin-only commands from non-admins, and shows up to 30 results with arrow-key navigation. New Auto Moderator commands: /modhelp, /modreset, /modtest, /modset unban all. New Welcome Bot commands: /welcomehelp, /welcomeconfig, /welcomedelete. Admins can now delete bot and system messages in their server. Plus a fix for the Copy Channel ID toast that flashed before the copy actually finished.',
  },
  {
    id: 'p18',
    title: 'Patch 1.8 is now live',
    date: '2026-06-10',
    type: 'UPDATE',
    description: 'All four official bots are now fully working. Auto Moderator scans every message for spam and banned words — configure thresholds and word lists in the Bot Laboratory. Welcome Bot greets new members in your server\'s first text channel with a template you control. Game Master runs trivia: /trivia posts a question with four options, first correct answer wins. Music Master\'s /play now shows the actual song title, and /skip and /stop clear cleanly.',
  },
  {
    id: 'p172',
    title: 'Patch 1.7.2 is now live',
    date: '2026-06-09',
    type: 'FIX',
    description: 'A polish pass on THE WEB. "Cocoons" is now called "Saved" everywhere — feed, profile tabs, and collections. The volume slider no longer disappears when you reach for it. GIF and image panels in comments close automatically when you scroll to a new video. And clicking a saved clip jumps you straight to it in the feed.',
  },
  {
    id: 'p171',
    title: 'Patch 1.7.1 is now live',
    date: '2026-06-08',
    type: 'FIX',
    description: 'Adding a friend you\'ve already added now shows "You already added this user!" instead of a confusing error. And SPIDR_SYS got caught up — patches 1.6.2, 1.7, and the deploy fix are all in the feed now.',
  },
  {
    id: 'p17',
    title: 'Patch 1.7 is now live',
    date: '2026-06-03',
    type: 'UPDATE',
    description: 'Module Nexus got a big overhaul. Gaming Uplink now detects games from every launcher — League of Legends, VALORANT, TFT, Steam, Epic, Battle.net, Game Pass, and more — with auto-extracted icons. Background apps (Medal, Discord, Spotify, OBS) no longer get mistaken for games. Spotify Now Playing is live in the desktop app: connect Spotify in Settings and your current track shows on your profile. New "Don\'t see your game?" form lets you flag missing detection. Plus desktop app polish: Spidr icon, drag the window from the top, resize, and the APEX upgrade dialog actually shows up now.',
  },
  {
    id: 'p162',
    title: 'Patch 1.6.2 is now live',
    date: '2026-06-02',
    type: 'UPDATE',
    description: 'A behind-the-scenes rebuild of the app\'s shell — same look, but the mobile menu is cleaner and pages load faster. A few legacy pages were retired to make room for the newer home dashboard and integrated profile flows.',
  },
  {
    id: 'p162b',
    title: 'Deploy pipeline fixed',
    date: '2026-06-02',
    type: 'FIX',
    description: 'Fixed the production deploy pipeline — releases to the web app no longer time out, so updates land reliably again.',
  },
  {
    id: 'p161',
    title: 'Patch 1.6.1 is now live',
    date: '2026-05-31',
    type: 'FIX',
    description: 'A polish pass on Patch 1.6. Voice channels now drop a vertical "web thread" to glowing crimson avatar nodes. The expanded call deck got a cleaner glass look, and screen share splits into a proper Main Stage with a collapsible sidebar of audio-reactive user pills. Minimized calls became a tiny "Micro-Tactical HUD" pill that fades when idle. New: a transparent "Spidr Protocol" overlay (desktop) lets you chat over a game without leaving it. Fixes: group chats no longer render blank, voice calls no longer show duplicate users, the message feed is cleaner, and the profile widget stopped overlapping content.',
  },
  {
    id: 'p16',
    title: 'Patch 1.6 is now live',
    date: '2026-05-31',
    type: 'UPDATE',
    description: 'The biggest visual and functionality pass yet. THE WEB feed: trending posts physically pulse, The Weaver upload studio gets signature filters, a precision dual-handle video scrubber, and external audio from YouTube / Spotify / Apple Music. New: tap-to-expand image lightbox in chat, rich GIF and image comments, and long-press menus on mobile. The channel sidebar, server chat, and Bot Laboratory all got reskinned in the crimson palette. Custom backgrounds now flow across the whole app. Plus a bunch of fixes: minimized calls work reliably, server permissions are correct, mute and deafen are properly distinct, "Pin to Web" confirms, tapping a Memory Web message jumps to it, voice channels show their members, and mobile is fully responsive.',
  },
  {
    id: 'p15',
    title: 'Patch 1.5 is now live',
    date: '2026-05-29',
    type: 'UPDATE',
    description: 'APEX Symbiote suite lands: Profile Takeover overlay, Stream HUD with live telemetry, Frame Vault, Nexus Grid sidebar, and custom Nameplates & Badges. Plus fixes: minimized calls use the new Web Node design everywhere, minimizing no longer disconnects you, the sidebar logo box is gone, APEX activation is fixed, and trending servers no longer 404.',
  },
  {
    id: 'p14',
    title: 'Patch 1.4 is now live',
    date: '2026-05-24',
    type: 'UPDATE',
    description: 'APEX gets hanging threads and mini voice visualizers. Calls auto-minimize when you navigate, the desktop app supports picture-in-picture, and you can now "Pin to Spidr Web" across Friends, DMs, and Groups.',
  },
  {
    id: 'voicefix',
    title: 'Voice messages fixed everywhere',
    date: '2026-05-24',
    type: 'FIX',
    description: 'Voice messages now send everywhere — DMs, group chats, and server channels. Fixed the upload error that was blocking them.',
  },
  {
    id: 'webnode',
    title: 'Suspended Web Node',
    date: '2026-05-23',
    type: 'UPDATE',
    description: 'Minimized calls now appear as a draggable "web node" — a glowing radial pill with an active-speaker waveform and your APEX-colored thread.',
  },
  {
    id: 'unicall',
    title: 'Universal calling',
    date: '2026-05-23',
    type: 'UPDATE',
    description: 'DM and group calls now use the exact same voice deck and screen share as server channels — one unified call experience.',
  },
  {
    id: 'trending',
    title: 'Trending server join flow',
    date: '2026-05-22',
    type: 'FIX',
    description: 'Opening a server from Trending no longer 404s. Non-members now see a proper Join / Request Invite screen.',
  },
];

router.get('/news', (_req, res) => {
  res.json(NEWS);
});

module.exports = router;
