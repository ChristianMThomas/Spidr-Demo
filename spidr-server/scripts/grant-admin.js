#!/usr/bin/env node
/**
 * grant-admin.js — flip a user's role to "admin".
 *
 * Usage:
 *   node scripts/grant-admin.js you@example.com
 *   node scripts/grant-admin.js you@example.com --revoke    (sets role back to 'user')
 *
 * Reads MONGODB_URI from the same .env the main server uses.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function main() {
  const args = process.argv.slice(2);
  const email = args.find(a => a.includes('@'));
  const revoke = args.includes('--revoke');

  if (!email) {
    console.error('Usage: node scripts/grant-admin.js <email> [--revoke]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/spidr';
  await mongoose.connect(uri);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user found with email "${email}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const newRole = revoke ? 'user' : 'admin';
  user.role = newRole;
  await user.save();

  console.log(`✓ ${email} is now: ${newRole}`);
  console.log(`  user id: ${user._id}`);
  console.log(`  username: ${user.username || '(none)'}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
