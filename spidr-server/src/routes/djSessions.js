/**
 * DJ Session Routes — voice-channel "DJ booth" feature.
 *
 *   GET    /voice-channels/:channelId/dj-session   — current session or null
 *   POST   /voice-channels/:channelId/dj-session   — start a session (caller becomes host)
 *   PATCH  /voice-channels/:channelId/dj-session   — change the track (host only)
 *   DELETE /voice-channels/:channelId/dj-session   — end the session (host only)
 *
 * A DJ session is server state on a voice channel: { host_id, track_id, started_at }.
 * Listeners poll the host's now-playing via /spotify/now-playing/:userId — the host's
 * Spotify client is the source of truth for what is currently playing. This route only
 * tracks who is hosting and which track they kicked off the session with.
 *
 * Gates:
 *   • Auth required on every endpoint.
 *   • To start/change/end: caller must have an active VoiceSession in the same channel
 *     (i.e. they're actually in the call). Otherwise 403.
 *   • Only the host can PATCH or DELETE. Otherwise 403.
 *   • Only one session per channel. POST 409s if one is already active.
 *
 * Broadcast: every mutation emits `voice:dj-session-changed` over Socket.io with
 * `{ channel_id, session | null }`. Clients filter by their current channel_id.
 */

const express      = require('express');
const authMW       = require('../middleware/auth');
const DJSession    = require('../models/DJSession');
const VoiceSession = require('../models/VoiceSession');
const UserProfile  = require('../models/UserProfile');

const router = express.Router();

function normalise(doc) {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return { id: _id?.toString(), ...rest };
}

function emitChanged(req, channelId, session) {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('voice:dj-session-changed', {
    channel_id: channelId,
    session: session || null,
  });
}

// Caller must currently be in the voice channel (have an active VoiceSession).
async function callerInChannel(userId, channelId) {
  if (!userId || !channelId) return false;
  const exists = await VoiceSession.exists({ user_id: userId, channel_id: channelId });
  return !!exists;
}

// ── GET /voice-channels/:channelId/dj-session ────────────────────────────────
router.get('/:channelId/dj-session', authMW, async (req, res) => {
  try {
    const doc = await DJSession.findOne({ channel_id: req.params.channelId }).lean();
    res.json(normalise(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /voice-channels/:channelId/dj-session ───────────────────────────────
// Body: { track_id }
router.post('/:channelId/dj-session', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { track_id } = req.body || {};
    const userId = req.user?.id || req.user?.userId;

    if (!track_id) return res.status(400).json({ error: 'track_id required' });
    if (!await callerInChannel(userId, channelId)) {
      return res.status(403).json({ error: 'Join the voice channel before starting a DJ session' });
    }

    // Reject if a session is already active. Use the unique index to win
    // any race — first writer wins, second gets a duplicate-key error.
    const existing = await DJSession.findOne({ channel_id: channelId }).lean();
    if (existing) {
      return res.status(409).json({ error: 'A DJ session is already active in this channel', session: normalise(existing) });
    }

    const profile = await UserProfile.findOne({ user_id: userId }).lean();
    const doc = await DJSession.create({
      channel_id:       channelId,
      host_id:          userId,
      host_user_name:   profile?.full_name || profile?.username || 'Spider',
      host_user_avatar: profile?.avatar_url,
      track_id,
      started_at:       new Date(),
    });

    const session = normalise(doc.toObject());
    emitChanged(req, channelId, session);
    res.status(201).json(session);
  } catch (err) {
    // Duplicate key from the unique index — another caller raced us.
    if (err?.code === 11000) {
      const existing = await DJSession.findOne({ channel_id: req.params.channelId }).lean();
      return res.status(409).json({ error: 'A DJ session is already active in this channel', session: normalise(existing) });
    }
    res.status(400).json({ error: err.message });
  }
});

// ── PATCH /voice-channels/:channelId/dj-session ──────────────────────────────
// Body: { track_id } — change the track. Host only.
router.patch('/:channelId/dj-session', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { track_id } = req.body || {};
    const userId = req.user?.id || req.user?.userId;

    if (!track_id) return res.status(400).json({ error: 'track_id required' });

    const existing = await DJSession.findOne({ channel_id: channelId });
    if (!existing) return res.status(404).json({ error: 'No active DJ session' });
    if (existing.host_id !== userId) {
      return res.status(403).json({ error: 'Only the DJ host can change the track' });
    }

    existing.track_id  = track_id;
    existing.started_at = new Date();
    await existing.save();

    const session = normalise(existing.toObject());
    emitChanged(req, channelId, session);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /voice-channels/:channelId/dj-session ─────────────────────────────
// End the session. Host only.
router.delete('/:channelId/dj-session', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.id || req.user?.userId;

    const existing = await DJSession.findOne({ channel_id: channelId }).lean();
    if (!existing) return res.json({ success: true }); // already gone — idempotent
    if (existing.host_id !== userId) {
      return res.status(403).json({ error: 'Only the DJ host can end the session' });
    }

    await DJSession.deleteOne({ channel_id: channelId });
    emitChanged(req, channelId, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
