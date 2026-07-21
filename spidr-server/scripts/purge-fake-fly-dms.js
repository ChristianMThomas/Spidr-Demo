#!/usr/bin/env node
/**
 * purge-fake-fly-dms.js — one-time cleanup of fabricated fly-catch DMs.
 *
 * Before 2026-07-21 the clients created the "caught the fly! +N Biomass"
 * notification themselves with a fake sender_id of 'spidr-ai' and
 * receiver = the catcher, which landed the messages in a self-DM thread
 * instead of the real Spidr System account. The catch DM is now written
 * server-side by routes/biomass.js via sendSystemDM(), so every row with
 * sender_id 'spidr-ai' and that content is junk.
 *
 * Usage:
 *   node scripts/purge-fake-fly-dms.js           # dry run — counts only
 *   node scripts/purge-fake-fly-dms.js --delete  # actually delete
 */
require('dotenv').config();
const mongoose = require('mongoose');
const DirectMessage = require('../src/models/DirectMessage');

async function main() {
  const doDelete = process.argv.includes('--delete');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/spidr';
  await mongoose.connect(uri);

  // The server rewrote sender_id to the authed user on create, so the junk
  // rows have sender == receiver == the catcher; the fake 'spidr-ai' id only
  // survives inside the fabricated conversation_id.
  const filter = {
    conversation_id: { $regex: /spidr-ai/ },
    content: { $regex: /caught the fly! \+\d+ Biomass$/ },
  };

  const count = await DirectMessage.countDocuments(filter);
  console.log(`Matched ${count} fabricated fly-catch DM(s).`);

  if (doDelete && count > 0) {
    const res = await DirectMessage.deleteMany(filter);
    console.log(`Deleted ${res.deletedCount}.`);
  } else if (!doDelete) {
    console.log('Dry run — re-run with --delete to remove them.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
