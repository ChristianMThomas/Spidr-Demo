#!/usr/bin/env node
/**
 * sweep-orphans.js — one-time cleanup of rows referencing deleted users.
 *
 * The `DELETE /account/me` cascade covers new deletions, but legacy orphans
 * exist (accounts deleted before the cascade was complete, or deleted
 * directly in Atlas). This script removes:
 *   - Friend rows where either user_id or friend_id points to a non-existent User
 *   - DirectMessage rows where any participant is a non-existent User
 *   - GroupChatMessage rows where the author is a non-existent User
 *   - GroupChat.members[] entries whose user_id is a non-existent User
 *
 * Read-side filters in friends.js / directMessages.js already hide orphans
 * from the UI — this script permanently removes them from the DB so the
 * per-request filter has less to check.
 *
 * Usage:
 *   node scripts/sweep-orphans.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { sweepOrphans } = require('../src/routes/accountAdmin');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/spidr';
  await mongoose.connect(uri);
  console.log('Connected. Running sweep…');
  const results = await sweepOrphans();
  console.log('Removed:');
  for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Sweep failed:', err);
  process.exit(1);
});
