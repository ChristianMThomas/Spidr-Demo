#!/usr/bin/env node
/**
 * add-spidr-system-friend.js — backfill Spidr System friendships.
 *
 * New users get Spidr System as an accepted friend automatically (auth
 * middleware hook). This script covers everyone who registered BEFORE that
 * hook shipped: it walks the users collection and upserts the reciprocal
 * Friend rows + welcome DM for each.
 *
 * Idempotent — reruns skip users who already have the friendship (the
 * welcome DM only fires when the Friend row is newly created).
 *
 * Usage:
 *   node scripts/add-spidr-system-friend.js            # dry run, counts only
 *   node scripts/add-spidr-system-friend.js --apply    # actually writes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Friend = require('../src/models/Friend');

const APPLY = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/spidr';
  await mongoose.connect(uri);
  console.log('Connected to', uri.replace(/\/\/[^@]+@/, '//<credentials>@'));

  const { ensureSystemUser, ensureSystemFriendship, SYSTEM_EMAIL } = require('../src/utils/spidrSystem');

  const sysId = await ensureSystemUser();
  console.log(`Spidr System user: ${sysId}`);

  const users = await User.find({ email: { $ne: SYSTEM_EMAIL } }).select('_id email').lean();
  console.log(`${users.length} users to check`);

  let already = 0;
  let created = 0;

  for (const u of users) {
    const uid = u._id.toString();
    const existing = await Friend.findOne({ user_id: uid, friend_id: sysId }).select('_id').lean();
    if (existing) {
      already++;
      continue;
    }
    if (APPLY) {
      await ensureSystemFriendship(uid);
      console.log(`  + linked ${u.email}`);
    }
    created++;
  }

  console.log(`\n${already} already linked, ${created} ${APPLY ? 'created' : 'WOULD be created'}.`);
  if (!APPLY && created > 0) console.log('Re-run with --apply to write.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
