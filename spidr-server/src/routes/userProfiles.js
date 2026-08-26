const express = require('express');
const authMW = require('../middleware/auth');
const crudRouter = require('../utils/crudRouter');
const UserProfile = require('../models/UserProfile');
const { validateCustomTag, isTagAvailable, generateUniqueDiscriminator } = require('../utils/tagService');

const router = express.Router();

/**
 * POST /user-profiles/tag — claim a custom word tag ("Auxtin#vibes") or
 * re-roll a random one.
 *
 * Body: { tag }  — omit or send null to get a fresh random tag.
 *
 * Tags are NOT part of the generic PATCH surface on purpose: they need
 * validation, case-folding, reserved-word and collision checks that a
 * blanket field update would skip. PROTECTED_FIELDS in crudRouter blocks
 * discriminator from ordinary patches for the same reason.
 */
router.post('/tag', authMW, async (req, res) => {
  try {
    const userId = req.user?.id;
    const profile = await UserProfile.findOne({ user_id: userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // No tag supplied → re-roll a random one.
    if (!req.body?.tag) {
      const tag = await generateUniqueDiscriminator(UserProfile, profile.display_name, userId);
      profile.discriminator = tag;
      await profile.save();
      return res.json({ ok: true, discriminator: tag });
    }

    const check = validateCustomTag(req.body.tag);
    if (!check.ok) return res.status(400).json({ error: check.error });

    const free = await isTagAvailable(UserProfile, profile.display_name, check.tag, userId);
    if (!free) {
      return res.status(409).json({
        error: `${profile.display_name || 'That name'}#${check.tag} is already taken`,
      });
    }

    profile.discriminator = check.tag;
    await profile.save();
    res.json({ ok: true, discriminator: check.tag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /user-profiles/tag/check?tag=vibes — live availability for the UI. */
router.get('/tag/check', authMW, async (req, res) => {
  try {
    const check = validateCustomTag(req.query.tag);
    if (!check.ok) return res.json({ available: false, reason: check.error });
    const profile = await UserProfile.findOne({ user_id: req.user?.id }).select('display_name').lean();
    const available = await isTagAvailable(UserProfile, profile?.display_name, check.tag, req.user?.id);
    res.json({ available, tag: check.tag, reason: available ? null : 'Already taken' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ownerField locks PATCH/DELETE to the profile owner. Without this,
// crudRouter's isOwner() returns true unconditionally and any authenticated
// user could PATCH /user-profiles/<anyone>. Combined with PROTECTED_FIELDS
// blocking apex_tier + stripe_* writes, the tier can only be changed via
// verified Stripe webhook.
router.use(crudRouter(UserProfile, { ownerField: 'user_id' }));

module.exports = router;
