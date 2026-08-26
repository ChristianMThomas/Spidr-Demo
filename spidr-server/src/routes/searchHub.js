const express = require('express');
const authMW = require('../middleware/auth');
const Message = require('../models/Message');
const DirectMessage = require('../models/DirectMessage');
const GroupChatMessage = require('../models/GroupChatMessage');
const GroupChat = require('../models/GroupChat');
const Server = require('../models/Server');
const { extractMessageMeta } = require('../utils/messageMeta');

/**
 * Search & Media Hub — one endpoint serving keyword search, the image
 * gallery, and the link list across all three chat surfaces.
 *
 *   GET /search-hub?scope=dm|group|server&id=<id>[&channel_id=]
 *                  &view=search|images|links
 *                  [&q=keyword][&from=<user_id>][&limit=]
 *
 * Design notes:
 *
 *  • Keyword search uses the $text index first (relevance-ranked), then falls
 *    back to an escaped regex — $text matches whole words only, so "hel"
 *    wouldn't find "hello" without the second pass.
 *
 *  • Images/Links query the indexed boolean flags, but ALSO accept legacy
 *    documents written before those flags existed (attachments present, or
 *    body contains http). Those get their metadata derived on read, so the
 *    tabs work on existing history with no migration.
 *
 *  • Every scope is membership-guarded. A conversation id is not a
 *    capability — without these checks anyone could read any DM by guessing
 *    a conversation id.
 */

const router = express.Router();

function normalize(doc) {
  const { _id, __v, score, ...rest } = doc;
  const out = { id: _id?.toString(), ...rest };
  // Derive metadata for legacy rows that predate the write-time hook.
  if (out.has_images === undefined || out.has_links === undefined ||
      (!out.media_urls?.length && !out.link_urls?.length)) {
    const meta = extractMessageMeta(out.content, out.attachments);
    out.has_images = out.has_images ?? meta.has_images;
    out.has_links  = out.has_links  ?? meta.has_links;
    if (!out.media_urls?.length) out.media_urls = meta.media_urls;
    if (!out.link_urls?.length)  out.link_urls  = meta.link_urls;
  }
  return out;
}

/** Resolve the model + base filter + author field for a scope, with auth. */
async function resolveScope(req) {
  const uid = req.user?.id?.toString();
  const { scope, id, channel_id } = req.query;

  if (scope === 'dm') {
    if (!id) throw Object.assign(new Error('id (conversation_id) required'), { status: 400 });
    // Authorization: the requester must be a participant in this conversation.
    const sample = await DirectMessage.findOne({ conversation_id: id })
      .select('sender_id receiver_id recipient_id').lean();
    if (!sample) return { Model: DirectMessage, filter: { conversation_id: id }, authorField: 'sender_id' };
    const parties = [sample.sender_id, sample.receiver_id, sample.recipient_id].filter(Boolean).map(String);
    if (!parties.includes(uid)) throw Object.assign(new Error('Not your conversation'), { status: 403 });
    return { Model: DirectMessage, filter: { conversation_id: id }, authorField: 'sender_id' };
  }

  if (scope === 'group') {
    if (!id) throw Object.assign(new Error('id (group_id) required'), { status: 400 });
    const group = await GroupChat.findById(id).select('members').lean();
    if (!group) throw Object.assign(new Error('Group not found'), { status: 404 });
    const isMember = (group.members || []).some(m => String(typeof m === 'string' ? m : m?.user_id) === uid);
    if (!isMember) throw Object.assign(new Error('Not a member of this group'), { status: 403 });
    return { Model: GroupChatMessage, filter: { group_id: id }, authorField: 'user_id' };
  }

  if (scope === 'server') {
    if (!id) throw Object.assign(new Error('id (server_id) required'), { status: 400 });
    const server = await Server.findById(id).select('owner_id members').lean();
    if (!server) throw Object.assign(new Error('Server not found'), { status: 404 });
    const isMember = String(server.owner_id) === uid ||
      (server.members || []).some(m => String(m.user_id) === uid);
    if (!isMember) throw Object.assign(new Error('Not a member of this server'), { status: 403 });
    const filter = { server_id: id };
    if (channel_id) filter.channel_id = channel_id;
    return { Model: Message, filter, authorField: 'user_id' };
  }

  throw Object.assign(new Error('scope must be dm, group, or server'), { status: 400 });
}

router.get('/', authMW, async (req, res) => {
  try {
    const { view = 'search', q, from, limit } = req.query;
    const { Model, filter, authorField } = await resolveScope(req);
    const cap = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    // from:<user> narrows any view to a single author.
    const scoped = { ...filter };
    if (from) scoped[authorField] = from;

    // ── Images ─────────────────────────────────────────────────────────
    if (view === 'images') {
      const docs = await Model.find({
        ...scoped,
        $or: [
          { has_images: true },
          // Legacy rows: no flag yet, but they carry attachments.
          { has_images: { $exists: false }, attachments: { $exists: true, $ne: [] } },
          { has_images: { $exists: false }, content: { $regex: 'https?://\\S+\\.(png|jpe?g|gif|webp)', $options: 'i' } },
        ],
      })
        .sort({ created_date: -1 })
        .limit(cap)
        .lean();
      return res.json(docs.map(normalize).filter(d => d.media_urls?.length));
    }

    // ── Links ──────────────────────────────────────────────────────────
    if (view === 'links') {
      const docs = await Model.find({
        ...scoped,
        $or: [
          { has_links: true },
          { has_links: { $exists: false }, content: { $regex: 'https?://', $options: 'i' } },
        ],
      })
        .sort({ created_date: -1 })
        .limit(cap)
        .lean();
      return res.json(docs.map(normalize).filter(d => d.link_urls?.length));
    }

    // ── Keyword search ─────────────────────────────────────────────────
    const term = (q || '').trim();
    if (!term) {
      // from: with no keyword is still a valid query ("everything Alice said").
      if (from) {
        const docs = await Model.find(scoped).sort({ created_date: -1 }).limit(cap).lean();
        return res.json(docs.map(normalize));
      }
      return res.json([]);
    }

    let docs = await Model.find(
      { ...scoped, $text: { $search: term } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).limit(cap).lean();

    // $text is whole-word only; partial queries need the regex pass.
    if (docs.length === 0) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      docs = await Model.find({ ...scoped, content: { $regex: escaped, $options: 'i' } })
        .sort({ created_date: -1 })
        .limit(cap)
        .lean();
    }

    res.json(docs.map(normalize));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
