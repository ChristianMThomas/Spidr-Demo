const { Schema, model } = require('mongoose');

const s = new Schema({
  channel_id:      { type: String, required: true, unique: true, index: true },
  host_id:         { type: String, required: true, index: true },
  host_user_name:  String,
  host_user_avatar:String,
  track_id:        { type: String, required: true },
  // Which catalog the track came from. Apple Music is now the ONLY host
  // catalog: the DJ must have a connected Apple Music account, Apple
  // subscribers in the room play the full master in sync, and Spotify
  // Premium listeners are resolved onto the same master via ISRC.
  // 'spotify' stays in the enum only so sessions written before this change
  // still load; nothing writes it any more.
  source:          { type: String, enum: ['spotify', 'apple'], default: 'apple' },
  // ISRC — the International Standard Recording Code. This is the pivot the
  // whole cross-service party turns on: Apple and Spotify both key the same
  // master recording by it, so broadcasting the ISRC lets a Spotify client
  // resolve the exact same recording rather than a re-record, a live version
  // or a remaster that happens to share a title.
  isrc:            { type: String, default: '' },
  // Spotify "Listen Along" party roster. One entry per Premium listener whose
  // player this server is driving. Stored on the session rather than in
  // memory so the roster survives a restart and so a track change can re-sync
  // every member without waiting for their client to notice.
  //   { user_id, user_name, user_avatar, joined_at, last_synced_at, last_error }
  listen_along:    { type: [Schema.Types.Mixed], default: [] },
  // Full track metadata cached at start/next time (schema-first — Mongoose
  // strict mode drops unknown fields). This is what lets every listener's
  // client actually PLAY audio: the 30s preview URL is broadcast with the
  // session instead of listeners passively watching the host's now-playing.
  track_name:      { type: String, default: '' },
  track_artist:    { type: String, default: '' },
  album_art_url:   { type: String, default: '' },
  preview_url:     { type: String, default: '' },
  // Marks audio sourced from the iTunes fallback rather than the original
  // service, so the UI can label it honestly.
  preview_source:  { type: String, default: '' },
  // How the room is HEARING this session:
  //   'preview'  — the 30s clip (default)
  //   'stream'   — the DJ is piping real audio through their screen share
  //   'fulltrack'— Apple Music subscribers playing the master locally
  // When set to 'stream', clients MUST NOT also play the preview or the
  // room hears two overlapping copies of the song.
  audio_route:     { type: String, default: 'preview' },
  external_url:    { type: String, default: '' },
  // Collaborative queue — anyone in the call can append. Each entry keeps
  // who added it so the booth can show attribution and enforce removal
  // rights (you can pull your own track; the host can pull any).
  queue:           { type: [Schema.Types.Mixed], default: [] },
  // Pending "Pass the Aux" offer. Held on the session rather than in memory
  // so it survives a server restart and both clients can always agree on
  // whether an offer is outstanding.
  //   { to_user_id, to_user_name, from_user_id, from_user_name, at }
  handoff:         { type: Schema.Types.Mixed, default: null },
  duration_ms:     { type: Number, default: 0 },
  started_at:      { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('DJSession', s);
