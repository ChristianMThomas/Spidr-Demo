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
const AppleMusicConnection = require('../models/AppleMusicConnection');
const spotifySync  = require('../services/spotifySync');

const router = express.Router();

// ── Apple Music is the only host catalog ────────────────────────────────────
// Hosting a booth means having a real Apple Music subscription connected. That
// is what gives the room a full master to play rather than a 30-second clip,
// and it is what produces the ISRC that Spotify listeners are resolved onto.
// The one exception is Share Audio (`mode: 'share'`), which carries no catalog
// track at all — the DJ's own screen-share audio is the source, so there is no
// catalog to require.
async function requireAppleHost(userId) {
  if (!await AppleMusicConnection.exists({ user_id: userId })) {
    const error = new Error('Connect Apple Music to host the DJ booth.');
    error.status = 409;
    error.code = 'apple_music_required';
    throw error;
  }
}

/**
 * Where the session clock is right now, in milliseconds.
 *
 * `started_at` is set every time the track changes, so elapsed-since-start IS
 * the playback position — the same clock the Apple Music listeners seek to in
 * useDJAudio. Spotify listeners are seeked to the same number, which is what
 * puts both services on the same beat.
 */
function sessionPositionMs(session) {
  const started = new Date(session?.started_at || 0).getTime();
  if (!Number.isFinite(started) || !started) return 0;
  const elapsed = Math.max(0, Date.now() - started);
  const duration = Number(session?.duration_ms) || 0;
  return duration ? Math.min(elapsed, Math.max(0, duration - 1500)) : elapsed;
}

/**
 * Re-points every Listen Along member at the session's current track.
 *
 * Fire-and-forget on purpose: the host changing a song must not block on five
 * Spotify round trips, and one listener with a dead device must not fail the
 * track change for the room. Failures are recorded on that listener's roster
 * entry so their own card can explain itself; a listener whose authorization
 * is gone is dropped from the party outright rather than being retried on
 * every future track.
 */
function resyncParty(session) {
  const members = session?.listen_along || [];
  if (!members.length || !session?.isrc) return;
  const positionMs = sessionPositionMs(session);
  for (const member of members) {
    spotifySync.syncListenerToTrack(member.user_id, { isrc: session.isrc, positionMs })
      .then(() => DJSession.updateOne(
        { _id: session._id, 'listen_along.user_id': member.user_id },
        { $set: { 'listen_along.$.last_synced_at': new Date(), 'listen_along.$.last_error': null } },
      ))
      .catch((error) => {
        const fatal = ['not_connected', 'reconnect_required', 'premium_required'].includes(error.code);
        return DJSession.updateOne(
          { _id: session._id },
          fatal
            ? { $pull: { listen_along: { user_id: member.user_id } } }
            : { $set: { 'listen_along.$[m].last_error': error.code || 'sync_failed' } },
          fatal ? {} : { arrayFilters: [{ 'm.user_id': member.user_id }] },
        );
      })
      .catch(() => { /* the party roster is not worth crashing a track change over */ });
  }
}

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
    ...(body.audio_route === 'stream' || body.audio_route === 'preview' ? { audio_route: body.audio_route } : {}),
    external_url:  String(body.external_url  || '').slice(0, 500),
    duration_ms:   Number(body.duration_ms)  || 0,
    // ISRCs are 12 alphanumerics. Anything else is dropped rather than stored,
    // because a malformed code produces a silent Spotify search miss that
    // presents to the user as "this song isn't on Spotify".
    isrc:          /^[A-Za-z0-9]{12}$/.test(String(body.isrc || '')) ? String(body.isrc).toUpperCase() : '',
    // Apple is the only catalog the booth hosts from. This deliberately no
    // longer reads the client's claim: a session either came through the Apple
    // picker or it is a Share Audio session carrying no catalog track at all.
    source:        'apple',
  };
}

