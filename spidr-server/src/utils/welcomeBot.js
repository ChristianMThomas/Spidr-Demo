'use strict';

const Message = require('../models/Message');

// Fires the Welcome Bot greeting for a single new member.
// Callable from any route that adds a member to server.members (invite-code
// join, public PATCH join, future flows). Errors are logged but never
// thrown — a welcome failure must not block the join itself.
async function fireWelcome(server, member, io) {
  try {
    if (!server || !member?.user_id) return;
    const hasWelcome = (server.bots || []).some(b => b.bot_code === 'builtin:welcome-bot');
    if (!hasWelcome) return;

    const cfg = server.bot_config?.welcome || {};
    const welcomeChannelId = cfg.channel_id ||
      (server.channels || []).find(c => c.type === 'text')?.id;
    if (!welcomeChannelId) {
      console.warn('[welcomeBot] no welcome channel resolved for server', server._id?.toString() || server.id);
      return;
    }

    const template = cfg.message || server.bot_config?.welcome_message ||
      `Welcome to ${server.name}, {user}! 🕷️`;
    const text = template
      .replace(/\{user\}/g, member.user_name || 'User')
      .replace(/\{server\}/g, server.name || 'this server');

    const serverId = server._id?.toString() || server.id?.toString();
    const wMsg = await Message.create({
      server_id: serverId,
      channel_id: welcomeChannelId,
      user_id: 'spidr-ai',
      author_id: 'spidr-ai',
      user_name: 'Welcome Bot',
      author_name: 'Welcome Bot',
      content: `[SPIDR_AI] 👋 ${text}`,
    });
    const { _id: wid, __v: _wv, ...wOut } = wMsg.toObject();
    io?.to(`channel:${serverId}:${welcomeChannelId}`)
      .emit('message:new', { id: wid.toString(), ...wOut });
  } catch (err) {
    console.warn('[welcomeBot] fire failed:', err?.message);
  }
}

module.exports = { fireWelcome };
