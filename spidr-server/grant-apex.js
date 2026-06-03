/**
 * Dev script — grant APEX to specific accounts by email.
 * Usage: node grant-apex.js email1@example.com email2@example.com
 */
require('dotenv').config({ path: __dirname + '/src/.env' });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spidr';

const UserSchema = new mongoose.Schema({ email: String }, { strict: false });
const ProfileSchema = new mongoose.Schema({ user_id: String }, { strict: false });
const User    = mongoose.model('User',        UserSchema,   'users');
const Profile = mongoose.model('UserProfile', ProfileSchema, 'userprofiles');

const APEX_PAYLOAD = {
  apex_tier: 'apex',
  apex_features: {
    thread_skin: 'default',
    squad_overclock: true,
    deep_storage: true,
    entry_protocol: 'default',
    activated_at: new Date().toISOString(),
    plan_type: 'dev',
  },
};

async function run() {
  const emails = process.argv.slice(2);
  if (!emails.length) {
    console.error('Usage: node grant-apex.js email1@example.com email2@example.com');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  for (const email of emails) {
    const user = await User.findOne({ email });
    if (!user) { console.log(`✗  ${email} — user not found`); continue; }

    const result = await Profile.updateOne(
      { user_id: user._id.toString() },
      { $set: APEX_PAYLOAD }
    );

    if (result.matchedCount === 0) {
      console.log(`✗  ${email} — profile not found (user ID: ${user._id})`);
    } else {
      console.log(`✓  ${email} — APEX granted`);
    }
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
