import { entities, integrations } from '@/api/apiClient';

// Display metadata for built-in bots, keyed by bot_code.
// Used by the slash-command autocomplete to render the bot avatar and name
// next to each command (Discord-style). icon_emoji is a fallback when the
// installed bot record doesn't carry one.
export const BOT_META = {
  'builtin:spidr-ai':       { name: 'Spidr AI',       icon_emoji: '🕷️', color: '#FF3333' },
  'builtin:game-master':    { name: 'Game Master',    icon_emoji: '🎲', color: '#a855f7' },
  'builtin:music-master':   { name: 'Music Master',   icon_emoji: '🎵', color: '#ec4899' },
  'builtin:data-analyst':   { name: 'Data Analyst',   icon_emoji: '📊', color: '#3b82f6' },
  'builtin:auto-moderator': { name: 'Auto Moderator', icon_emoji: '🛡️', color: '#10b981' },
  'builtin:welcome-bot':    { name: 'Welcome Bot',    icon_emoji: '👋', color: '#f59e0b' },
};

export const PLATFORM_META = { name: 'Spidr', icon_emoji: '🕸️', color: '#FF3333' };

// Bots that ship with every server — admins don't install them from the Bot
// Laboratory and they can't be uninstalled. Used by ServersPanel to treat
// these as "installed" in both the slash-command autocomplete and the
// installation gate, so a brand-new server still has /ask, /roast, /8ball,
// etc. working out of the box.
export const ALWAYS_AVAILABLE_BOTS = new Set(['builtin:spidr-ai']);

// All slash commands available across all bots.
//   bot:        bot_code the command belongs to (null = platform-level, always shown).
//   permission: 'everyone' | 'admin' — admin includes server owner + admin/mod roles.
export const COMMAND_REGISTRY = [
  { trigger: '/help',       description: 'Show all bot commands',           bot: null,                       permission: 'everyone' },
  { trigger: '/ask',        description: 'Ask Spidr AI anything',           bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/roast',      description: 'Roast someone with AI',           bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/8ball',      description: 'Magic 8-ball answer',             bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/roll',       description: 'Roll a die (default d6)',         bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/coinflip',   description: 'Flip a coin',                     bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/hack',       description: 'Fake hack sequence',              bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/vibe',       description: 'Vibe check',                      bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/fact',       description: 'Random spider fact',              bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/summarize',  description: 'Summarize recent messages',       bot: 'builtin:spidr-ai',         permission: 'everyone' },
  { trigger: '/trivia',     description: 'Start a trivia round',            bot: 'builtin:game-master',      permission: 'everyone' },
  { trigger: '/poll',       description: 'Create a poll  /poll Q | A | B', bot: 'builtin:game-master',      permission: 'everyone' },
  { trigger: '/play',       description: 'Stream YouTube/Twitch in voice',  bot: 'builtin:music-master',     permission: 'everyone' },
  { trigger: '/queue',      description: 'Show music queue',                bot: 'builtin:music-master',     permission: 'everyone' },
  { trigger: '/nowplaying', description: 'Show current track',              bot: 'builtin:music-master',     permission: 'everyone' },
  { trigger: '/skip',       description: 'Skip current track',              bot: 'builtin:music-master',     permission: 'everyone' },
  { trigger: '/stop',       description: 'Stop playback & clear queue',     bot: 'builtin:music-master',     permission: 'everyone' },
  { trigger: '/stats',      description: 'Server stats overview',           bot: 'builtin:data-analyst',     permission: 'everyone' },
  { trigger: '/top',        description: 'Top active members this week',    bot: 'builtin:data-analyst',     permission: 'everyone' },
  { trigger: '/modset',     description: 'Configure Auto Moderator',        bot: 'builtin:auto-moderator',   permission: 'admin' },
  { trigger: '/modlog',     description: 'Recent auto-mod actions',         bot: 'builtin:auto-moderator',   permission: 'admin' },
  { trigger: '/modhelp',    description: 'Show Auto Moderator usage guide', bot: 'builtin:auto-moderator',   permission: 'everyone' },
  { trigger: '/modreset',   description: 'Reset all Auto Moderator settings', bot: 'builtin:auto-moderator', permission: 'admin' },
  { trigger: '/modtest',    description: 'Test text against Auto Moderator', bot: 'builtin:auto-moderator',  permission: 'admin' },
  { trigger: '/welcomeset',    description: 'Set the welcome message',              bot: 'builtin:welcome-bot', permission: 'admin'    },
  { trigger: '/welcomehelp',   description: 'Show Welcome Bot usage guide',          bot: 'builtin:welcome-bot', permission: 'everyone' },
  { trigger: '/welcomeconfig', description: 'Show current welcome configuration',    bot: 'builtin:welcome-bot', permission: 'admin'    },
  { trigger: '/welcomedelete', description: 'Delete the welcome message',            bot: 'builtin:welcome-bot', permission: 'admin'    },
];

