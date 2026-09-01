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


// Pull the optional track metadata a client sends with start/next. Cached on
// the session so LISTENERS can actually play audio (the 30s preview) instead
// of just watching the host's now-playing.
// Server-side preview backfill for sessions started by clients that didn't
// send one (or where Spotify shipped none) — see routes/spotify.js itunesPreview.
// Loose string compare for match verification — strips punctuation, casing,
// and the parenthetical noise labels carry ("(Remastered 2011)", "- Live").
function normaliseTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(remaster(ed)?|live|radio edit|deluxe|explicit|version|feat\.?|ft\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function ensurePreview(meta) {
  if (meta.preview_url || !meta.track_name) return meta;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const term = encodeURIComponent(`${meta.track_artist || ''} ${meta.track_name}`.trim().slice(0, 120));
    // Ask for several candidates, not one. Taking results[0] blindly was the
    // source of the "card shows one song, speakers play another" bug: iTunes
    // routinely ranks a cover, a live cut, or a same-titled song by a
    // different artist first.
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=8`, { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      const d = await r.json().catch(() => null);
      const wantTitle  = normaliseTitle(meta.track_name);
      const wantArtist = normaliseTitle(meta.track_artist);
      // Only accept a candidate whose TITLE and ARTIST both corroborate the
      // track the DJ actually picked. If nothing corroborates, we ship no
      // preview at all — silence with correct metadata beats confidently
      // playing the wrong song.
      const match = (d?.results || []).find((c) => {
        if (!c?.previewUrl) return false;
        const ct = normaliseTitle(c.trackName);
        const ca = normaliseTitle(c.artistName);
        const titleOk  = ct === wantTitle || ct.includes(wantTitle) || wantTitle.includes(ct);
        const artistOk = !wantArtist || ca === wantArtist || ca.includes(wantArtist) || wantArtist.includes(ca);
        return titleOk && artistOk;
      });
      if (match) {
        meta.preview_url = match.previewUrl;
        // Flag that this audio is a substitute source, so the UI can be
        // honest about it rather than implying it's the Spotify master.
        meta.preview_source = 'itunes';
      }
    }
  } catch { /* leave as-is */ }
  return meta;
}

function trackMeta(body = {}) {
  return {
    track_name:    String(body.track_name    || '').slice(0, 200),
    track_artist:  String(body.track_artist  || '').slice(0, 200),
    album_art_url: String(body.album_art_url || '').slice(0, 500),
    preview_url:   String(body.preview_url   || '').slice(0, 500),
    preview_source: String(body.preview_source || '').slice(0, 20),
    ...(body.audio_route ? { audio_route: String(body.audio_route).slice(0, 20) } : {}),
    external_url:  String(body.external_url  || '').slice(0, 500),
    duration_ms:   Number(body.duration_ms)  || 0,
    source:        body.source === 'apple' ? 'apple' : 'spotify',
  };
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
      ...(await ensurePreview(trackMeta(req.body))),
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
    Object.assign(existing, await ensurePreview(trackMeta(req.body)));
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


// ── Collaborative queue ─────────────────────────────────────────────────────
// Anyone in the call can append a track; the DJ advances through it. This is
// what makes the booth a shared session rather than one person's radio show.

// POST /:channelId/dj-session/queue — append a track to the up-next list.
router.post('/:channelId/dj-session/queue', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.id;
    const { track_id } = req.body || {};
    if (!track_id) return res.status(400).json({ error: 'track_id required' });

    const session = await DJSession.findOne({ channel_id: channelId });
    if (!session) return res.status(404).json({ error: 'No active DJ session' });

    // Cap the queue so one person can't flood the booth.
    if ((session.queue || []).length >= 50) {
      return res.status(409).json({ error: 'Queue is full (50 tracks)' });
    }
    // Don't allow the same track twice in a row in the queue.
    if ((session.queue || []).some(q => q.track_id === track_id)) {
      return res.status(409).json({ error: 'That track is already queued' });
    }

    const profile = await UserProfile.findOne({ user_id: userId }).lean();
    const entry = {
      // A stable id so the client can key rows and target removals without
      // relying on array position, which shifts as tracks are consumed.
      qid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      track_id,
      ...(await ensurePreview(trackMeta(req.body))),
      added_by:      userId,
      added_by_name: profile?.full_name || profile?.username || 'Spider',
      added_at:      new Date(),
    };
    session.queue = [...(session.queue || []), entry];
    session.markModified('queue');
    await session.save();

    const out = normalise(session.toObject());
    emitChanged(req, channelId, out);
    res.status(201).json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /:channelId/dj-session/queue/:qid — pull a track.
// You may remove your own entry; the host may remove anyone's.
router.delete('/:channelId/dj-session/queue/:qid', authMW, async (req, res) => {
  try {
    const { channelId, qid } = req.params;
    const userId = req.user?.id;
    const session = await DJSession.findOne({ channel_id: channelId });
    if (!session) return res.status(404).json({ error: 'No active DJ session' });

    const entry = (session.queue || []).find(q => q.qid === qid);
    if (!entry) return res.status(404).json({ error: 'Not in queue' });
    if (String(entry.added_by) !== String(userId) && String(session.host_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the person who queued it or the DJ can remove it' });
    }

    session.queue = (session.queue || []).filter(q => q.qid !== qid);
    session.markModified('queue');
    await session.save();

    const out = normalise(session.toObject());
    emitChanged(req, channelId, out);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /:channelId/dj-session/advance — host pops the next queued track and
// makes it the now-playing. Kept server-side so the queue and the current
// track can never disagree.
router.post('/:channelId/dj-session/advance', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.id;
    const session = await DJSession.findOne({ channel_id: channelId });
    if (!session) return res.status(404).json({ error: 'No active DJ session' });
    if (String(session.host_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the DJ can advance the queue' });
    }
    const [next, ...rest] = session.queue || [];
    if (!next) return res.status(409).json({ error: 'Queue is empty' });

    session.track_id      = next.track_id;
    session.track_name    = next.track_name;
    session.track_artist  = next.track_artist;
    session.album_art_url = next.album_art_url;
    session.preview_url   = next.preview_url;
    session.preview_source= next.preview_source || '';
    session.external_url  = next.external_url;
    session.duration_ms   = next.duration_ms;
    session.source        = next.source || session.source;
    session.started_at    = new Date();
    session.queue         = rest;
    session.markModified('queue');
    await session.save();

    const out = normalise(session.toObject());
    emitChanged(req, channelId, out);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ── Pass the Aux — host migration ───────────────────────────────────────────
// In a P2P mesh the music lives on the DJ's machine, so when they leave it
// dies with them. This is the handoff that makes a session outlive its
// founder — the one thing a server-side music bot does better today, because
// a bot never leaves the channel.
//
// Deliberately a two-step offer/accept rather than a unilateral push: the
// incoming host has to start their OWN screen share for audio to keep
// flowing, and we can't do that for them (browsers require a user gesture on
// the target's machine). Handing the role over without their consent would
// produce a session with a host who isn't playing anything.

const HANDOFF_TTL_MS = 60 * 1000;

// POST /:channelId/dj-session/handoff  { to_user_id, to_user_name }
router.post('/:channelId/dj-session/handoff', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.id;
    const { to_user_id, to_user_name } = req.body || {};
    if (!to_user_id) return res.status(400).json({ error: 'to_user_id required' });
    if (String(to_user_id) === String(userId)) {
      return res.status(400).json({ error: "You're already the DJ" });
    }

    const session = await DJSession.findOne({ channel_id: channelId });
    if (!session) return res.status(404).json({ error: 'No active DJ session' });
    if (String(session.host_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the DJ can pass the aux' });
    }

    // The target must actually be in the call — otherwise the aux could be
    // handed to someone who left, stranding the session with an absent host.
    const present = await VoiceSession.findOne({ channel_id: channelId, user_id: to_user_id }).lean();
    if (!present) return res.status(409).json({ error: 'That person is no longer in the call' });

    session.handoff = {
      to_user_id:     String(to_user_id),
      to_user_name:   String(to_user_name || 'Spider').slice(0, 80),
      from_user_id:   String(userId),
      from_user_name: session.host_user_name || 'the DJ',
      at:             Date.now(),
    };
    session.markModified('handoff');
    await session.save();

    const out = normalise(session.toObject());
    emitChanged(req, channelId, out);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /:channelId/dj-session/handoff/accept — target takes the aux.
router.post('/:channelId/dj-session/handoff/accept', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.id;
    const session = await DJSession.findOne({ channel_id: channelId });
    if (!session) return res.status(404).json({ error: 'No active DJ session' });

    const offer = session.handoff;
    if (!offer || String(offer.to_user_id) !== String(userId)) {
      return res.status(403).json({ error: 'No aux offer for you' });
    }
    if (Date.now() - (offer.at || 0) > HANDOFF_TTL_MS) {
      session.handoff = null;
      session.markModified('handoff');
      await session.save();
      return res.status(410).json({ error: 'That offer expired' });
    }

    const profile = await UserProfile.findOne({ user_id: userId }).lean();
    session.host_id        = String(userId);
    session.host_user_name = profile?.display_name || offer.to_user_name || 'Spider';
    session.handoff        = null;
    // The new host isn't sharing yet, so the room falls back to the preview
    // until they start one. Leaving it on 'stream' would point everyone at
    // an audio pipe that no longer exists.
    session.audio_route    = 'preview';
    session.markModified('handoff');
    await session.save();

    const out = normalise(session.toObject());
    emitChanged(req, channelId, out);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /:channelId/dj-session/handoff/decline — target declines, or the host
// cancels their own pending offer.
router.post('/:channelId/dj-session/handoff/decline', authMW, async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.id;
    const session = await DJSession.findOne({ channel_id: channelId });
    if (!session) return res.status(404).json({ error: 'No active DJ session' });

    const offer = session.handoff;
    const isTarget = offer && String(offer.to_user_id) === String(userId);
    const isHost   = String(session.host_id) === String(userId);
    if (!isTarget && !isHost) return res.status(403).json({ error: 'Not your offer' });

    session.handoff = null;
    session.markModified('handoff');
    await session.save();

    const out = normalise(session.toObject());
    emitChanged(req, channelId, out);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
