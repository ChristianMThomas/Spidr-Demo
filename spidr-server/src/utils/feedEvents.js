/**
 * feedEvents.js — single entry point for writing Feed records.
 *
 * Each function is fire-and-forget: failures are logged but never
 * propagate, because the activity feed is decorative and should never
 * block a user action.
 */
const Feed = require('../models/Feed');

async function safeCreate(doc) {
  try {
    await Feed.create(doc);
  } catch (err) {
    console.warn('Feed write failed:', err?.message);
  }
}

/** User joined a server */
exports.serverJoin = ({ user_id, user_name, user_avatar, server_id, server_name }) =>
  safeCreate({
    type: 'server_join',
    user_id, user_name, user_avatar, server_id,
    title: `Joined ${server_name || 'a server'}`,
  });

/** Two users became friends — write one event, attributed to the accepter */
exports.friendAccepted = ({ user_id, user_name, user_avatar, friend_id, friend_name }) =>
  safeCreate({
    type: 'friend_added',
    user_id, user_name, user_avatar, target_id: friend_id,
    title: `Became friends with ${friend_name || 'someone'}`,
  });

/** Clip posted */
exports.clipPosted = ({ user_id, user_name, user_avatar, clip_id, image_url, title }) =>
  safeCreate({
    type: 'clip_posted',
    user_id, user_name, user_avatar, target_id: clip_id, image_url,
    title: title || 'Posted a new clip',
  });

/** Custom milestone — e.g., "100 messages sent" */
exports.milestone = ({ user_id, user_name, user_avatar, title, content }) =>
  safeCreate({
    type: 'milestone',
    user_id, user_name, user_avatar,
    title, content,
  });

/** System announcement — pinned to the top of every feed */
exports.announcement = ({ title, content, image_url }) =>
  safeCreate({
    type: 'announcement',
    user_id: 'system',
    user_name: 'Spidr',
    title, content, image_url,
    is_pinned: true,
  });

/**
 * @-mention — targeted to a specific user.
 * Fires once per mentioned user (not once per message). The sender appears
 * as `user_id`/`user_name`; the receiver is in `recipient_ids`.
 *
 *   context: 'server' | 'dm' | 'group' | 'comment'
 *   server_id / channel_id / message_id are used by the UI to deep-link
 *   back to the original message.
 */
exports.mention = ({
  sender_id, sender_name, sender_avatar,
  recipient_id,
  context,
  server_id, server_name, channel_id, channel_name, message_id,
  snippet,
}) =>
  safeCreate({
    type: 'mention',
    user_id: sender_id,
    user_name: sender_name || 'Someone',
    user_avatar: sender_avatar || '',
    recipient_ids: [recipient_id],
    title: context === 'server' && server_name && channel_name
      ? `Mentioned you in #${channel_name} (${server_name})`
      : context === 'group'
        ? 'Mentioned you in a group chat'
        : context === 'comment'
          ? 'Mentioned you in a comment'
          : 'Mentioned you in a DM',
    content: snippet || '',
    server_id, channel_id, target_id: message_id, message_id,
  });

/**
 * Profile update — when someone updates their display_name / bio / avatar /
 * banner / username effect, fire a feed entry visible only to their friends.
 *
 *   user_id is the updater
 *   recipient_ids should be the friend IDs (resolved by the caller)
 *   changed: array like ['bio', 'avatar_url'] — used to phrase the title
 */
exports.profileUpdate = ({ user_id, user_name, user_avatar, recipient_ids, changed }) => {
  if (!recipient_ids || recipient_ids.length === 0) return; // no audience, skip
  const changeLabels = {
    display_name:    'changed their display name',
    bio:             'updated their bio',
    avatar_url:      'changed their avatar',
    banner_url:      'updated their profile banner',
    username_color:  'changed their username color',
    username_effect: 'changed their username style',
    pronouns:        'updated their pronouns',
  };
  const labels = (changed || []).map(c => changeLabels[c]).filter(Boolean);
  const title = labels.length === 0
    ? 'Updated their profile'
    : labels.length === 1
      ? labels[0].charAt(0).toUpperCase() + labels[0].slice(1)
      : `Updated their profile (${changed.length} changes)`;
  return safeCreate({
    type: 'profile_update',
    user_id,
    user_name: user_name || 'A friend',
    user_avatar: user_avatar || '',
    recipient_ids,
    title,
  });
};
