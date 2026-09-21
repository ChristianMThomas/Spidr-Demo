const { isDeepStrictEqual } = require('node:util');

const isMember = (server, userId) => String(server.owner_id) === String(userId) ||
  (server.members || []).some(m => String(m.user_id) === String(userId));

function canManage(server, userId) {
  if (String(server.owner_id) === String(userId)) return true;
  const member = (server.members || []).find(m => String(m.user_id) === String(userId));
  if (!member) return false;
  const role = (server.roles || []).find(r => r.id === member.role || r.name === member.role);
  return ['admin', 'owner'].includes(String(member.role).toLowerCase()) ||
    (role?.permissions || []).some(p => ['all', 'manage_server'].includes(p));
}

const isListed = server => server.is_discoverable === true ||
  (server.is_public !== false && server.is_discoverable !== false);

const listedQuery = { $or: [{ is_discoverable: true }, { is_public: { $ne: false }, is_discoverable: { $ne: false } }] };

function canUpdateNicknames(server, userId, body) {
  if (Object.keys(body).length !== 1 || !Array.isArray(body.members) || !isMember(server, userId)) return false;
  const members = JSON.parse(JSON.stringify(server.members || []));
  if (body.members.length !== members.length) return false;
  const existing = new Map(members.map(m => [m.user_id, m]));
  if (new Set(body.members.map(m => m?.user_id)).size !== existing.size) return false;
  const self = existing.get(userId);
  const role = (server.roles || []).find(r => r.id === self?.role || r.name === self?.role);
  const giveNicknames = role?.permissions?.includes('give_nicknames');
  return body.members.every(next => {
    const previous = existing.get(next?.user_id);
    if (!previous) return false;
    const { nickname: oldNickname, ...oldRest } = previous;
    const { nickname, ...rest } = next;
    if (!isDeepStrictEqual(rest, oldRest)) return false;
    if (nickname === oldNickname) return true;
    return (next.user_id === userId || giveNicknames) && (nickname == null || (typeof nickname === 'string' && nickname.length <= 64));
  });
}

function summary(server, userId, friends = new Set()) {
  return {
    id: String(server._id), name: server.name, description: server.description || '',
    icon_url: server.icon_url || '', banner_url: server.banner_url || '',
    category: server.category || '', tags: server.tags || [], rules: server.rules || [],
    is_public: server.is_public !== false, allow_join_requests: server.allow_join_requests !== false,
    member_count: new Set([server.owner_id, ...(server.members || []).map(m => m.user_id)].filter(Boolean)).size,
    friend_count: (server.members || []).filter(m => friends.has(String(m.user_id))).length,
    is_member: isMember(server, userId),
    request_pending: (server.join_requests || []).some(r => String(r.user_id) === String(userId)),
  };
}

function discoveryFields(body) {
  const fields = {};
  for (const key of ['is_public', 'is_discoverable', 'allow_join_requests']) {
    if (key in body) {
      if (typeof body[key] !== 'boolean') throw new Error(`${key} must be a boolean`);
      fields[key] = body[key];
    }
  }
  if ('category' in body) {
    if (typeof body.category !== 'string' || body.category.length > 40) throw new Error('Invalid category');
    fields.category = body.category.trim();
  }
  if ('tags' in body) {
    if (!Array.isArray(body.tags) || body.tags.length > 5 || body.tags.some(t => typeof t !== 'string' || !/^#?[a-z0-9_-]{1,24}$/i.test(t))) throw new Error('Use up to 5 tags, 24 characters each');
    fields.tags = [...new Set(body.tags.map(t => t.replace(/^#/, '').toLowerCase()))];
  }
  if ('rules' in body) {
    if (!Array.isArray(body.rules) || body.rules.length > 20 || body.rules.some(r => typeof r !== 'string' || r.length > 300)) throw new Error('Use up to 20 rules, 300 characters each');
    fields.rules = body.rules.map(r => r.trim()).filter(Boolean);
  }
  return fields;
}

module.exports = { isMember, canManage, canUpdateNicknames, isListed, listedQuery, summary, discoveryFields };
