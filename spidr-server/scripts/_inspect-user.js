#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const UserProfile = require('../src/models/UserProfile');
const Friend = require('../src/models/Friend');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const targets = ['Auxtin', 'Auxtin123', 'ChrisAlt', 'NotChris'];
  for (const name of targets) {
    const u = await User.findOne({ $or: [{ username: name }, { full_name: name }] }).lean();
    if (!u) { console.log(`${name}: NOT FOUND\n`); continue; }
    const p = await UserProfile.findOne({ user_id: String(u._id) }).lean();
    const asUser = await Friend.find({ user_id: String(u._id) }).lean();
    const asFriend = await Friend.find({ friend_id: String(u._id) }).lean();
    console.log(`--- ${name} ---`);
    console.log(`  _id=${u._id}  username=${u.username}  full_name=${u.full_name}  deleted=${u.deleted || false}  disabled=${u.disabled || false}`);
    console.log(`  profile display_name=${p?.display_name || '(none)'}  discriminator=${p?.discriminator || '(none)'}`);
    console.log(`  rows where user_id=me: ${asUser.length}`);
    for (const r of asUser) console.log(`    -> ${r.friend_id}  ${r.status}  name=${r.friend_name}`);
    console.log(`  rows where friend_id=me: ${asFriend.length}`);
    for (const r of asFriend) console.log(`    <- ${r.user_id}  ${r.status}  name=${r.friend_name}`);
    console.log('');
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
