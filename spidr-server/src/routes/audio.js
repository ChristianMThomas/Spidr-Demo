/**
 * Spidr Audio Routes
 * 
 * GET /audio/search?q=term        — Search Spotify for tracks (30s previews)
 * GET /audio/originals/:audioId   — Get all clips using a specific AudioTrack
 * GET /audio/trending              — Top 20 most-used AudioTracks
 */

const express  = require('express');
const axios    = require('axios');
const authMW   = require('../middleware/auth');
const AudioTrack = require('../models/AudioTrack');
const Clip     = require('../models/Clip');

const router = express.Router();

// ── Spotify token (client credentials flow) ───────────────────────────────────
let spotifyToken    = null;
let spotifyTokenExp = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExp) return spotifyToken;

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;

  try {
    const creds  = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const result = await axios.post('https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    spotifyToken    = result.data.access_token;
    spotifyTokenExp = Date.now() + (result.data.expires_in - 60) * 1000;
    return spotifyToken;
  } catch { return null; }
}

// ── GET /audio/search ─────────────────────────────────────────────────────────
router.get('/search', authMW, async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q || q.trim().length < 1) return res.json([]);

  try {
    const token = await getSpotifyToken();

    if (token) {
      // Real Spotify search
      const result = await axios.get('https://api.spotify.com/v1/search', {
        params: { q: q.trim(), type: 'track', limit: Math.min(parseInt(limit), 20) },
        headers: { Authorization: `Bearer ${token}` }
      });

      const tracks = result.data.tracks.items
        .filter(t => t.preview_url) // Only tracks with 30s previews
        .map(t => ({
          id:         t.id,
          title:      t.name,
          artist:     t.artists.map(a => a.name).join(', '),
          album:      t.album.name,
          cover_url:  t.album.images[0]?.url || '',
          preview_url: t.preview_url,
          duration:   Math.round(t.duration_ms / 1000),
          source:     'spotify',
          external_url: t.external_urls.spotify,
        }));

      return res.json(tracks);
    }

    // Fallback: search our own AudioTrack DB when no Spotify keys
    const tracks = await AudioTrack.find({
      $or: [
        { title:  { $regex: q.trim(), $options: 'i' } },
        { artist: { $regex: q.trim(), $options: 'i' } },
      ]
    }).limit(parseInt(limit)).lean();

    return res.json(tracks.map(t => ({
      id:         t._id.toString(),
      title:      t.title,
      artist:     t.artist || 'Original Sound',
      cover_url:  t.cover_url || '',
      preview_url: t.url,
      duration:   t.duration || 30,
      source:     'original',
    })));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /audio/originals/:audioId — clips using this audio ───────────────────
router.get('/originals/:audioId', authMW, async (req, res) => {
  try {
    const clips = await Clip.find({ audio_id: req.params.audioId })
      .sort({ views: -1 })
      .limit(50)
      .lean();

    const track = await AudioTrack.findById(req.params.audioId).lean().catch(() => null);

    res.json({
      track: track ? { ...track, id: track._id.toString() } : null,
      clips: clips.map(c => ({ ...c, id: c._id.toString() })),
      total: clips.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /audio/trending ───────────────────────────────────────────────────────
router.get('/trending', authMW, async (req, res) => {
  try {
    const tracks = await AudioTrack.find({ url: { $exists: true, $ne: '' } })
      .sort({ use_count: -1 })
      .limit(20)
      .lean();

    res.json(tracks.map(t => ({ ...t, id: t._id.toString() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