// Resolve a raw input string like "/modset ban foo" to its COMMAND_REGISTRY
// entry. Returns null when the first token isn't a recognized command.
// Used by ServersPanel to gate execution on bot-installation and permission
// — without this the slash-command handler would run any registered command
// even in servers where the owning bot was never installed.
export function getCommandMeta(text) {
  if (!text || typeof text !== 'string' || !text.startsWith('/')) return null;
  const first = text.slice(1).split(/\s+/)[0]?.toLowerCase();
  if (!first) return null;
  return COMMAND_REGISTRY.find(c => c.trigger.slice(1).toLowerCase() === first) || null;
}

const ROASTS = [
  "Scanning profile... Error 404: Personality not found. Try upgrading your firmware.",
  "Your profile picture looks like it was generated by an AI that gave up halfway.",
  "I've seen better chat game from a captcha.",
  "You type slower than I think, and I have to pretend to think.",
  "Your server contributions are like dark matter — theoretically there, but nobody can prove it.",
  "I'd roast you harder but I'm worried you'd take it as a compliment.",
];

const EIGHT_BALL = [
  "The web says yes.",
  "My silk threads say no.",
  "Absolutely. I'd stake 8 legs on it.",
  "Not a chance. Even my webs aren't that sticky.",
  "Ask again when Mercury isn't in retrograde.",
  "Signs point to maybe. I'm a spider, not a fortune teller.",
  "The vibrations in my web suggest... yes.",
  "I wouldn't bet my exoskeleton on it.",
  "100%. The spider sense is tingling.",
  "Outlook unclear. Too many flies buzzing around.",
];

const FACTS = [
  "Spiders can survive in space for short periods.",
  "The world's largest spider web was found in Madagascar, spanning 82 feet.",
  "Some spiders can walk on water.",
  "Jumping spiders can see colors humans can't.",
  "Spider silk is stronger than steel by weight.",
  "There's a spider that builds a decoy of itself in its web.",
  "Spiders have been on Earth for over 380 million years.",
];

async function fetchYouTubeTitle(url) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!r.ok) return url;
    const j = await r.json();
    return j.title || url;
  } catch {
    return url;
  }
}

async function getQueue(serverId) {
  try {
    const srv = await entities.Server.get(serverId);
    return { srv, queue: Array.isArray(srv.bot_config?.music_queue) ? srv.bot_config.music_queue : [] };
  } catch {
    return { srv: null, queue: [] };
  }
}

async function saveQueue(serverId, srv, queue) {
  await entities.Server.update(serverId, {
    bot_config: { ...(srv?.bot_config || {}), music_queue: queue },
  });
}