// ── GET /voice-channels/:channelId/dj-session ────────────────────────────────
const { randomUUID } = require('node:crypto');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const uid = req => String(req.user.id || req.user.userId);
const sessionFor = async req => {
  const session = await DJSession.findOne({ channel_id: req.params.channelId }).lean();
  if (!session) fail(404, 'No active DJ session');
  return session;
};
const hostSession = async req => {
  const session = await sessionFor(req);
  if (session.host_id !== uid(req)) fail(403, 'Only the DJ can change this session');
  return session;
};
const publish = (req, res, session, status = 200) => {
  if (!session) fail(409, 'The DJ session changed. Please try again.');
  const out = normalise(session);
  emitChanged(req, req.params.channelId, out);
  res.status(status).json(out);
};
const trackId = body => {
  if (typeof body?.track_id !== 'string' || !body.track_id || body.track_id.length > 200) fail(400, 'track_id required');
  return body.track_id;
};

// All mutations require current room presence, not just a previously owned role.
router.use('/:channelId/dj-session', authMW, async (req, res, next) => {
  try {
    if (req.method !== 'GET' && !await callerInChannel(uid(req), req.params.channelId)) fail(403, 'Join the voice channel first');
    next();
  } catch (error) { next(error); }
});

router.get('/:channelId/dj-session', handle(async (req, res) => {
  res.json(normalise(await DJSession.findOne({ channel_id: req.params.channelId }).lean()));
}));

router.post('/:channelId/dj-session', handle(async (req, res) => {
  const sharing = req.body?.mode === 'share';
  // Share Audio needs no catalog — the DJ's own shared audio is the source.
  // Every other way of opening the booth now requires Apple Music.
  if (!sharing) await requireAppleHost(uid(req));
  const track_id = sharing ? 'live:' + randomUUID() : trackId(req.body);
  const profile = await UserProfile.findOne({ user_id: uid(req) }).lean();
  const meta = sharing ? { track_name: 'Live audio', audio_route: 'preview' } : await ensurePreview(trackMeta(req.body));
  const doc = await DJSession.create({
    channel_id: req.params.channelId, host_id: uid(req),
    host_user_name: profile?.display_name || profile?.full_name || profile?.username || 'Spider',
    host_user_avatar: profile?.avatar_url || '', track_id, ...meta, started_at: new Date(),
  });
  publish(req, res, doc.toObject(), 201);
}));

router.patch('/:channelId/dj-session', handle(async (req, res) => {
  const session = await hostSession(req);
  await requireAppleHost(uid(req));
  const track_id = trackId(req.body);
  const meta = await ensurePreview(trackMeta(req.body));
  // Updating the annotation for the same song must not restart its preview.
  const updated = await DJSession.findOneAndUpdate({ _id: session._id, host_id: uid(req), track_id: session.track_id }, {
    $set: { ...meta, track_id, ...(track_id !== session.track_id ? { started_at: new Date() } : {}) },
  }, { new: true }).lean();
  // A genuine track change drags the whole Spotify party onto the new song.
  // Re-annotating the same track must not, or every metadata tweak would
  // restart playback from zero for everyone listening along.
  if (updated && track_id !== session.track_id) resyncParty(updated);
  publish(req, res, updated);
}));

router.patch('/:channelId/dj-session/route', handle(async (req, res) => {
  const session = await hostSession(req);
  const route = req.body?.audio_route;
  if (!['stream', 'preview'].includes(route)) fail(400, 'Invalid audio route');
  publish(req, res, await DJSession.findOneAndUpdate({ _id: session._id, host_id: uid(req) },
    { $set: { audio_route: route } }, { new: true }).lean());
}));

router.delete('/:channelId/dj-session', handle(async (req, res) => {
  const session = await hostSession(req);
  const result = await DJSession.deleteOne({ _id: session._id, host_id: uid(req) });
  if (!result.deletedCount) fail(409, 'The DJ session changed');
  // Ending the booth has to stop the party too. Without this, everyone who
  // joined Listen Along keeps playing the DJ's last song on their own Spotify
  // long after the room emptied, with no card left to explain why.
  for (const member of session.listen_along || []) {
    spotifySync.pauseListener(member.user_id).catch(() => {});
  }
  emitChanged(req, req.params.channelId, null);
  res.json({ success: true });
}));

