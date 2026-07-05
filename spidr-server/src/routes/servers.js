const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMiddleware = require('../middleware/auth');
const Server = require('../models/Server');
const feedEvents = require('../utils/feedEvents');
const welcomeBot = require('../utils/welcomeBot');

const router = express.Router();

// Helper: generate a short alphanumeric invite code
function generateInviteCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

// POST /servers/join — join a server by invite code.
// Body: { invite_code, user_name, user_avatar }
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const { invite_code, user_name, user_avatar } = req.body;
    if (!invite_code || typeof invite_code !== 'string') {
      return res.status(400).json({ error: 'invite_code required' });
    }
    const server = await Server.findOne({ invite_code: invite_code.trim() });
    if (!server) return res.status(404).json({ error: 'Invalid invite code' });

    const userId = req.user?.id;
    const already = (server.members || []).some(m => m.user_id === userId);
    if (already || server.owner_id?.toString() === userId?.toString()) {
      return res.json({
        id: server._id.toString(),
        name: server.name,
        already_member: true,
      });
    }

    server.members = [
      ...(server.members || []),
      {
        user_id: userId,
        user_name: user_name || 'User',
        user_avatar: user_avatar || '',
        role: 'Member',
        joined_at: new Date(),
      },
    ];
    await server.save();

    // 3.3 — notify connected clients so the member list updates live without a
    // reload. Emit both the server room and a global event the panel listens for.
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          server_id: server._id.toString(),
          member: { user_id: userId, user_name: user_name || 'User', user_avatar: user_avatar || '', role: 'Member' },
        };
        io.to(`server:${server._id.toString()}`).emit('server:member-joined', payload);
        io.emit('server:member-joined', payload);
      }
    } catch { /* non-fatal */ }

    // Welcome Bot trigger — fires for new members only.
    // Logged failures inside the helper; join must succeed even if welcome breaks.
    welcomeBot.fireWelcome(
      server,
      { user_id: userId, user_name: user_name || 'User' },
      req.app.get('io')
    ).catch(() => {});

    // Fire-and-forget feed event so this shows up in the home activity feed
    feedEvents.serverJoin({
      user_id: userId,
      user_name: user_name || 'User',
      user_avatar: user_avatar || '',
      server_id: server._id.toString(),
      server_name: server.name,
    });

    res.json({
      id: server._id.toString(),
      name: server.name,
      already_member: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /servers/lookup/:code — preview a server by invite code (no join)
router.get('/lookup/:code', authMiddleware, async (req, res) => {
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

// PATCH /servers/:id — custom handler that runs BEFORE the generic crudRouter
// so we can detect new members added via this path (the public-server "Join"
// button calls Server.update({ members: [...] }) directly instead of going
// through POST /servers/join) and fire the Welcome Bot for each.
const PROTECTED_FIELDS = new Set(['password', 'is_banned', 'role', 'is_verified', 'is_admin', 'twoFactorSecret', 'twoFactorMethod']);
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const before = await Server.findById(req.params.id).select('members').lean();
    if (!before) return res.status(404).json({ error: 'Not found' });
    const beforeIds = new Set((before.members || []).map(m => m.user_id).filter(Boolean));

    const safeBody = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (k.startsWith('$') || PROTECTED_FIELDS.has(k)) continue;
      safeBody[k] = v;
    }

    const updated = await Server.findByIdAndUpdate(
      req.params.id,
      { $set: safeBody },
      { new: true, runValidators: true }
    ).lean();

    // Fire Welcome Bot for each newly-added member.
    const newMembers = (updated.members || []).filter(
      m => m.user_id && !beforeIds.has(m.user_id)
    );
    if (newMembers.length > 0) {
      const io = req.app.get('io');
      for (const m of newMembers) {
        welcomeBot.fireWelcome(updated, m, io).catch(() => {});
      }
    }

    const { _id, __v, ...rest } = updated;
    res.json({ id: _id?.toString(), ...rest });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mount the generic CRUD router for everything else (list, get one, create, update, delete)
router.use('/', crudRouter(Server, { ownerField: 'owner_id' }));

module.exports = router;
