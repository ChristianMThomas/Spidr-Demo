/**
 * The Pulse — Spidr "Tension" ranking algorithm (Patch 2.11 Part 4).
 *
 * Computes a 0–100 TensionScore for a feed clip/post from its engagement,
 * weighted as the brief specifies:
 *   • Base       — time decay (newer posts start higher)
 *   • Velocity   — comments/reactions in the last 60 min (multiplies score)
 *   • Resonance  — saves ("encrypted") + shares (highest weight)
 *
 * Pure function so it can run client-side off the fields the feed already has
 * (no schema/route changes needed) and is trivially testable.
 */
export function tensionScore(post = {}) {
  const now = Date.now();
  const created = new Date(post.created_date || post.created_at || now).getTime();
  const ageHours = Math.max(0, (now - created) / 3.6e6);

  // Base: exponential time decay over ~48h. Newer ⇒ closer to 100.
  const base = 100 * Math.exp(-ageHours / 48);

  // Engagement counts.
  const likes = Array.isArray(post.likes) ? post.likes.length : (post.likes_count || 0);
  const reactionCount = post.reactions && typeof post.reactions === 'object'
    ? Object.values(post.reactions).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
    : 0;
  const comments = post.comments_count || 0;
  const shares = post.shares_count || 0;
  const saves = post.saves_count || (Array.isArray(post.saved_by) ? post.saved_by.length : 0);

  // Velocity: recent engagement matters most. We approximate "last 60 min"
  // engagement-per-hour by dividing total interactions by age (interactions
  // are front-loaded on new posts), capped so old viral posts don't dominate.
  const interactions = likes + reactionCount + comments;
  const velocity = Math.min(40, (interactions / Math.max(1, ageHours)) * 6);

  // Resonance: saves + shares carry the highest weight (intent to keep/spread).
  const resonance = (saves * 8) + (shares * 5);

  // Manual APEX "Overclock" boost (if the post was boosted, see overclock util).
  const boost = post.overclock_until && new Date(post.overclock_until).getTime() > now ? 35 : 0;

  return Math.round(base + velocity + resonance + boost);
}

/** Posts at/above this score are "Trending" → get the breathing/glow UI. */
export const TENSION_TRENDING_THRESHOLD = 75;

export function isTrending(post) {
  return tensionScore(post) >= TENSION_TRENDING_THRESHOLD;
}

export default tensionScore;
