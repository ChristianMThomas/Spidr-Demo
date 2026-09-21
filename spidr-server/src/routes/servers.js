const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMiddleware = require('../middleware/auth');
const Server = require('../models/Server');
const User = require('../models/User');
const { randomBytes } = require('node:crypto');
const { isMember, canManage, canUpdateNicknames, isListed, summary, discoveryFields } = require('../utils/serverAccess');

const router = express.Router();
router.use('/', require('./serverDiscovery'));

// Strip members / banned_users referencing users that no longer exist.
// One User query per request covers every server passed in. Read-side
// hygiene so ghost members disappear immediately after a deletion, without
// waiting for the /admin/sweep-orphans cron.
async function pruneGhostMembers(servers) {
  const list = Array.isArray(servers) ? servers : [servers];
  const ids = new Set();
  for (const s of list) {
    for (const m of (s?.members || [])) if (m?.user_id) ids.add(m.user_id.toString());
    for (const b of (s?.banned_users || [])) if (b) ids.add(b.toString());
  }
  if (ids.size === 0) return servers;
  const live = new Set(
    (await User.find({ _id: { $in: Array.from(ids) } }, { _id: 1 }).lean())
      .map(u => u._id.toString())
  );
  for (const s of list) {
    if (Array.isArray(s?.members)) s.members = s.members.filter(m => m?.user_id && live.has(m.user_id.toString()));
    if (Array.isArray(s?.banned_users)) s.banned_users = s.banned_users.filter(b => b && live.has(b.toString()));
  }
  return servers;
}

// Helper: generate a short alphanumeric invite code
function generateInviteCode() {
  return randomBytes(12).toString('base64url');
}

