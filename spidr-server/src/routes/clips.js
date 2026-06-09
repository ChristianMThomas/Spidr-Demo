const crudRouter = require('../utils/crudRouter');
const Clip = require('../models/Clip');

// Non-owners (anyone authenticated viewing someone else's clip) may PATCH
// only these engagement fields. Editing the caption, swapping the video,
// pinning, overclocking, etc. all stay owner-only. DELETE is owner-only.
const PUBLIC_INTERACTION_FIELDS = [
  'likes',           // toggle membership in the likes array
  'reactions',       // emoji reaction map
  'comments_count',  // bumped by the client when a comment posts (legacy)
  'shares_count',    // bumped on share
  'views',           // bumped on view
];

module.exports = crudRouter(Clip, {
  ownerField: 'author_id',
  publicWriteFields: PUBLIC_INTERACTION_FIELDS,
});
