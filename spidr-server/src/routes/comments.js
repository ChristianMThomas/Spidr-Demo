const crudRouter = require('../utils/crudRouter');
const Comment = require('../models/Comment');

// Non-comment-authors may like/react to a comment but cannot edit its
// content or attachments. DELETE remains author-only.
const PUBLIC_INTERACTION_FIELDS = [
  'likes',
  'reactions',
];

module.exports = crudRouter(Comment, {
  ownerField: 'user_id',
  publicWriteFields: PUBLIC_INTERACTION_FIELDS,
});
