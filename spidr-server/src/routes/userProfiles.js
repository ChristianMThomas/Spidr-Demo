const express = require('express');
const authMW = require('../middleware/auth');
const crudRouter = require('../utils/crudRouter');
const UserProfile = require('../models/UserProfile');
const InstalledModule = require('../models/InstalledModule');
const { validateCustomTag, isTagAvailable, generateUniqueDiscriminator } = require('../utils/tagService');

const router = express.Router();
const { publicProfile, connectionSafeBody } = require('../utils/profileConnections');
router.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = body => json(publicProfile(body));
  if (['POST', 'PATCH'].includes(req.method)) {
    for (const key of ['is_private', 'hide_activity']) {
      if (req.body?.[key] !== undefined && typeof req.body[key] !== 'boolean') return res.status(400).json({ error: key + ' must be a boolean' });
    }
    req.body = connectionSafeBody(req.body, req.method === 'PATCH');
  }
  next();
});

router.get('/privacy', authMW, async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user_id: req.user.id }).select('is_private hide_activity').lean();
    res.set('Cache-Control', 'no-store').json({ is_private: profile?.is_private === true, hide_activity: profile?.hide_activity === true });
  } catch { res.status(500).json({ error: 'Could not load privacy settings' }); }
});
router.patch('/privacy', authMW, async (req, res) => {
  try {
    const updates = {};
    for (const key of ['is_private', 'hide_activity']) if (typeof req.body[key] === 'boolean') updates[key] = req.body[key];
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No privacy settings supplied' });
    await UserProfile.updateOne({ user_id: req.user.id }, { $set: updates }, { upsert: true, runValidators: true });
    const profile = await UserProfile.findOne({ user_id: req.user.id }).select('is_private hide_activity').lean();
    res.set('Cache-Control', 'no-store').json({ is_private: profile.is_private === true, hide_activity: profile.hide_activity === true });
  } catch { res.status(500).json({ error: 'Could not save privacy settings' }); }
});

/**
 * PUT /user-profiles/modules/reorder — save the owner's profile module layout.
 *
 * Body: { order: ['<module_id>', '<module_id>', ...] }
 *
 * Kept off the generic PATCH surface on purpose. The order is only meaningful
 * as a permutation of what this user actually has installed, so the ids are
 * intersected against their own InstalledModule rows before anything is
 * written. Without that, the array slowly fills with ids from uninstalled or
 * never-installed modules, and a profile's layout becomes a list of ghosts
 * that later reads have to filter anyway.
 *
 * The write is idempotent and total — the client always sends the full order,
 * never a move instruction — so two drags racing each other resolve to
 * whichever landed last rather than to a corrupted sequence.
 */
router.put('/modules/reorder', authMW, async (req, res) => {
  try {
    const submitted = req.body?.order ?? req.body?.newOrder;
    if (!Array.isArray(submitted)) return res.status(400).json({ error: 'order must be an array of module ids' });
    if (submitted.length > 200) return res.status(400).json({ error: 'Too many modules in the layout' });

    const clean = [];
    const seen = new Set();
    for (const raw of submitted) {
      if (typeof raw !== 'string') continue;
      const id = raw.trim();
      // Duplicates would make arrayMove ambiguous and render two copies of one
      // module, so they are collapsed rather than rejected.
      if (!id || id.length > 200 || seen.has(id)) continue;
      seen.add(id);
      clean.push(id);
    }

    const installed = await InstalledModule.find({ user_id: req.user.id }).select('module_id').lean();
    const owned = new Set(installed.map(row => row.module_id).filter(Boolean));
    const order = clean.filter(id => owned.has(id));

    await UserProfile.updateOne(
      { user_id: req.user.id },
      { $set: { module_order: order } },
      { upsert: true, runValidators: true },
    );
    res.set('Cache-Control', 'no-store').json({ ok: true, module_order: order });
  } catch (error) {
    res.status(500).json({ error: 'Could not save the module layout' });
  }
});

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
