const { Schema, model } = require('mongoose');

const s = new Schema({
  channel_id:      { type: String, required: true, unique: true, index: true },
  host_id:         { type: String, required: true, index: true },
  host_user_name:  String,
  host_user_avatar:String,
  track_id:        { type: String, required: true },
  // Which catalog the track came from — 'apple' sessions let connected
  // Apple Music subscribers play the FULL track in sync (previews for
  // everyone else); 'spotify' sessions play the 30s preview.
  source:          { type: String, enum: ['spotify', 'apple'], default: 'spotify' },
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
  duration_ms:     { type: Number, default: 0 },
  started_at:      { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('DJSession', s);
