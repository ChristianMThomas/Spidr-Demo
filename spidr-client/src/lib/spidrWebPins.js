import { entities, auth } from '@/api/apiClient';

/**
 * spidrWebPins — manage the user's "Spidr Web" pinned conversations
 * (pinned_conversations on the UserProfile). Each pin is
 * { kind: 'dm'|'group', id, name, avatar }.
 *
 * Pins are cached in localStorage for instant UI and synced to the profile.
 * A `spidr-web-pins-changed` window event is dispatched on every change so
 * sidebars can re-render live.
 */
const LS_KEY = 'spidr_web_pins';

export function getPins() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePins(pins) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(pins)); } catch {}
  window.dispatchEvent(new CustomEvent('spidr-web-pins-changed', { detail: pins }));
}

export function isPinned(id) {
  return getPins().some(p => p.id === id);
}

// Hydrate from the profile (call once on app load). Merges server → local.
export async function hydratePins() {
  try {
    const me = await auth.me().catch(() => null);
    if (!me?.id) return getPins();
    const profiles = await entities.UserProfile.filter({ user_id: me.id });
    const serverPins = profiles[0]?.pinned_conversations;
    if (Array.isArray(serverPins)) { savePins(serverPins); return serverPins; }
  } catch { /* fall through to local */ }
  return getPins();
}

async function persistToProfile(pins) {
  try {
    const me = await auth.me().catch(() => null);
    if (!me?.id) return;
    const profiles = await entities.UserProfile.filter({ user_id: me.id });
    if (profiles[0]?.id) {
      await entities.UserProfile.update(profiles[0].id, { pinned_conversations: pins }).catch(() => {});
    }
  } catch { /* best-effort */ }
}

export function togglePin(entry) {
  if (!entry?.id) return getPins();
  const pins = getPins();
  const exists = pins.some(p => p.id === entry.id);
  const next = exists ? pins.filter(p => p.id !== entry.id) : [...pins, entry];
  savePins(next);
  persistToProfile(next);
  return next;
}