router.post('/:channelId/dj-session/queue', handle(async (req, res) => {
  const session = await sessionFor(req);
  const track_id = trackId(req.body);
  const profile = await UserProfile.findOne({ user_id: uid(req) }).lean();
  const entry = { qid: randomUUID(), track_id, ...(await ensurePreview(trackMeta(req.body))),
    added_by: uid(req), added_by_name: profile?.display_name || profile?.full_name || profile?.username || 'Spider', added_at: new Date() };
  // Conditional push is atomic: parallel requesters cannot overwrite each other,
  // duplicate a track, or both claim the last available queue slot.
  publish(req, res, await DJSession.findOneAndUpdate({
    _id: session._id, 'queue.49': { $exists: false },
    queue: { $not: { $elemMatch: { track_id, source: entry.source } } },
  }, { $push: { queue: entry } }, { new: true }).lean(), 201);
}));

router.delete('/:channelId/dj-session/queue/:qid', handle(async (req, res) => {
  const session = await sessionFor(req);
  const entry = session.queue.find(q => q.qid === req.params.qid);
  if (!entry) fail(404, 'Not in queue');
  if (session.host_id !== uid(req) && entry.added_by !== uid(req)) fail(403, 'Only the requester or DJ can remove this track');
  publish(req, res, await DJSession.findOneAndUpdate({
    _id: session._id, $or: [{ host_id: uid(req) }, { queue: { $elemMatch: { qid: entry.qid, added_by: uid(req) } } }],
  }, { $pull: { queue: { qid: entry.qid } } }, { new: true }).lean());
}));

router.post('/:channelId/dj-session/advance', handle(async (req, res) => {
  const session = await hostSession(req);
  const next = session.queue?.[0];
  if (!next) fail(409, 'Queue is empty');
  const meta = trackMeta(next);
  delete meta.audio_route;
  const advanced = await DJSession.findOneAndUpdate({
    _id: session._id, host_id: uid(req), 'queue.0.qid': next.qid,
  }, { $set: { ...meta, track_id: next.track_id, started_at: new Date() }, $pop: { queue: -1 } }, { new: true }).lean();
  if (advanced) resyncParty(advanced);
  publish(req, res, advanced);
}));

// ── Listen Along ────────────────────────────────────────────────────────────
// A Spotify Premium listener's own player, driven onto the DJ's current track
// via its ISRC. No audio crosses between accounts: each listener's Spotify
// plays for them, we only say what and from where.

const partyMember = (session, userId) => (session.listen_along || []).find(m => m.user_id === userId);

router.post('/:channelId/dj-session/listen-along', handle(async (req, res) => {
  const session = await sessionFor(req);
  if (!session.isrc) fail(409, 'This track has no ISRC, so it cannot be matched on Spotify.');
  const userId = uid(req);

  // Play first, join second. Adding someone to a party whose playback never
  // started would show an avatar on a card for a person hearing silence.
  const result = await spotifySync.syncListenerToTrack(userId, {
    isrc: session.isrc,
    positionMs: sessionPositionMs(session),
  });

  const profile = await UserProfile.findOne({ user_id: userId }).lean();
  const entry = {
    user_id: userId,
    user_name: profile?.display_name || profile?.full_name || profile?.username || 'Spider',
    user_avatar: profile?.avatar_url || '',
    joined_at: new Date(),
    last_synced_at: new Date(),
    last_error: null,
  };
  // Conditional push: rejoining from a second device must not duplicate the
  // avatar on the party card.
  const joined = await DJSession.findOneAndUpdate(
    { _id: session._id, 'listen_along.user_id': { $ne: userId } },
    { $push: { listen_along: entry } },
    { new: true },
  ).lean();
  const current = joined || await DJSession.findOne({ _id: session._id }).lean();
  emitChanged(req, req.params.channelId, normalise(current));
  res.status(201).json({ ...normalise(current), synced: result });
}));

router.delete('/:channelId/dj-session/listen-along', handle(async (req, res) => {
  const session = await sessionFor(req);
  const userId = uid(req);
  if (!partyMember(session, userId)) fail(404, 'You are not in this listen-along party');
  // Pause before removing. Leaving the party while the song keeps playing is
  // the behaviour people read as "the button did nothing".
  await spotifySync.pauseListener(userId);
  publish(req, res, await DJSession.findOneAndUpdate(
    { _id: session._id },
    { $pull: { listen_along: { user_id: userId } } },
    { new: true },
  ).lean());
}));

