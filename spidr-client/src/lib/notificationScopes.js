import { entities } from '@/api/apiClient';

//
// notificationScopes — per-server and per-group notification overrides.
//
// The global Signal Control switches decide what a *typical* server or group
// does. These are the per-conversation escape hatches on top of them, and they
// have to live on UserProfile.notification_prefs because the thing that reads
// them is the push broker on the server (utils/notifications.js), not the
// client. An override kept only in localStorage suppresses nothing — which is
// exactly what the old `spidr_muted_servers` key did.
//
// localStorage is written alongside as a read-through cache so menus can label
// themselves synchronously without waiting on a profile fetch.
//

const LOCAL_KEY = 'spidr_notification_prefs';

/** Which prefs map each scope writes into. Mirrors SCOPED_SIGNALS server-side. */
const SCOPE_MAP = {
  server: 'server_overrides',
  group: 'group_overrides',
};

/** 'default' inherits the global switches; the rest override them. */
export const SCOPE_MODES = ['default', 'all', 'mentions', 'none'];

export const SCOPE_MODE_LABELS = {
  default: 'Use global setting',
  all: 'All messages',
  mentions: 'Only @mentions',
  none: 'Muted',
};

function readLocalPrefs() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; }
}

function writeLocalPrefs(prefs) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs)); } catch {}
}

/** Synchronous read off the local mirror — for labelling menus. */
export function getScopeMode(scope, id) {
  const mapKey = SCOPE_MAP[scope];
  if (!mapKey || !id) return 'default';
  const overrides = readLocalPrefs()[mapKey] || {};
  const mode = overrides[String(id)];
  return SCOPE_MODES.includes(mode) ? mode : 'default';
}

/**
 * Persist a scope's mode to the profile (authoritative) and the local mirror.
 * Reads the profile first so a concurrent change to another pref isn't
 * clobbered by writing a stale whole object back.
 */
export async function setScopeMode(scope, userId, id, mode) {
  const mapKey = SCOPE_MAP[scope];
  if (!mapKey || !id || !SCOPE_MODES.includes(mode)) return;

  const key = String(id);
  const apply = (prefs) => {
    const overrides = { ...(prefs[mapKey] || {}) };
    if (mode === 'default') delete overrides[key];
    else overrides[key] = mode;
    return { ...prefs, [mapKey]: overrides };
  };

  writeLocalPrefs(apply(readLocalPrefs()));

  if (!userId) return;
  const profiles = await entities.UserProfile.filter({ user_id: userId });
  const profile = profiles?.[0];
  if (!profile?.id) return;
  await entities.UserProfile.update(profile.id, {
    notification_prefs: apply(profile.notification_prefs || {}),
  });
}

export const getServerMode = (serverId) => getScopeMode('server', serverId);
export const setServerMode = (userId, serverId, mode) => setScopeMode('server', userId, serverId, mode);
export const isServerMuted = (serverId) => getServerMode(serverId) === 'none';

export const getGroupMode = (groupId) => getScopeMode('group', groupId);
export const setGroupMode = (userId, groupId, mode) => setScopeMode('group', userId, groupId, mode);
