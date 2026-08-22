#!/usr/bin/env node
/**
 * fix-stuck-friend-requests.js
 *
 * Backfills or clears Friend rows stuck in the pre-override state where
 * only the sender's `pending_outgoing` row exists (the mirror
 * `pending_incoming` row was silently 409'd by crudRouter's user_id
 * force-overwrite). See spidr-server/src/routes/friends.js override.
 *
 * For every `pending_outgoing` row without a matching `pending_incoming`
 * mirror:
 *   --backfill (default): create the missing mirror row so the recipient
 *                         sees the pending incoming request.
 *   --delete:             drop the orphaned outgoing row instead.
 *
 * Dry-run by default; pass --apply to actually write.
 *
 * Usage:
 *   node scripts/fix-stuck-friend-requests.js                    # dry run, backfill mode
 *   node scripts/fix-stuck-friend-requests.js --apply            # backfill for real
 *   node scripts/fix-stuck-friend-requests.js --delete --apply   # nuke stuck rows instead
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Friend = require('../src/models/Friend');
const UserProfile = require('../src/models/UserProfile');
const User = require('../src/models/User');

const APPLY   = process.argv.includes('--apply');
const DELETE  = process.argv.includes('--delete');
const MODE    = DELETE ? 'delete' : 'backfill';

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }
  await mongoose.connect(uri);
  console.log(`Connected. Mode=${MODE} apply=${APPLY}\n`);

  // Desynced accepts: recipient's row is `accepted` but sender's mirror is
  // still pending — the recipient's accept 403'd on the sender's row before
  // the PATCH override existed. Flip those mirrors to `accepted`.
  const accepted = await Friend.find({ status: 'accepted' }).lean();
  let desynced = 0;
  for (const row of accepted) {
    const mirror = await Friend.findOne({
      user_id:   row.friend_id,
      friend_id: row.user_id,
    }).lean();
    if (!mirror) continue;
    if (mirror.status === 'accepted' || mirror.status === 'blocked') continue;
    desynced++;
    console.log(`  [resync accepted] ${mirror._id} ${mirror.user_id} -> ${mirror.friend_id} (${mirror.status} -> accepted)`);
    if (APPLY) await Friend.updateOne({ _id: mirror._id }, { $set: { status: 'accepted' } });
  }
  console.log(`Resynced ${desynced} desynced accept mirrors.\n`);

  // Orphan accepts: `accepted` with NO mirror row at all. Recipient's
  // friends list stays empty on this pair. Backfill the mirror as
  // accepted. Live PATCH now self-heals (friends.js:141), so this only
  // matters for legacy rows created before that upsert existed.
  let orphaned = 0;
  for (const row of accepted) {
    const mirror = await Friend.findOne({
      user_id:   row.friend_id,
      friend_id: row.user_id,
    }).lean();
    if (mirror) continue;
    orphaned++;
    const [senderProfile, senderUser, targetUser] = await Promise.all([
      UserProfile.findOne({ user_id: row.user_id }).lean(),
      User.findById(row.user_id).lean(),
      User.findById(row.friend_id).lean(),
    ]);
    if (!targetUser) {
      console.log(`  [drop orphan accept — target gone] ${row._id}`);
      if (APPLY) await Friend.deleteOne({ _id: row._id });
      continue;
    }
    const senderName   = senderProfile?.display_name || senderUser?.full_name || senderUser?.username || 'User';
    const senderAvatar = senderProfile?.avatar_url   || senderUser?.avatar_url || '';
    console.log(`  [backfill accepted mirror] ${row.friend_id} <- ${row.user_id} (${senderName})`);
    if (APPLY) {
      try {
        await Friend.create({
          user_id:      row.friend_id,
          friend_id:    row.user_id,
          friend_name:  senderName,
          friend_avatar: senderAvatar,
          friend_discriminator: senderProfile?.discriminator || '',
          status: 'accepted',
        });
      } catch (e) { if (e.code !== 11000) throw e; }
    }
  }
  console.log(`Backfilled ${orphaned} orphan accepted mirrors.\n`);

  // Self-friendship rows (user_id === friend_id) — never valid. Created when
  // the old crudRouter rewrote the client's mirror-row user_id to the sender.
  const selfies = await Friend.find({ $expr: { $eq: ['$user_id', '$friend_id'] } }).lean();
  console.log(`Found ${selfies.length} self-friendship rows (user_id == friend_id).`);
  for (const row of selfies) {
    console.log(`  [delete self] ${row._id} user=${row.user_id} status=${row.status}`);
    if (APPLY) await Friend.deleteOne({ _id: row._id });
  }

  // Orphan pending_incoming: recipient sees an incoming request but the
  // sender has no matching pending_outgoing row (usually because the sender
  // deleted their side via the old unmirrored crudRouter DELETE). Delete
  // the ghost — sender can send a fresh request. Live DELETE now removes
  // both sides (friends.js:170), so this only matters for legacy rows.
  const incoming = await Friend.find({ status: 'pending_incoming' }).lean();
  let ghostIncoming = 0;
  for (const row of incoming) {
    const mirror = await Friend.findOne({
      user_id:   row.friend_id,
      friend_id: row.user_id,
    }).lean();
    if (mirror) continue;
    ghostIncoming++;
    console.log(`  [delete ghost incoming] ${row._id} ${row.user_id} <- ${row.friend_id} (${row.friend_name || '?'})`);
    if (APPLY) await Friend.deleteOne({ _id: row._id });
  }
  console.log(`Deleted ${ghostIncoming} ghost pending_incoming rows.\n`);

  const outgoing = await Friend.find({ status: 'pending_outgoing' }).lean();
  console.log(`Found ${outgoing.length} pending_outgoing rows.`);

  let stuck = [];
  for (const row of outgoing) {
    const mirror = await Friend.findOne({
      user_id:   row.friend_id,
      friend_id: row.user_id,
    }).lean();
    if (!mirror) stuck.push(row);
  }
  console.log(`${stuck.length} of those have no mirror row on the recipient side.\n`);

  if (stuck.length === 0) { await mongoose.disconnect(); return; }

  for (const row of stuck) {
    if (MODE === 'delete') {
      console.log(`  [delete] ${row.user_id} -> ${row.friend_id} (${row.friend_name || '?'})`);
      if (APPLY) await Friend.deleteOne({ _id: row._id });
      continue;
    }

    const [senderProfile, senderUser, targetUser] = await Promise.all([
      UserProfile.findOne({ user_id: row.user_id }).lean(),
      User.findById(row.user_id).lean(),
      User.findById(row.friend_id).lean(),
    ]);
    if (!targetUser) {
      console.log(`  [skip] target user ${row.friend_id} no longer exists — deleting orphan`);
      if (APPLY) await Friend.deleteOne({ _id: row._id });
      continue;
    }
    const senderName   = senderProfile?.display_name || senderUser?.full_name || senderUser?.username || 'User';
    const senderAvatar = senderProfile?.avatar_url   || senderUser?.avatar_url || '';

    console.log(`  [backfill] pending_incoming for ${row.friend_id} <- ${row.user_id} (${senderName})`);
    if (APPLY) {
      try {
        await Friend.create({
          user_id:      row.friend_id,
          friend_id:    row.user_id,
          friend_name:  senderName,
          friend_avatar: senderAvatar,
          friend_discriminator: senderProfile?.discriminator || '',
          status: 'pending_incoming',
        });
      } catch (err) {
        if (err.code === 11000) console.log('    already exists, skipped');
        else throw err;
      }
    }
  }

  console.log(`\n${APPLY ? 'Applied' : 'Dry run only. Re-run with --apply to commit.'}`);
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
