async function toggleReaction(Model, id, userId, emoji) {
  if (typeof emoji !== 'string' || !emoji || emoji.length > 32 || /[.$\s]/u.test(emoji)) {
    throw Object.assign(new Error('A valid emoji is required'), { status: 400 });
  }
  const field = 'reactions.' + emoji;
  const users = { $ifNull: ['$' + field, []] };
  const next = { $cond: [{ $in: [userId, users] }, { $setDifference: [users, [userId]] }, { $concatArrays: [users, [userId]] }] };
  return Model.findByIdAndUpdate(id, [{ $set: { [field]: { $cond: [{ $eq: [{ $size: next }, 0] }, '$$REMOVE', next] } } }], { new: true }).lean();
}
module.exports = toggleReaction;
