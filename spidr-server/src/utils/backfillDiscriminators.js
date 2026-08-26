/**
 * backfillDiscriminators — give every tagless profile a real #tag.
 *
 * Why this exists: profiles created before the discriminator field (or via a
 * write path that bypassed the pre-save hook) have no tag. The client papered
 * over that with a hardcoded '0000' fallback, so every one of those users
 * rendered as `Name#0000` — which is what made all the tags look identical.
 *
 * Idempotent: it only touches documents where the tag is missing or empty,
 * so it's safe to run on every boot. Uses the deterministic id-derived tag,
 * then resolves any collisions with a random retry — the deterministic pass
 * means repeat runs don't churn tags for the same users.
 */
const UserProfile = require('../models/UserProfile');
const { deterministicTag, isTagAvailable, generateUniqueDiscriminator } = require('./tagService');

async function backfillDiscriminators() {
  try {
    const tagless = await UserProfile
      .find({ $or: [{ discriminator: { $exists: false } }, { discriminator: null }, { discriminator: '' }] })
      .select('_id user_id display_name')
      .lean();

    if (tagless.length === 0) return;

    let fixed = 0;
    for (const p of tagless) {
      let tag = deterministicTag(p.user_id || p._id);
      // If that seed already collides for this name, fall back to a checked
      // random tag.
      // eslint-disable-next-line no-await-in-loop
      const free = await isTagAvailable(UserProfile, p.display_name, tag, p.user_id);
      if (!free) {
        // eslint-disable-next-line no-await-in-loop
        tag = await generateUniqueDiscriminator(UserProfile, p.display_name, p.user_id);
      }
      // updateOne bypasses the findOneAndUpdate hook — intentional, we've
      // already resolved the tag and don't want the hook re-deriving it.
      // eslint-disable-next-line no-await-in-loop
      await UserProfile.updateOne({ _id: p._id }, { $set: { discriminator: tag } });
      fixed++;
    }
    console.log(`✓ Backfilled #tags for ${fixed} profile(s)`);
  } catch (err) {
    console.warn('Discriminator backfill skipped:', err.message);
  }
}

module.exports = { backfillDiscriminators };