// POST /servers/:id/invite — generate (or rotate) a server invite code.
// Any member can generate. Body: { rotate?: boolean }
// Returns { invite_code, invite_url }.
router.post('/:id/invite', authMiddleware, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const userId = req.user?.id;
    const isOwner = server.owner_id?.toString() === userId?.toString();
    const isMember = (server.members || []).some(m => m.user_id === userId);
    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Not a member of this server' });
    }

    // Reuse existing code unless caller asked to rotate
    if (!server.invite_code || req.body?.rotate) {
      let code;
      let attempts = 0;
      do {
        code = generateInviteCode();
        attempts++;
      } while (await Server.exists({ invite_code: code }) && attempts < 5);
      server.invite_code = code;
      await server.save();
    }

    res.json({
      invite_code: server.invite_code,
      invite_url: `spidr://invite/${server.invite_code}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /servers/lookup/:code — preview a server by invite code (no join)
router.get('/lookup/:code', async (req, res) => {
  try {
    const server = await Server.findOne({ invite_code: req.params.code }).lean();
    if (!server) return res.status(404).json({ error: 'Invalid invite code' });
    res.json({
      id: server._id.toString(),
      name: server.name,
      description: server.description,
      icon_url: server.icon_url,
      banner_url: server.banner_url,
      member_count: (server.members || []).length,
      tags: server.tags || [],
      rules: server.rules || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /servers/:serverId/roles/reorder — batch update role positions.
// Body: { order: [{ roleId, position }, ...] }. Admin/owner only.
router.put('/:serverId/roles/reorder', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const userId = req.user?.id || req.user?._id?.toString();
    const isOwner = server.owner_id === userId;
    const isAdmin = isOwner || (server.members || []).some(m => (m.user_id === userId) && (['admin','mod','moderator','owner'].includes(String(m.role||'').toLowerCase())));
    if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });

    const posById = new Map(order.map(o => [String(o.roleId), Number(o.position)]));
    server.roles = (server.roles || []).map(r => {
      const key = String(r.id ?? r.name);
      return posById.has(key) ? { ...r, position: posById.get(key) } : r;
    });
    server.markModified('roles');
    await server.save();
    res.json({ ok: true, roles: server.roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /servers/:serverId/roles/:roleId — rename a role. Admin/owner only.
router.patch('/:serverId/roles/:roleId', authMiddleware, async (req, res) => {
  try {
    const { serverId, roleId } = req.params;
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const userId = req.user?.id || req.user?._id?.toString();
    const isOwner = server.owner_id === userId;
    const isAdmin = isOwner || (server.members || []).some(m => (m.user_id === userId) && (['admin','mod','moderator','owner'].includes(String(m.role||'').toLowerCase())));
    if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });

    let found = false;
    server.roles = (server.roles || []).map(r => {
      if (String(r.id ?? r.name) === String(roleId)) { found = true; return { ...r, name: name.trim() }; }
      return r;
    });
    if (!found) return res.status(404).json({ error: 'Role not found' });
    server.markModified('roles');
    await server.save();
    res.json({ ok: true, roles: server.roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings changes require server permissions; joining uses dedicated routes.
const SETTINGS_FIELDS = new Set(['name', 'description', 'icon_url', 'banner_url', 'category', 'tags', 'rules', 'is_public', 'is_discoverable', 'allow_join_requests', 'members', 'banned_users', 'channels', 'roles', 'emojis', 'muted_members', 'timeouts', 'hidden_roles', 'show_role_labels', 'sanctuary', 'airlock', 'bots', 'bot_config']);
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const before = await Server.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ error: 'Not found' });
    const userId = String(req.user.id);
    const member = (before.members || []).find(m => m.user_id === userId);
    const moderationOnly = Object.keys(req.body).every(k => ['members', 'banned_users', 'muted_members', 'timeouts'].includes(k));
    const isModerator = ['mod', 'moderator'].includes(String(member?.role || '').toLowerCase());
    const nicknameOnly = canUpdateNicknames(before, userId, req.body);
    if (!canManage(before, userId) && !(isModerator && moderationOnly) && !nicknameOnly) return res.status(403).json({ error: 'Server administrator permission required' });
    if (Object.keys(req.body).some(k => !SETTINGS_FIELDS.has(k))) return res.status(400).json({ error: 'Unsupported server setting' });
    const safeBody = { ...req.body, ...discoveryFields(req.body) };
    if (safeBody.members) {
      if (!Array.isArray(safeBody.members)) return res.status(400).json({ error: 'Invalid members' });
      if (isModerator && !canManage(before, userId) && !nicknameOnly) {
        const previous = new Map((before.members || []).map(m => [m.user_id, m]));
        if (safeBody.members.some(m => !previous.has(m.user_id) || JSON.stringify(m) !== JSON.stringify(previous.get(m.user_id))) ||
          (before.members || []).some(m => canManage(before, m.user_id) && !safeBody.members.some(n => n.user_id === m.user_id))) {
          return res.status(403).json({ error: 'Moderators may only remove non-admin members' });
        }
      }
    }
    const updated = await Server.findOneAndUpdate(
      { _id: before._id, updatedAt: before.updatedAt }, { $set: safeBody }, { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(409).json({ error: 'Server changed. Please refresh and try again' });
    res.json(visibleServer(updated, userId));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

function visibleServer(doc, userId) {
  if (!isMember(doc, userId)) return summary(doc, userId);
  const { _id, __v, ...rest } = doc;
  if (!canManage(doc, userId)) delete rest.join_requests;
  return { id: String(_id), ...rest };
}

// GET overrides — same behavior as crudRouter but with ghost-member pruning
// applied before responding, so deleted users never render in the sidebar.
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await Server.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!isMember(doc, req.user.id) && (!isListed(doc) || (doc.banned_users || []).includes(String(req.user.id)))) return res.status(404).json({ error: 'Not found' });
    await pruneGhostMembers(doc);
    res.json(visibleServer(doc, req.user.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { _orderBy, _limit, ...filters } = req.query;
    const query = {};
    for (const [k, v] of Object.entries(filters)) {
      if (k.startsWith('$')) continue;
      if (typeof v === 'string' && v.includes(',')) query[k] = { $in: v.split(',') };
      else if (typeof v === 'object' && v !== null) continue;
      else query[k] = v;
    }
    const visibility = { $or: [{ owner_id: String(req.user.id) }, { 'members.user_id': String(req.user.id) }, { $and: [{ banned_users: { $ne: String(req.user.id) } }, { $or: [{ is_discoverable: true }, { is_public: { $ne: false }, is_discoverable: { $ne: false } }] }] }] };
    let q = Server.find({ $and: [query, visibility] });
    if (_orderBy) {
      const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
      if (/^[a-zA-Z0-9_.]+$/.test(field)) q = q.sort({ [field]: _orderBy.startsWith('-') ? -1 : 1 });
    }
    if (_limit) q = q.limit(Math.min(Math.max(parseInt(_limit, 10) || 50, 1), 200));
    const docs = await q.lean();
    await pruneGhostMembers(docs);
    res.json(docs.map(d => visibleServer(d, req.user.id)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mount the generic CRUD router for everything else (create, update, delete)
router.use('/', crudRouter(Server, { ownerField: 'owner_id' }));

module.exports = router;
