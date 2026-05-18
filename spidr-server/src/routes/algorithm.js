/**
 * Spidr FYP Algorithm — ML-powered engagement tracking + personalized feed
 *
 * Engagement scoring weights:
 *   watch completion rate  40%
 *   loop (rewatched)        25%
 *   like                    20%
 *   share                   10%
 *   comment                  5%
 *
 * Feed ranking factors:
 *   personal engagement score  35%
 *   recency                    25%
 *   friend boost               20%
 *   hashtag affinity           15%
 *   trending signals            5%
 *   noise (anti-filter-bubble) ±5
 */
const express  = require('express');
const authMW   = require('../middleware/auth');
const Clip     = require('../models/Clip');
const EngagementProfile = require('../models/EngagementProfile');

const router = express.Router();

// In-memory buffer — flushes every 20 events or on high-signal events
const engagementBuffer = new Map();

// ── POST /algorithm/track ─────────────────────────────────────────────────────
router.post('/track', authMW, async (req, res) => {
  try {
    const { clipId, watchTimeSeconds, totalDuration, liked, looped, shared, commented } = req.body;
    const userId = (req.user.id || req.user._id).toString();

    if (!clipId) return res.status(400).json({ error: 'clipId required' });

    // Calculate engagement score (0–100)
    const completionRate = totalDuration > 0 ? Math.min(watchTimeSeconds / totalDuration, 1) : 0;
    const score =
      completionRate   * 40 +
      (looped ? 1 : 0) * 25 +
      (liked  ? 1 : 0) * 20 +
      (shared ? 1 : 0) * 10 +
      (commented ? 1 : 0) * 5;

    const key = `${userId}:${clipId}`;
    const existing = engagementBuffer.get(key) || { score: 0, userId, clipId, count: 0, completionRate: 0 };
    engagementBuffer.set(key, {
      ...existing,
      score:           Math.max(existing.score, score),
      watchTimeSeconds,
      completionRate:  Math.max(existing.completionRate, completionRate),
      liked:           existing.liked || liked,
      looped:          existing.looped || looped,
      shared:          existing.shared || shared,
      commented:       existing.commented || commented,
      count:           existing.count + 1,
    });

    if (engagementBuffer.size >= 20 || score > 60) {
      await flushEngagementBuffer();
    }

    res.json({ ok: true, score: Math.round(score) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function flushEngagementBuffer() {
  if (engagementBuffer.size === 0) return;
  const entries = [...engagementBuffer.entries()];
  engagementBuffer.clear();

  for (const [, entry] of entries) {
    try {
      // Update clip aggregate scores
      const clip = await Clip.findById(entry.clipId)
        .select('engagement_scores views hashtags author_id audio_id');
      if (!clip) continue;

      const prevAvg   = clip.engagement_scores?.avg   || 0;
      const prevCount = clip.engagement_scores?.count || 0;
      const newCount  = prevCount + 1;
      const newAvg    = (prevAvg * prevCount + entry.score) / newCount;

      await Clip.findByIdAndUpdate(entry.clipId, {
        $inc: { views: entry.count },
        $set: {
          'engagement_scores.avg':   Math.round(newAvg * 10) / 10,
          'engagement_scores.count': newCount,
        }
      });

      // Update per-user engagement profile (ML training data)
      const profileUpdate = {
        $inc: { total_watched: 1 },
        $set: { updated_at: new Date() },
      };

      // Update tag affinity scores (watched clip's hashtags get a score boost)
      const tags = clip.hashtags || [];
      const tagBoost = entry.score / 100; // 0–1 based on engagement
      for (const tag of tags) {
        profileUpdate.$inc[`tag_scores.${tag}`] = tagBoost;
      }

      // Update author affinity
      if (clip.author_id) {
        profileUpdate.$inc[`author_scores.${clip.author_id}`] = entry.completionRate;
      }

      // Update audio affinity
      if (clip.audio_id && entry.looped) {
        profileUpdate.$inc[`audio_scores.${clip.audio_id}`] = 1;
      }

      await EngagementProfile.findOneAndUpdate(
        { user_id: entry.userId },
        profileUpdate,
        { upsert: true, new: true }
      );

    } catch { /* skip individual failures */ }
  }
}

// ── GET /algorithm/feed ───────────────────────────────────────────────────────
router.get('/feed', authMW, async (req, res) => {
  try {
    const userId  = (req.user.id || req.user._id).toString();
    const limit   = parseInt(req.query.limit) || 50;

    // Fetch last 200 clips sorted by recency + engagement
    const clips = await Clip.find({})
      .sort({ created_date: -1, 'engagement_scores.avg': -1 })
      .limit(200)
      .select('_id author_id audio_id engagement_scores likes shares_count comments_count created_date hashtags');

    if (!clips.length) return res.json({ clipIds: [] });

    // Load user's personalization profile + friends + recently-watched set.
    // Recently-watched: anything where this user accrued meaningful watch time
    // in the last 48 hours. We exclude these from the feed so users don't see
    // the same clip back-to-back, but they're still scorable via the random
    // serendipity tail (which is what surfaces them again after the window).
    const [profile, friends, recentlyWatched] = await Promise.all([
      EngagementProfile.findOne({ user_id: userId }).lean().catch(() => null),
      (async () => {
        try {
          const Friend = require('../models/Friend');
          const f = await Friend.find({ user_id: userId, status: 'accepted' });
          return new Set(f.map(x => x.friend_id));
        } catch { return new Set(); }
      })(),
      (async () => {
        // Pull any clipIds the user has buffered engagement for in the past 48h.
        // The buffer is in-memory so this is cheap; for persistent tracking
        // you'd want a separate `clip_views` collection with TTL index.
        const cutoff = Date.now() - 48 * 60 * 60 * 1000;
        const seen = new Set();
        for (const [key, entry] of engagementBuffer.entries()) {
          if (!key.startsWith(userId + ':')) continue;
          if ((entry.completionRate || 0) >= 0.4) seen.add(entry.clipId);
        }
        return seen;
      })(),
    ]);

    const tagScores    = profile?.tag_scores    || {};
    const authorScores = profile?.author_scores || {};
    const audioScores  = profile?.audio_scores  || {};
    const now = Date.now();

    // Score each clip
    const scored = clips.map(clip => {
      const id = clip._id.toString();

      // Base engagement score (0–100 → normalized to 0–35)
      const engScore = Math.min((clip.engagement_scores?.avg || 0), 100) * 0.35;

      // Recency (0–25): full points for < 1 hour, decays over 7 days
      const ageHours = (now - new Date(clip.created_date).getTime()) / 3_600_000;
      const recency  = Math.max(0, 25 * Math.exp(-ageHours / 168)); // 168h = 7 days

      // Friend boost (0–20)
      const friendBoost = friends.has(clip.author_id?.toString()) ? 20 : 0;

      // Hashtag affinity (0–15) — uses ML profile
      const tagBoost = Math.min(
        (clip.hashtags || []).reduce((sum, t) => sum + (tagScores[t] || 0), 0) * 5,
        15
      );

      // Author affinity (0–10)
      const authorBoost = Math.min((authorScores[clip.author_id] || 0) * 2, 10);

      // Audio affinity (0–5)
      const audioBoost = clip.audio_id ? Math.min((audioScores[clip.audio_id] || 0), 5) : 0;

      // Trending (0–5)
      const trending = Math.min(
        ((clip.likes?.length || 0) * 0.3) +
        ((clip.shares_count || 0) * 0.8) +
        ((clip.comments_count || 0) * 0.5),
        5
      );

      // Anti-filter-bubble noise (±5)
      const noise = (parseInt(id.slice(-4), 16) % 10) - 5;

      // Recently-watched penalty: -60 (heavily deprioritizes but doesn't hide
      // entirely, so the user can still re-encounter clips they liked).
      const seenPenalty = recentlyWatched.has(id) ? -60 : 0;

      const total = engScore + recency + friendBoost + tagBoost + authorBoost + audioBoost + trending + noise + seenPenalty;

      return { id, score: total };
    });

    scored.sort((a, b) => b.score - a.score);

    // Mix: 70% personalized + 30% serendipity (random from tail)
    const top70  = scored.slice(0, Math.ceil(limit * 0.7));
    const tail   = scored.slice(Math.ceil(limit * 0.7));
    const random = tail.sort(() => Math.random() - 0.5).slice(0, Math.floor(limit * 0.3));
    const mixed  = [...top70, ...random].slice(0, limit);

    res.json({ clipIds: mixed.map(s => s.id), personalized: !!profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
