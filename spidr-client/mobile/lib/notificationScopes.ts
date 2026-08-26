import AsyncStorage from '@react-native-async-storage/async-storage';
import { entities } from './apiClient';

//
// notificationScopes — per-server and per-group notification overrides (mobile).
//
// Mirrors spidr-client/src/lib/notificationScopes.js. The overrides have to
// live on UserProfile.notification_prefs because the push broker on the server
// is what reads them — an override kept only on the device suppresses nothing,
// since the banner is sent from the backend.
//
// AsyncStorage is written alongside as a cache so a sheet can show the current
// mode without waiting on a profile fetch.
//

const LOCAL_KEY = 'spidr_notification_prefs';

export type NotifScope = 'server' | 'group';

/** Which prefs map each scope writes into. Mirrors SCOPED_SIGNALS server-side. */
const SCOPE_MAP: Record<NotifScope, string> = {
  server: 'server_overrides',
  group: 'group_overrides',
};

/** 'default' inherits the global switches; the rest override them. */
export type ScopeNotifMode = 'default' | 'all' | 'mentions' | 'none';

export const SCOPE_MODES: ScopeNotifMode[] = ['default', 'all', 'mentions', 'none'];

export const SCOPE_MODE_LABELS: Record<ScopeNotifMode, string> = {
  default: 'Use global setting',
  all: 'All messages',
  mentions: 'Only @mentions',
  none: 'Muted',
};

/** Short labels for the four-way segmented control. */
export const SCOPE_MODE_SHORT: Record<ScopeNotifMode, string> = {
  default: 'Global',
  all: 'All',
  mentions: '@Only',
  none: 'Muted',
};

async function readLocalPrefs(): Promise<Record<string, any>> {
  try { return JSON.parse((await AsyncStorage.getItem(LOCAL_KEY)) || '{}'); } catch { return {}; }
}

async function writeLocalPrefs(prefs: Record<string, any>): Promise<void> {
  try { await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(prefs)); } catch {}
}

export async function getScopeMode(
  scope: NotifScope,
  id?: string | null,
): Promise<ScopeNotifMode> {
  const mapKey = SCOPE_MAP[scope];
  if (!mapKey || !id) return 'default';
  const overrides = (await readLocalPrefs())[mapKey] || {};
  const mode = overrides[String(id)];
  return SCOPE_MODES.includes(mode) ? mode : 'default';
}

/**
 * Persist a scope's mode to the profile (authoritative) and the local cache.
 * Reads the profile first so a concurrent change to another pref isn't
 * clobbered by writing a stale whole object back.
 */
export async function setScopeMode(
  scope: NotifScope,
  userId: string | null | undefined,
  id: string,
  mode: ScopeNotifMode,
): Promise<void> {
  const mapKey = SCOPE_MAP[scope];
  if (!mapKey || !id || !SCOPE_MODES.includes(mode)) return;

  const key = String(id);
  const apply = (prefs: Record<string, any>) => {
    const overrides = { ...(prefs[mapKey] || {}) };
    if (mode === 'default') delete overrides[key];
    else overrides[key] = mode;
    return { ...prefs, [mapKey]: overrides };
  };

  await writeLocalPrefs(apply(await readLocalPrefs()));

  if (!userId) return;
  const profiles: any = await entities.UserProfile.filter({ user_id: userId });
  const profile = profiles?.[0];
  if (!profile?.id) return;
  await entities.UserProfile.update(profile.id, {
    notification_prefs: apply(profile.notification_prefs || {}),
  });
}
