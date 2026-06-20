#!/usr/bin/env node
/**
 * dedupe-friends.js — collapse duplicate Friend rows.
 *
 * The Friend collection's unique index on (user_id, friend_id) is `sparse`,
 * so older rows with null fields slipped past it. Over time the same
 * friendship has accumulated multiple rows on each side, inflating the
 * count surfaced to mobile users.
 *
 * Rules per (user_id, friend_id) group:
 *   - Keep one row.
 *   - Prefer status === 'accepted' over anything else.
 *   - Among accepted rows, keep the oldest (created_date asc) and delete the rest.
 *   - Also drop self-friendships where user_id === friend_id.
 *
 * Usage:
 *   node scripts/dedupe-friends.js              # dry run, prints what it WOULD delete
 *   node scripts/dedupe-friends.js --apply      # actually deletes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Friend = require('../src/models/Friend');

const STATUS_PRIORITY = {
  accepted: 0,
  pending: 1,
  pending_outgoing: 1,
  pending_incoming: 1,
  blocked: 2,
};

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/spidr';
  await mongoose.connect(uri);

  console.log(`Mode: ${apply ? 'APPLY (destructive)' : 'DRY RUN'}`);

  const all = await Friend.find({}).lean();
  console.log(`Loaded ${all.length} Friend rows.`);

  // Group by (user_id, friend_id)
  const groups = new Map();
  const selfRows = [];
  let nullKeyed = 0;

  for (const row of all) {
    if (!row.user_id || !row.friend_id) { nullKeyed++; continue; }
    if (String(row.user_id) === String(row.friend_id)) {
      selfRows.push(row);
      continue;
    }
    const key = `${row.user_id}|${row.friend_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const toDelete = [];

  // self-friendship rows always go
  for (const r of selfRows) toDelete.push(r._id);

  let dupeGroups = 0;
  for (const [, rows] of groups) {
    if (rows.length <= 1) continue;
    dupeGroups++;
    rows.sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 9;
      const pb = STATUS_PRIORITY[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.created_date || 0) - new Date(b.created_date || 0);
    });
    for (let i = 1; i < rows.length; i++) toDelete.push(rows[i]._id);
  }

  console.log(`Groups with duplicates: ${dupeGroups}`);
  console.log(`Self-friendship rows:   ${selfRows.length}`);
  console.log(`Null-keyed rows:        ${nullKeyed} (left alone — fix upstream)`);
  console.log(`Rows queued for delete: ${toDelete.length}`);

  if (!apply) {
    console.log('\nDry run — re-run with --apply to delete.');
    await mongoose.disconnect();
    return;
  }

  if (toDelete.length === 0) {
    console.log('Nothing to delete. Done.');
    await mongoose.disconnect();
    return;
  }

  const result = await Friend.deleteMany({ _id: { $in: toDelete } });
  console.log(`Deleted ${result.deletedCount} rows.`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
