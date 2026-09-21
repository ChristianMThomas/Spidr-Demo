const mongoose = require('mongoose');
const Friend = require('../models/Friend');
const Profile = require('../models/UserProfile');
const Feed = require('../models/Feed');
const Comment = require('../models/FeedComment');

const id = value => /^[a-f0-9]{24}$/i.test(String(value || '')) ? new mongoose.Types.ObjectId(String(value)) : null;
const normalise = doc => ({ ...doc, id: String(doc._id) });
async function viewerContext(userId) {
  const uid = String(userId);
  const rows = await Friend.find({ $or: [{ user_id: uid }, { friend_id: uid }], status: { $in: ['accepted', 'blocked'] } }).select('user_id friend_id status').lean();
  const friends = new Set(), blocked = new Set();
  for (const row of rows) {
    const other = row.user_id === uid ? row.friend_id : row.user_id;
    if (row.status === 'blocked') blocked.add(other);
    else if (row.user_id === uid) friends.add(other);
  }
  for (const other of blocked) friends.delete(other);
  return { uid, friends: [...friends], blocked: [...blocked] };
}
function authorAccess(field, profilePath, context) {
  return { $or: [
    { [field]: context.uid },
    { $and: [
      { [field]: { $nin: context.blocked } },
      { [profilePath + '.hide_activity']: { $ne: true } },
      { $or: [{ [profilePath + '.is_private']: { $ne: true } }, { [field]: { $in: context.friends } }] },
    ] },
  ] };
}
function profileLookup(field, as) {
  return { $lookup: { from: Profile.collection.name, localField: field, foreignField: 'user_id', as, pipeline: [{ $project: { is_private: 1, hide_activity: 1 } }] } };
}
function feedStages(context) {
  return [
    { $match: { $or: [
      { user_id: context.uid },
      { $and: [
        { is_hidden: { $ne: true } },
        { $or: [{ recipient_ids: { $exists: false } }, { recipient_ids: { $size: 0 } }, { recipient_ids: context.uid }] },
      ] },
    ] } },
    profileLookup('user_id', '_privacy'),
    { $match: authorAccess('user_id', '_privacy', context) },
    { $unset: '_privacy' },
  ];
}
function commentStages(context) {
  return [
    profileLookup('author_id', '_privacy'),
    { $match: authorAccess('author_id', '_privacy', context) },
    { $addFields: { _parentId: { $convert: { input: '$parent_comment_id', to: 'objectId', onError: null, onNull: null } } } },
    { $lookup: { from: Comment.collection.name, localField: '_parentId', foreignField: '_id', as: '_parent' } },
    profileLookup('_parent.author_id', '_parentPrivacy'),
    { $match: { $or: [
      { parent_comment_id: null },
      { $and: [
        { '_parent.0': { $exists: true } },
        { $expr: { $eq: [{ $arrayElemAt: ['$_parent.feed_id', 0] }, '$feed_id'] } },
        authorAccess('_parent.author_id', '_parentPrivacy', context),
      ] },
    ] } },
    { $unset: ['_privacy', '_parentId', '_parent', '_parentPrivacy'] },
  ];
}
async function visibleFeed(feedId, context) {
  const objectId = id(feedId);
  if (!objectId) return null;
  return (await Feed.aggregate([{ $match: { _id: objectId } }, ...feedStages(context), { $limit: 1 }]))[0] || null;
}
async function visibleComment(commentId, context) {
  const objectId = id(commentId);
  if (!objectId) return null;
  const comment = (await Comment.aggregate([{ $match: { _id: objectId } }, ...commentStages(context), { $limit: 1 }]))[0];
  if (!comment || !await visibleFeed(comment.feed_id, context)) return null;
  return comment;
}
async function withVisibleCounts(feeds, context) {
  if (!feeds.length) return [];
  const counts = await Comment.aggregate([
    { $match: { feed_id: { $in: feeds.map(feed => String(feed._id)) } } },
    ...commentStages(context), { $group: { _id: '$feed_id', count: { $sum: 1 } } },
  ]);
  const byFeed = new Map(counts.map(row => [row._id, row.count]));
  return feeds.map(feed => ({ ...normalise(feed), comments_count: byFeed.get(String(feed._id)) || 0 }));
}
module.exports = { id, normalise, viewerContext, feedStages, commentStages, visibleFeed, visibleComment, withVisibleCounts };
