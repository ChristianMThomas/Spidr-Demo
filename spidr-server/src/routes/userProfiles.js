const crudRouter = require('../utils/crudRouter');
const UserProfile = require('../models/UserProfile');

// ownerField locks PATCH/DELETE to the profile owner. Without this,
// crudRouter's isOwner() returns true unconditionally and any authenticated
// user could PATCH /user-profiles/<anyone>. Combined with PROTECTED_FIELDS
// blocking apex_tier + stripe_* writes, the tier can only be changed via
// verified Stripe webhook.
module.exports = crudRouter(UserProfile, { ownerField: 'user_id' });
