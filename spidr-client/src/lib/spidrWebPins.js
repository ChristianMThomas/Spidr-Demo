import { entities } from '@/api/apiClient';

/**
 * spidrWebPins — per-user "Spidr Web" pinned conversations.
 * Each pin = { kind: 'dm'|'group', id, name, avatar }.
 *
 * IMPORTANT: pins are cached in localStorage under a user-scoped key so
 * account switching on the same browser can't leak pins between accounts.
 * The current user must be set via setCurrentUser(uid) before any read or
 * write; before that, getPins() returns [] and writes are no-ops.
 *
 * A `spidr-web-pins-changed` window event fires on every change so live
 * views can re-render.
 */
const LEGACY_KEY = 'spidr_web_pins';
const keyFor = (uid) => `spidr_web_pins:${uid}`;

let currentUid = null;

export function setCurrentUser(uid) {
  currentUid = uid ? String(uid) : null;
  // One-time purge of the pre-scoping key so it can't leak to whichever
  // account happens to log in next on this browser.
  try { localStorage.removeItem(LEGACY_KEY); } catch {}
}

export function clearCurrentUser() {
  currentUid = null;
}

export function getPins() {
  if (!currentUid) return [];
  try {
    const raw = localStorage.getItem(keyFor(currentUid));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePins(pins) {
  if (!currentUid) return;
  try { localStorage.setItem(keyFor(currentUid), JSON.stringify(pins)); } catch {}
  window.dispatchEvent(new CustomEvent('spidr-web-pins-changed', { detail: pins }));
}

export function isPinned(id) {
  return getPins().some(p => p.id === id);
}

// Hydrate this user's pins from their server-side profile. Call once per
// login. Server wins over any cached local pins for this user.
export async function hydratePins(uid) {
  const target = uid ? String(uid) : currentUid;
  if (!target) return [];
  setCurrentUser(target);
  try {
    const profiles = await entities.UserProfile.filter({ user_id: target });
    const serverPins = profiles[0]?.pinned_conversations;
    if (Array.isArray(serverPins)) { savePins(serverPins); return serverPins; }
  } catch { /* fall through to local */ }
  return getPins();
}

async function persistToProfile(pins) {
  if (!currentUid) return;
  const uid = currentUid;
  try {
    const profiles = await entities.UserProfile.filter({ user_id: uid });
    if (profiles[0]?.id) {
      await entities.UserProfile.update(profiles[0].id, { pinned_conversations: pins }).catch(() => {});
    }
  } catch { /* best-effort */ }
}

export function togglePin(entry) {
  if (!entry?.id || !currentUid) return getPins();
  const pins = getPins();
  const exists = pins.some(p => p.id === entry.id);
  const next = exists ? pins.filter(p => p.id !== entry.id) : [...pins, entry];
  savePins(next);
  persistToProfile(next);
  return next;
}