export async function processBotCommand(text, currentUser, serverId, channelId) {
  if (!text.startsWith('/')) return null;

  const parts = text.slice(1).split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (cmd) {
    case 'play':
    case 'stream':
    case 'watch': {
      if (!args) {
        return {
          response: "Usage: /play <YouTube or Twitch URL>\n\nExample:\n/play https://youtube.com/watch?v=dQw4w9WgXcQ\n/play https://twitch.tv/shroud",
        };
      }

      let streamType = 'video';
      if (args.includes('twitch.tv')) streamType = 'twitch';
      else if (args.includes('youtube.com') || args.includes('youtu.be')) streamType = 'youtube';
      else if (args.includes('spotify')) streamType = 'music';

      // Fetch title and add to queue
      const title = streamType === 'youtube' ? await fetchYouTubeTitle(args) : args;
      const { srv, queue } = await getQueue(serverId);
      const isFirst = queue.length === 0;
      const newTrack = { url: args, title, added_by: currentUser?.full_name || 'Someone', added_at: Date.now() };
      await saveQueue(serverId, srv, [...queue, newTrack]);

      const pos = queue.length + 1;
      const response = isFirst
        ? `🎵 Now playing: **${title}**\n\nAdded to queue by ${newTrack.added_by}. Join a voice channel to watch!`
        : `🎵 Added to queue (#${pos}): **${title}**\n\nRequested by ${newTrack.added_by}.`;

      return {
        response,
        ...(isFirst ? { streamUrl: args, streamType } : {}),
      };
    }

    case 'queue': {
      const { queue } = await getQueue(serverId);
      if (queue.length === 0) {
        return { response: '🎵 [Music Master] Queue is empty. Use /play <url> to add tracks.' };
      }
      const lines = queue.map((t, i) => `${i + 1}. **${t.title}** — added by ${t.added_by}`).join('\n');
      return { response: `🎵 **Music Queue** (${queue.length} track${queue.length !== 1 ? 's' : ''})\n\n${lines}` };
    }

    case 'skip': {
      const { srv, queue } = await getQueue(serverId);
      if (queue.length === 0) {
        return { response: '🎵 [Music Master] Nothing in the queue to skip.' };
      }
      const skipped = queue[0];
      const remaining = queue.slice(1);
      await saveQueue(serverId, srv, remaining);
      if (remaining.length > 0) {
        const next = remaining[0];
        return {
          response: `⏭️ Skipped **${skipped.title}**\n\nNow playing: **${next.title}**`,
          streamUrl: next.url,
          streamType: next.url.includes('twitch') ? 'twitch' : 'youtube',
        };
      }
      return {
        response: `⏭️ Skipped **${skipped.title}**. Queue is now empty.`,
        clearStream: true,
      };
    }

    case 'stop': {
      const { srv } = await getQueue(serverId);
      await saveQueue(serverId, srv, []);
      return {
        response: '⏹️ [Music Master] Playback stopped and queue cleared.',
        clearStream: true,
      };
    }

    case 'nowplaying': {
      const { queue } = await getQueue(serverId);
      if (queue.length === 0) {
        return { response: '🎵 Nothing is currently playing. Use /play <url> to start.' };
      }
      const t = queue[0];
      return {
        response: `🎵 **Now Playing**\n\n**${t.title}**\nRequested by ${t.added_by}${queue.length > 1 ? `\n\n_${queue.length - 1} track${queue.length - 1 !== 1 ? 's' : ''} in queue_` : ''}`,
      };
    }

    case 'roast': {
      const target = args || currentUser?.full_name || 'you';
      const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
      return {
        response: `🎯 Target acquired: ${target}\n\n${roast}`,
      };
    }

    case '8ball': {
      const answer = EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)];
      return {
        response: `🎱 Question: "${args || 'Will I be lucky?'}"\n\n${answer}`,
      };
    }

    case 'roll': {
      const max = parseInt(args) || 6;
      const result = Math.floor(Math.random() * max) + 1;
      const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const emoji = max === 6 ? (diceEmojis[result - 1] || '🎲') : '🎲';
      return {
        response: `${emoji} Rolling a d${max}...\n\n>>> ${result} <<<`,
      };
    }

    case 'hack': {
      const target = args || 'the mainframe';
      return {
        response: `🕷️ INITIATING HACK SEQUENCE ON: ${target}\n\n[████████░░░░] 67% — Bypassing firewall...\n[██████████░░] 83% — Extracting data...\n[████████████] 100% — COMPLETE\n\nResults: Found 847 cat photos and a half-finished novel. Target is embarrassingly human.`,
      };
    }

    case 'vibe': {
      const vibes = ['🌊 Ocean chill', '🔥 Fire mode', '🌙 Night owl', '⚡ Hyperdrive', '🕷️ Web crawler', '🎮 Gamer rage'];
      const vibe = vibes[Math.floor(Math.random() * vibes.length)];
      return {
        response: `Current vibe check: ${vibe}\n\nVibes are immaculate. No further analysis needed.`,
      };
    }

    case 'fact': {
      const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
      return {
        response: `🕷️ Spider Fact:\n\n${fact}`,
      };
    }

    case 'ask': {
      if (!args) {
        return { response: "Usage: /ask <your question>\n\nI'll use my neural web to find an answer." };
      }
      const llmResult = await integrations.Core.InvokeLLM({
        prompt: `You are Spidr AI, a witty, edgy AI bot inside a social platform called Spidr. You speak in a cool, slightly glitchy, tech-noir style. Keep responses under 200 characters. Be helpful but with personality. The user asks: "${args}"`,
        response_json_schema: {
          type: 'object',
          properties: { answer: { type: 'string' } },
        },
      });
      return {
        response: llmResult.answer || "My neural web is tangled. Try again.",
      };
    }

    case 'help': {
      return {
        response: `🕷️ SPIDR BOT COMMAND PROTOCOL\n\n` +
          `── Spidr AI ──\n` +
          `/play <url> — Stream YouTube/Twitch in voice\n` +
          `/roast <name> — Get roasted by AI\n` +
          `/8ball <question> — Magic 8-ball\n` +
          `/roll <sides> — Roll dice (default: 6)\n` +
          `/coinflip — Flip a coin\n` +
          `/hack <target> — Fake hack sequence\n` +
          `/vibe — Vibe check\n` +
          `/fact — Random spider fact\n` +
          `/ask <question> — Ask Spidr AI anything\n\n` +
          `── Game Master ──\n` +
          `/trivia — Start interactive trivia (30s timer)\n` +
          `/poll <question> | opt1 | opt2 — Create a poll\n\n` +
          `── Music Master ──\n` +
          `/play <url> — Add track & start playing\n` +
          `/queue — Show current queue\n` +
          `/nowplaying — Show current track\n` +
          `/skip — Skip to next track\n` +
          `/stop — Clear queue & stop\n\n` +
          `── Data Analyst ──\n` +
          `/stats — Server stats overview\n` +
          `/top — Top active members this week\n\n` +
          `── Auto Moderator ──\n` +
          `/modhelp — Full Auto Moderator guide\n` +
          `/modset [status|ban|unban|spam|slur] — Configure (admin)\n` +
          `/modtest <text> — Dry-run a message against the filters (admin)\n` +
          `/modlog — Recent auto-actions\n` +
          `/modreset — Wipe all automod settings (admin)\n\n` +
          `── Welcome Bot ──\n` +
          `/welcomehelp — Show Welcome Bot usage guide\n` +
          `/welcomeset [--channel <id>] <message> — Set the welcome message\n` +
          `/welcomeconfig — Show current welcome config (admin)\n` +
          `/welcomedelete — Delete the welcome message (admin)`,
      };
    }

    case 'coinflip':
    case 'flip': {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      return {
        response: `🪙 Flipping a coin...\n\n>>> **${result}** <<<`,
      };
    }

    case 'trivia': {
      const llmResult = await integrations.Core.InvokeLLM({
        prompt: `Generate one interesting trivia question with 4 multiple-choice options (A, B, C, D), one correct answer letter (just the letter, e.g. "B"), and a fun fact. Make it medium difficulty, all-ages appropriate.`,
        response_json_schema: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            answer: { type: 'string' },
            fact: { type: 'string' },
          },
        },
      });
      if (!llmResult?.question || !Array.isArray(llmResult?.options)) {
        return { response: '🎲 Trivia is offline — try again in a moment.' };
      }
      const opts = llmResult.options.slice(0, 4).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n');
      const answerLetter = llmResult.answer?.charAt(0).toUpperCase() || 'A';
      return {
        response: `🎲 **TRIVIA TIME**\n\n${llmResult.question}\n\n${opts}\n\n_Reply with the letter (A/B/C/D). Answer reveals in 30s._`,
        gameEvent: { type: 'trivia', answer: answerLetter, fact: llmResult.fact || '' },
      };
    }

    case 'poll': {
      if (!args.includes('|')) {
        return { response: '📊 Usage: /poll <question> | option1 | option2 [| option3 | option4]' };
      }
      const [question, ...opts] = args.split('|').map(s => s.trim()).filter(Boolean);
      if (opts.length < 2) {
        return { response: '📊 A poll needs at least 2 options. Use: /poll Question | Yes | No' };
      }
      const options = opts.slice(0, 4);
      const lines = options.map((o, i) => `${i + 1}️⃣ ${o}`).join('\n');
      return {
        response: `📊 **POLL: ${question}**\n\n${lines}\n\n_Vote by typing the number (1–${options.length})._`,
        gameEvent: { type: 'poll', question, options },
      };
    }

    case 'stats': {
      try {
        const messages = await entities.Message.filter({ server_id: serverId });
        const total = messages.length || 0;
        const today = messages.filter(m => {
          const d = new Date(m.created_date);
          return (Date.now() - d.getTime()) < 86400000;
        }).length;
        const uniqueAuthors = new Set(messages.map(m => m.author_id || m.user_id)).size;
        return {
          response: `📊 **Server Stats**\n\n• Total messages: **${total.toLocaleString()}**\n• Messages today: **${today}**\n• Unique posters: **${uniqueAuthors}**\n\n_Powered by Data Analyst bot._`,
        };
      } catch {
        return { response: '📊 Data Analyst could not fetch stats right now.' };
      }
    }

    case 'top': {
      try {
        const messages = await entities.Message.filter({ server_id: serverId });
        const weekAgo = Date.now() - 7 * 86400000;
        const counts = {};
        for (const m of messages) {
          if (new Date(m.created_date).getTime() < weekAgo) continue;
          const name = m.author_name || m.user_name || 'Unknown';
          counts[name] = (counts[name] || 0) + 1;
        }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (top.length === 0) return { response: '📈 No activity in the past week.' };
        const lines = top.map(([name, n], i) => `${i + 1}. **${name}** — ${n} message${n === 1 ? '' : 's'}`).join('\n');
        return { response: `📈 **Top Active This Week**\n\n${lines}` };
      } catch {
        return { response: '📈 Data Analyst could not fetch leaderboard right now.' };
      }
    }

    case 'modlog': {
      try {
        const logs = await entities.ServerAuditLog.filter({ server_id: serverId, category: 'mod' });
        const recent = logs.slice(0, 5);
        if (recent.length === 0) return { response: '🛡️ No moderation actions logged recently.' };
        const lines = recent.map(l => `• ${l.action} — ${l.target_name || l.details || 'no target'}`).join('\n');
        return { response: `🛡️ **Recent Mod Actions**\n\n${lines}` };
      } catch {
        return { response: '🛡️ Auto Moderator log unavailable.' };
      }
    }

    case 'welcomeset': {
      // Parse optional --channel flag: /welcomeset --channel <id> <message>
      let channelId = null;
      let msgText = args;
      const chMatch = args.match(/^--channel\s+(\S+)\s*(.*)/s);
      if (chMatch) { channelId = chMatch[1]; msgText = chMatch[2].trim(); }
      if (!msgText) {
        return { response: '👋 Usage: /welcomeset [--channel <channelId>] <message>\n\nUse `{user}` and `{server}` as placeholders.\n\nExample: `/welcomeset Welcome {user} to {server}! 🕷️`' };
      }
      try {
        const srv = await entities.Server.get(serverId);
        const welCfg = { ...(srv.bot_config?.welcome || {}), message: msgText };
        if (channelId) welCfg.channel_id = channelId;
        await entities.Server.update(serverId, {
          bot_config: { ...(srv.bot_config || {}), welcome: welCfg },
        });
        const preview = msgText
          .replace(/\{user\}/g, currentUser?.full_name || 'NewUser')
          .replace(/\{server\}/g, srv.name || 'Server');
        return { response: `👋 Welcome message saved!\n\nPreview:\n> ${preview}` };
      } catch (err) {
        return { response: '👋 Could not save welcome message: ' + (err?.message || 'unknown') };
      }
    }

    case 'modset': {
      const sub  = parts[1]?.toLowerCase();
      const rest = parts.slice(2).join(' ').trim();
      try {
        const srv = await entities.Server.get(serverId);
        const cfg = srv.bot_config?.automod || {};
        const save = async (patch) => {
          await entities.Server.update(serverId, {
            bot_config: { ...(srv.bot_config || {}), automod: { ...cfg, ...patch } },
          });
        };

        if (!sub || sub === 'status') {
          const banned = (cfg.banned_words || []);
          return {
            response:
              `🛡️ **Auto Moderator — Config**\n\n` +
              `• Slur filter: **${cfg.slurFilter !== false ? 'ON' : 'OFF'}**\n` +
              `• Spam: **${cfg.spamThreshold ?? 5}** msgs / **${cfg.spamWindowSecs ?? 10}**s\n` +
              `• Banned words (${banned.length}): ${banned.length ? banned.map(w => `\`${w}\``).join(', ') : '_none_'}\n\n` +
              `_/modset ban <word> · /modset unban <word> · /modset spam <n> · /modset slur on|off_`,
          };
        }
        if (sub === 'ban') {
          if (!rest) return { response: '🛡️ Usage: `/modset ban <word>`' };
          const word = rest.toLowerCase();
          const list = Array.isArray(cfg.banned_words) ? cfg.banned_words : [];
          if (list.includes(word)) return { response: `🛡️ \`${word}\` is already banned.` };
          await save({ banned_words: [...list, word] });
          return { response: `🛡️ \`${word}\` added to banned words.` };
        }
        if (sub === 'unban') {
          if (!rest) return { response: '🛡️ Usage: `/modset unban <word>` · `/modset unban all` to clear them all' };
          const list = Array.isArray(cfg.banned_words) ? cfg.banned_words : [];
          if (rest.toLowerCase() === 'all') {
            if (list.length === 0) return { response: '🛡️ No banned words to clear.' };
            await save({ banned_words: [] });
            return { response: `🛡️ Cleared **${list.length}** banned word${list.length === 1 ? '' : 's'}.` };
          }
          const word = rest.toLowerCase();
          await save({ banned_words: list.filter(w => w !== word) });
          return { response: `🛡️ \`${word}\` removed from banned words.` };
        }
        if (sub === 'spam') {
          const n = parseInt(rest);
          if (isNaN(n) || n < 2) return { response: '🛡️ Usage: `/modset spam <number>` (min 2)' };
          await save({ spamThreshold: n });
          return { response: `🛡️ Spam threshold set to **${n}** messages.` };
        }
        if (sub === 'slur') {
          if (rest !== 'on' && rest !== 'off') return { response: '🛡️ Usage: `/modset slur on|off`' };
          await save({ slurFilter: rest === 'on' });
          return { response: `🛡️ Slur filter turned **${rest.toUpperCase()}**.` };
        }
        return {
          response: `🛡️ Unknown sub-command \`${sub}\`.\n\nUsage:\n\`/modset status\` · \`/modset ban <word>\` · \`/modset unban <word|all>\` · \`/modset spam <n>\` · \`/modset slur on|off\``,
        };
      } catch (err) {
        return { response: `🛡️ Error: ${err?.message || 'Could not update settings.'}` };
      }
    }

    case 'modhelp': {
      return {
        response:
          `🛡️ **AUTO MODERATOR — Command Guide**\n\n` +
          `Auto Moderator watches every message and silently blocks spam and banned words.\n\n` +
          `── View & Test ──\n\n` +
          `\`/modset\` or \`/modset status\` — show current config\n` +
          `\`/modtest <text>\` — preview which rules a message would trigger (admin)\n` +
          `\`/modlog\` — recent auto-mod actions\n\n` +
          `── Configure ──\n\n` +
          `\`/modset ban <word>\` — add a word to the banned list\n` +
          `\`/modset unban <word>\` — remove a single word\n` +
          `\`/modset unban all\` — clear every banned word\n` +
          `\`/modset spam <n>\` — trip after N messages in 10s (default 5, min 2)\n` +
          `\`/modset slur on|off\` — toggle the built-in slur filter\n\n` +
          `── Reset ──\n\n` +
          `\`/modreset\` — wipe ALL automod settings and start fresh (admin)\n\n` +
          `── Tips ──\n` +
          `• The built-in slur filter catches common slurs even if you haven't banned them.\n` +
          `• Banned words match whole words only (case-insensitive), not substrings.\n` +
          `• Spam is tracked per-user across the whole server.\n` +
          `• Anyone can run \`/modhelp\` to see this guide; the rest are admin-only.`,
      };
    }

    case 'modreset': {
      try {
        const srv = await entities.Server.get(serverId);
        const { automod: _removed, ...restConfig } = srv.bot_config || {};
        await entities.Server.update(serverId, { bot_config: restConfig });
        return {
          response:
            `🛡️ Auto Moderator config reset.\n\n` +
            `• Slur filter: **ON** (default)\n` +
            `• Spam: **5** msgs / **10**s (default)\n` +
            `• Banned words: _none_\n\n` +
            `_Use \`/modhelp\` to see how to configure again._`,
        };
      } catch (err) {
        return { response: `🛡️ Could not reset config: ${err?.message || 'unknown'}` };
      }
    }

    case 'modtest': {
      // Mirror the server-side check in spidr-server/src/utils/automod.js
      // so admins can dry-run a message against the live config without
      // actually sending it. Spam isn't tested here (it depends on message
      // history); only word filtering.
      if (!args) {
        return { response: '🛡️ Usage: `/modtest <text>` — checks the text against banned words + slur filter.' };
      }
      // Built-in slur list kept in sync with spidr-server/src/utils/automod.js
      const DEFAULT_BLOCKED = [
        'nigger', 'nigga', 'faggot', 'fag', 'kike', 'chink', 'spic', 'wetback',
        'tranny', 'retard', 'cunt', 'twat',
      ];
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const srv = await entities.Server.get(serverId);
        const cfg = srv.bot_config?.automod || {};
        const customBanned = Array.isArray(cfg.banned_words) ? cfg.banned_words : [];
        const allowedSet = new Set(
          (Array.isArray(cfg.allowed_words) ? cfg.allowed_words : []).map(w => w.toLowerCase())
        );
        const slurOn = cfg.slurFilter !== false;
        const allBanned = slurOn ? [...DEFAULT_BLOCKED, ...customBanned] : [...customBanned];

        const hits = [];
        for (const word of allBanned) {
          if (allowedSet.has(word.toLowerCase())) continue;
          const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
          if (pattern.test(args)) {
            const source = DEFAULT_BLOCKED.includes(word) ? 'built-in slur filter' : 'custom banned list';
            hits.push(`• \`${word}\` (${source})`);
          }
        }
        if (hits.length === 0) {
          return {
            response:
              `🛡️ **Auto Mod Test — PASS** ✅\n\n` +
              `Input: "${args}"\n\n` +
              `This message would not be blocked by the current config.\n` +
              `_Slur filter: **${slurOn ? 'ON' : 'OFF'}** · custom banned words: **${customBanned.length}**_`,
          };
        }
        return {
          response:
            `🛡️ **Auto Mod Test — BLOCKED** 🚫\n\n` +
            `Input: "${args}"\n\n` +
            `Triggered rules:\n${hits.join('\n')}\n\n` +
            `_To allow a word from the slur filter, add it to \`bot_config.automod.allowed_words\` (not yet available via slash command)._`,
        };
      } catch (err) {
        return { response: `🛡️ Could not run test: ${err?.message || 'unknown'}` };
      }
    }

    case 'summarize': {
      try {
        const recent = (await entities.Message.filter({
          server_id: serverId,
          channel_id: channelId,
        })).slice(-(parseInt(args) || 20));
        if (recent.length === 0) return { response: '🧠 Nothing recent to summarize.' };
        const transcript = recent.map(m => `${m.author_name || m.user_name || 'User'}: ${m.content}`).join('\n');
        const result = await integrations.Core.InvokeLLM({
          prompt: `Summarize this Spidr chat in 3-4 short bullet points. Be neutral and concise.\n\n${transcript}`,
          response_json_schema: {
            type: 'object',
            properties: { summary: { type: 'string' } },
          },
        });
        return { response: `🧠 **Summary of last ${recent.length} messages**\n\n${result?.summary || 'No summary available.'}` };
      } catch {
        return { response: '🧠 Summarize is offline right now.' };
      }
    }

    case 'welcomehelp': {
      return {
        response:
          `👋 **WELCOME BOT — Command Guide**\n\n` +
          `Welcome Bot posts a greeting in a channel whenever someone new joins your server.\n\n` +
          `── Setup ──\n\n` +
          `/welcomeset <message>\n` +
          `  Set the welcome message. Goes live immediately for the next join.\n` +
          `  Placeholders: \`{user}\` → member's name  ·  \`{server}\` → server name\n\n` +
          `  Examples:\n` +
          `  \`/welcomeset Hey {user}, welcome to {server}! Check out #rules 🕷️\`\n` +
          `  \`/welcomeset --channel <channelId> <message>\` ← post in a specific channel\n\n` +
          `── Info & Maintenance ──\n\n` +
          `/welcomeconfig   — Show the currently saved message and target channel.\n` +
          `/welcomedelete   — Remove the message (disables auto-greeting until reset).\n\n` +
          `── Tips ──\n` +
          `• If no channel is set, the greeting posts in the first text channel.\n` +
          `• Only admins can run /welcomeset, /welcomeconfig, and /welcomedelete.\n` +
          `• Anyone can run /welcomehelp to share this guide.`,
      };
    }

    case 'welcomeconfig': {
      try {
        const srv = await entities.Server.get(serverId);
        const cfg = srv.bot_config?.welcome || {};
        const msgLine = cfg.message
          ? `\`${cfg.message}\``
          : `_not set — default: "Welcome to ${srv.name || 'Server'}, {user}! 🕷️"_`;
        const chLine = cfg.channel_id
          ? `channel ID \`${cfg.channel_id}\``
          : `_auto — first text channel_`;
        return {
          response:
            `👋 **Welcome Bot — Current Config**\n\n` +
            `• Message: ${msgLine}\n` +
            `• Channel: ${chLine}\n\n` +
            `_To change: \`/welcomeset <message>\`  ·  To remove: \`/welcomedelete\`_`,
        };
      } catch (err) {
        return { response: `👋 Could not fetch welcome config: ${err?.message || 'unknown'}` };
      }
    }

    case 'welcomedelete': {
      try {
        const srv = await entities.Server.get(serverId);
        const { welcome: _removed, ...restConfig } = srv.bot_config || {};
        await entities.Server.update(serverId, { bot_config: restConfig });
        return {
          response:
            `👋 Welcome message deleted. New members will no longer receive an automatic greeting.\n\n` +
            `_Run \`/welcomeset <message>\` any time to set a new one._`,
        };
      } catch (err) {
        return { response: `👋 Could not delete welcome message: ${err?.message || 'unknown'}` };
      }
    }

    default:
      return null;
  }
}
