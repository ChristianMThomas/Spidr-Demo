const User = require('../models/User');

/**
 * Drop rows whose referenced counterparty user no longer exists.
 *
 * A row survives only if EVERY refField resolves to a live User. Used on
 * hot read paths (Friend list, DirectMessage list) so deleted accounts stop
 * appearing as ghost entries in the UI when a cascade missed a row (legacy
 * orphans, deletions made directly in Atlas, partial-cascade failures). The
 * caller (current user) is usually one of the participants and always live,
 * so requiring ALL participants live is what actually drops ghost rows.
 *
 * One User.find round-trip per call, `_id`-only projection — cheap even at
 * a few hundred ids.
 *
 * @param {Array<Object>} rows        pre-loaded rows (lean or normalised)
 * @param {string|string[]} refFields property name(s) on each row that hold a user id
 * @returns {Promise<Array<Object>>}  filtered rows
 */
async function filterOrphans(rows, refFields) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  const fields = Array.isArray(refFields) ? refFields : [refFields];

  const idSet = new Set();
  for (const row of rows) {
    for (const f of fields) {
      const v = row?.[f];
      if (v) idSet.add(v.toString());
    }
  }
  if (idSet.size === 0) return rows;

  const existing = await User.find(
    { _id: { $in: Array.from(idSet) } },
    { _id: 1 }
  ).lean();
  const live = new Set(existing.map(u => u._id.toString()));

  return rows.filter(row =>
    fields.every(f => {
      const v = row?.[f];
      return v && live.has(v.toString());
    })
  );
}

module.exports = { filterOrphans };
