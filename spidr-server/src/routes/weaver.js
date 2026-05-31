/**
 * The Weaver — external audio grafting resolver (Patch 2.12).
 *
 * POST /weaver/parse-audio  { url }
 *   Resolves a Spotify / YouTube / Apple Music link into:
 *     { provider, title, author, thumbnail, sourceUrl, embedHtml }
 *   using each provider's public oEmbed endpoint (no API keys required).
 *
 * oEmbed gives us title, author_name, and thumbnail_url reliably for all three.
 * 30-second preview URLs require authed APIs (Spotify token / iTunes lookup);
 * we attempt the public iTunes Search API for Apple Music previews as a bonus,
 * but never fail the request if a preview isn't available.
 */
const express = require('express');
const router = express.Router();

const PROVIDERS = [
  { id: 'youtube',     test: /(?:youtube\.com|youtu\.be)/i,  oembed: (u) => `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json` },
  { id: 'spotify',     test: /spotify\.com/i,                 oembed: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}` },
  { id: 'apple_music', test: /music\.apple\.com/i,            oembed: (u) => `https://music.apple.com/api/oembed?url=${encodeURIComponent(u)}` },
];

function detectProvider(url) {
  return PROVIDERS.find(p => p.test.test(url)) || null;
}

router.post('/parse-audio', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A url is required.' });
    }
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL.' }); }
    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http(s) URLs are allowed.' });
    }

    const provider = detectProvider(url);
    if (!provider) {
      return res.status(422).json({ error: 'Unsupported source. Use YouTube, Spotify, or Apple Music.' });
    }

    const fetchFn = global.fetch ?? (await import('node-fetch').catch(() => null))?.default;
    if (!fetchFn) return res.status(500).json({ error: 'Fetch unavailable on server.' });

    // Pull oEmbed metadata.
    let meta = {};
    try {
      const r = await fetchFn(provider.oembed(url), { headers: { 'User-Agent': 'SpidrWeaver/1.0' } });
      if (r.ok) meta = await r.json();
    } catch { /* fall through to minimal payload */ }

    // Best-effort Apple Music 30s preview via the public iTunes lookup API.
    let previewUrl = null;
    if (provider.id === 'apple_music') {
      const idMatch = url.match(/[?&]i=(\d+)/) || url.match(/\/(\d+)(?:\?|$)/);
      const trackId = idMatch && idMatch[1];
      if (trackId) {
        try {
          const lr = await fetchFn(`https://itunes.apple.com/lookup?id=${trackId}`);
          if (lr.ok) {
            const data = await lr.json();
            previewUrl = data?.results?.[0]?.previewUrl || null;
          }
        } catch { /* ignore */ }
      }
    }

    return res.json({
      provider: provider.id,
      title: meta.title || 'Unknown Track',
      author: meta.author_name || meta.provider_name || '',
      thumbnail: meta.thumbnail_url || '',
      sourceUrl: url,
      previewUrl,
      embedHtml: meta.html || '',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse audio source.' });
  }
});

module.exports = router;
