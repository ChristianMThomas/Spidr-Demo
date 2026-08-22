#!/usr/bin/env node
/**
 * audit-user-refs.js — check every collection for references to a user id.
 *
 * Read-only. Prints any doc in any user-referencing collection that still
 * points at the given id. Intended use:
 *   • After deleting an account, confirm the cascade left nothing behind.
 *   • Against a suspected-orphaned id, spot pre-existing leaks from before
 *     the current cascade table was complete.
 *
 * Kept in lockstep with `DELETE_CASCADE` and the membership-pull block in
 * `src/routes/accountAdmin.js`. If you add a new collection there, add it
 * here too — this is the verification harness for that file.
 *
 * Usage:
 *   node scripts/audit-user-refs.js --user <userId>
 */
require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const userIdx = args.indexOf('--user');
const USER_ID = userIdx >= 0 ? args[userIdx + 1] : null;
if (!USER_ID) {
  console.error('Usage: node scripts/audit-user-refs.js --user <userId>');
  process.exit(1);
}

// Owned-doc scans. [modelName, filter(uid)]. Mirrors DELETE_CASCADE.
const OWNED = [
  ['User',              (u) => ({ _id: u })],
  ['UserProfile',       (u) => ({ user_id: u })],
  ['BiomassWallet',     (u) => ({ user_id: u })],
  ['EngagementProfile', (u) => ({ user_id: u })],
  ['TensionProfile',    (u) => ({ user_id: u })],
  ['Friend',            (u) => ({ $or: [{ user_id: u }, { friend_id: u }] })],
  ['Follow',            (u) => ({ $or: [{ follower_id: u }, { following_id: u }] })],
  ['DirectMessage',     (u) => ({ $or: [{ sender_id: u }, { recipient_id: u }, { receiver_id: u }] })],
  ['GroupChat',         (u) => ({ owner_id: u })],
  ['GroupChatMessage',  (u) => ({ user_id: u })],
  ['Message',           (u) => ({ $or: [{ user_id: u }, { author_id: u }] })],
  ['Clip',              (u) => ({ author_id: u })],
  ['Comment',           (u) => ({ $or: [{ author_id: u }, { user_id: u }] })],
  ['Feed',              (u) => ({ user_id: u })],
  ['FeedComment',       (u) => ({ author_id: u })],
  ['Collection',        (u) => ({ user_id: u })],
  ['CommunityAsset',    (u) => ({ $or: [{ user_id: u }, { author_id: u }] })],
  ['Module',            (u) => ({ author_id: u })],
  ['InstalledModule',   (u) => ({ user_id: u })],
  ['CustomBot',         (u) => ({ $or: [{ owner_id: u }, { author_id: u }] })],
  ['PushToken',         (u) => ({ user_id: u })],
  ['AudioTrack',        (u) => ({ user_id: u })],
  ['SavedAudio',        (u) => ({ user_id: u })],
  ['Report',            (u) => ({ $or: [
    { reporter_id: u },
    { target_id: u, target_type: 'user' },
    { reviewer_id: u },
    { resolved_by: u },
  ] })],
  ['VoiceSession',      (u) => ({ user_id: u })],
  ['Event',             (u) => ({ $or: [{ created_by: u }, { creator_id: u }] })],
  ['DJSession',         (u) => ({ host_id: u })],
  ['WebMessage',        (u) => ({ $or: [{ sender_id: u }, { recipient_id: u }] })],
  ['AIChatLog',         (u) => ({ user_id: u })],
  ['AIConversation',    (u) => ({ user_id: u })],
];

// Membership-array scans. [modelName, filter(uid), label].
const MEMBERSHIPS = [
  ['Server',    (u) => ({ $or: [
    { 'members.user_id': u },
    { banned_users: u },
    { muted_members: u },
    { owner_id: u },
  ] }), 'members/banned/muted/owner'],
  ['GroupChat', (u) => ({ $or: [
    { 'members.user_id': u },
    { member_ids: u },
  ] }), 'members/member_ids'],
  ['Clip',      (u) => ({ $or: [
    { likes: u },
    { relays: u },
  ] }), 'likes/relays'],
  ['Feed',      (u) => ({ $or: [
    { likes: u },
    { recipient_ids: u },
    { [`reactions.${u.replace(/\./g, '_')}`]: { $exists: true } }, // no-op for our ids
  ] }), 'likes/recipient_ids'],
  ['Event',     (u) => ({ attendees: u }), 'attendees'],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`\nAuditing references to user ${USER_ID}\n${'─'.repeat(60)}`);

  let totalHits = 0;

  console.log('\nOWNED-DOC scans:');
  for (const [name, buildQuery] of OWNED) {
    try {
      const Model = require(`../src/models/${name}`);
      const count = await Model.countDocuments(buildQuery(USER_ID));
      if (count > 0) {
        console.log(`  ✗ ${name.padEnd(22)} ${count} rows still reference this user`);
        totalHits += count;
      } else {
        console.log(`  ✓ ${name.padEnd(22)} clean`);
      }
    } catch (err) {
      console.log(`  ? ${name.padEnd(22)} skipped (${err.message.split('\n')[0]})`);
    }
  }

  console.log('\nMEMBERSHIP-ARRAY scans (docs where user appears in an array):');
  for (const [name, buildQuery, label] of MEMBERSHIPS) {
    try {
      const Model = require(`../src/models/${name}`);
      const count = await Model.countDocuments(buildQuery(USER_ID));
      if (count > 0) {
        console.log(`  ✗ ${name.padEnd(22)} ${count} docs still contain this user in ${label}`);
        totalHits += count;
      } else {
        console.log(`  ✓ ${name.padEnd(22)} clean (${label})`);
      }
    } catch (err) {
      console.log(`  ? ${name.padEnd(22)} skipped (${err.message.split('\n')[0]})`);
    }
  }

  // Feed reactions map — buried inside a Mixed doc, easier to check by pass
  try {
    const Feed = require('../src/models/Feed');
    const withReacts = await Feed.find(
      { reactions: { $exists: true, $ne: {} } },
      { reactions: 1 },
    ).lean();
    let reactHits = 0;
    for (const f of withReacts) {
      for (const bucket of Object.values(f.reactions || {})) {
        if (Array.isArray(bucket) && bucket.includes(USER_ID)) { reactHits++; break; }
      }
    }
    if (reactHits > 0) {
      console.log(`  ✗ Feed.reactions        ${reactHits} feed docs still list this user in reaction buckets`);
      totalHits += reactHits;
    } else {
      console.log(`  ✓ Feed.reactions        clean`);
    }
  } catch { /* skip */ }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(totalHits === 0
    ? `✓ Clean. No lingering references to ${USER_ID}.\n`
    : `✗ ${totalHits} orphan references remain. Run the cascade + sweep-orphans.\n`);

  await mongoose.disconnect();
  process.exit(totalHits === 0 ? 0 : 2);
})().catch(err => { console.error(err); process.exit(1); });
