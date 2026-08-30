const express = require('express');
const authMW = require('../middleware/auth');
const ConversationSettings = require('../models/ConversationSettings');
const DirectMessage = require('../models/DirectMessage');
const UserProfile = require('../models/UserProfile');
const User = require('../models/User');

/**
 * Shared per-conversation settings for DMs.
 *
 *   GET  /conversation-settings/:conversationId
 *   PUT  /conversation-settings/:conversationId   { background_url }
 *
 * The PUT does three things in one request, which is what makes the change
 * actually appear for the other person:
 *   1. persists the value on the conversation (not on one user's profile),
 *   2. writes a system message into the thread so there's a record of it,
 *   3. broadcasts to the DM room so the other client repaints immediately
 *      instead of waiting for a refresh.
 */

const router = express.Router();

// Participation check — a conversation id is not a capability. Without this,
// anyone could read or overwrite any conversation's wallpaper by guessing an
// id, and could inject system messages into strangers' threads.
async function assertParticipant(conversationId, userId) {
  const sample = await DirectMessage.findOne({ conversation_id: conversationId })
    .select('sender_id receiver_id recipient_id').lean();
  // A brand-new conversation with no messages yet has nobody to verify
  // against; allow it rather than blocking the first background change.
  if (!sample) return true;
  const parties = [sample.sender_id, sample.receiver_id, sample.recipient_id]
    .filter(Boolean).map(String);
  return parties.includes(String(userId));
}

async function displayNameOf(uid) {
  try {
    const [p, u] = await Promise.all([
      UserProfile.findOne({ user_id: uid }).select('display_name').lean(),
      User.findById(uid).select('full_name username').lean(),
    ]);
    return p?.display_name || u?.full_name || u?.username || 'Someone';
  } catch { return 'Someone'; }
}

router.get('/:conversationId', authMW, async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!(await assertParticipant(conversationId, req.user?.id))) {
      return res.status(403).json({ error: 'Not your conversation' });
    }
    const doc = await ConversationSettings.findOne({ conversation_id: conversationId }).lean();
    res.json(doc || { conversation_id: conversationId, background_url: '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:conversationId', authMW, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;
    if (!(await assertParticipant(conversationId, userId))) {
      return res.status(403).json({ error: 'Not your conversation' });
    }

    const background_url = typeof req.body?.background_url === 'string'
      ? req.body.background_url : '';
    const name = await displayNameOf(userId);

    const doc = await ConversationSettings.findOneAndUpdate(
      { conversation_id: conversationId },
      { $set: { background_url, updated_by: userId, updated_by_name: name } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    // Resolve the other participant so the system row addresses them properly.
    const sample = await DirectMessage.findOne({ conversation_id: conversationId })
      .select('sender_id receiver_id recipient_id').lean();
    const parties = [sample?.sender_id, sample?.receiver_id, sample?.recipient_id]
      .filter(Boolean).map(String);
    const other = parties.find(p => p !== String(userId)) || '';

    // System row — a real message so the change survives a reload and both
    // sides see it in history, not just as a transient toast.
    const sysDoc = await DirectMessage.create({
      conversation_id: conversationId,
      sender_id: userId,
      sender_name: name,
      receiver_id: other,
      recipient_id: other,
      content: background_url
        ? `${name} set the background image`
        : `${name} removed the background image`,
      is_system_event: true,
      event_type: 'BACKGROUND_UPDATE',
      media_urls: background_url ? [background_url] : [],
      is_read: false,
    });
    const { _id, __v, ...sys } = sysDoc.toObject();
    const systemMessage = { id: _id.toString(), ...sys };

    // Broadcast to the room so the other client repaints without a refresh.
    const io = req.app.get('io');
    if (io) {
      io.to(`dm:${conversationId}`).emit('dm:background-changed', {
        conversation_id: conversationId,
        background_url,
        updated_by: userId,
        updated_by_name: name,
      });
      io.to(`dm:${conversationId}`).emit('dm:new', systemMessage);
    }

    res.json({ ok: true, settings: doc, systemMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