// Manual catch-up. Spotify playback drifts (a listener pauses, takes a call,
// loses a device), and nothing in the Web API streams us that. Rather than
// polling every member's player on a timer — which burns rate limit for the
// whole account pool — the card offers a resync the listener presses when
// they notice they are off.
router.post('/:channelId/dj-session/listen-along/resync', handle(async (req, res) => {
  const session = await sessionFor(req);
  const userId = uid(req);
  if (!partyMember(session, userId)) fail(404, 'You are not in this listen-along party');
  if (!session.isrc) fail(409, 'This track has no ISRC, so it cannot be matched on Spotify.');
  const result = await spotifySync.syncListenerToTrack(userId, {
    isrc: session.isrc,
    positionMs: sessionPositionMs(session),
  });
  const updated = await DJSession.findOneAndUpdate(
    { _id: session._id, 'listen_along.user_id': userId },
    { $set: { 'listen_along.$.last_synced_at': new Date(), 'listen_along.$.last_error': null } },
    { new: true },
  ).lean();
  res.json({ ...normalise(updated || session), synced: result });
}));

const HANDOFF_TTL_MS = 60_000;
router.post('/:channelId/dj-session/handoff', handle(async (req, res) => {
  const session = await hostSession(req);
  const target = req.body?.to_user_id;
  if (typeof target !== 'string' || !target || target === uid(req)) fail(400, 'Choose another participant');
  if (session.handoff && Date.now() - session.handoff.at < HANDOFF_TTL_MS) fail(409, 'An aux offer is already pending');
  const present = await VoiceSession.findOne({ channel_id: req.params.channelId, user_id: target }).lean();
  if (!present) fail(409, 'That person is no longer in the call');
  const handoff = { to_user_id: target, to_user_name: present.user_name || 'Spider', from_user_id: uid(req),
    from_user_name: session.host_user_name || 'DJ', at: Date.now() };
  publish(req, res, await DJSession.findOneAndUpdate({
    _id: session._id, host_id: uid(req), ...(session.handoff ? { 'handoff.at': session.handoff.at } : { handoff: null }),
  }, { $set: { handoff } }, { new: true }).lean());
}));

router.post('/:channelId/dj-session/handoff/accept', handle(async (req, res) => {
  const session = await sessionFor(req);
  const offer = session.handoff;
  if (!offer || offer.to_user_id !== uid(req)) fail(403, 'No aux offer for you');
  const filter = { _id: session._id, host_id: offer.from_user_id, 'handoff.at': offer.at, 'handoff.to_user_id': uid(req) };
  if (Date.now() - offer.at > HANDOFF_TTL_MS) {
    const expired = await DJSession.findOneAndUpdate(filter, { $set: { handoff: null } }, { new: true }).lean();
    if (expired) emitChanged(req, req.params.channelId, normalise(expired));
    fail(410, 'That offer expired');
  }
  const profile = await UserProfile.findOne({ user_id: uid(req) }).lean();
  publish(req, res, await DJSession.findOneAndUpdate(filter, { $set: {
    host_id: uid(req), host_user_name: profile?.display_name || offer.to_user_name || 'Spider',
    host_user_avatar: profile?.avatar_url || '', handoff: null, audio_route: 'preview',
  } }, { new: true }).lean());
}));

router.post('/:channelId/dj-session/handoff/decline', handle(async (req, res) => {
  const session = await sessionFor(req);
  if (session.host_id !== uid(req) && session.handoff?.to_user_id !== uid(req)) fail(403, 'Not your offer');
  publish(req, res, await DJSession.findOneAndUpdate({
    _id: session._id, ...(session.handoff ? { 'handoff.at': session.handoff.at } : { handoff: null }),
  }, { $set: { handoff: null } }, { new: true }).lean());
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const duplicate = error.code === 11000;
  res.status(duplicate ? 409 : error.status || 400).json({
    error: duplicate ? 'A DJ session is already active' : error.message,
    // The machine-readable code is what lets the Listen Along button render
    // the right recovery ("Open Spotify on a device", "Reconnect Spotify",
    // "Connect Apple Music") instead of dumping a sentence into a toast.
    // 11000 is Mongo's duplicate-key marker, not one of ours.
    ...(error.code && !duplicate ? { code: error.code } : {}),
  });
});
module.exports = router;
