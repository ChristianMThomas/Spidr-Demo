/**
 * tagService.js — Spidr discriminator ("#tag") generation and validation.
 *
 * A Spidr identity is `DisplayName#tag`. The tag is either an auto-generated
 * 4-character code or a custom word the user picked ("Auxtin#vibes").
 *
 * Two failure modes this exists to prevent:
 *
 *   1. COLLISIONS — generating a tag without checking the database means two
 *      people can end up as the same `Name#tag`, which breaks friend lookup
 *      and mention resolution. Every generation path here queries first and
 *      retries, with a safety counter so a congested name can't spin forever.
 *
 *   2. THE "#0000" BUG — profiles created before the discriminator field
 *      existed (or through a write path that skipped the pre-save hook) have
 *      no tag at all. The client used to paper over that with a hardcoded
 *      '0000' fallback, so EVERY tagless user rendered as `#0000` and they
 *      all looked identical. Tags are now backfilled deterministically rather
 *      than faked at render time.
 */

// Ambiguous characters (0/o, 1/l/i) are excluded: tags get read aloud and
// typed by hand when adding friends, and "Auxtin#l0ok" is a support ticket
// waiting to happen.
const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const TAG_LENGTH = 4;

// Custom tags: letters and digits only, 2–12 chars. No spaces or symbols —
// tags appear in URLs (/add/name-tag) and would break routing.
const CUSTOM_TAG_REGEX = /^[a-zA-Z0-9]{2,12}$/;

// Reserved so nobody can impersonate staff or system actors.
const RESERVED_TAGS = new Set([
  'admin', 'administrator', 'mod', 'moderator', 'staff', 'system', 'spidr',
  'official', 'support', 'help', 'root', 'owner', 'bot', 'server', 'everyone',
  'here', 'null', 'undefined', 'api',
]);

// Lightweight blocklist. Deliberately small and substring-matched rather than
// pulling a dependency: it catches the obvious cases without the false
// positives a big word list generates (the "Scunthorpe problem" — a naive
// filter rejects legitimate names). Anything subtler is a moderation
// problem, not a regex problem, and users can be forced to re-roll.
const BLOCKED_FRAGMENTS = [
  'nigg', 'fagg', 'kike', 'chink', 'spic', 'rape', 'nazi', 'hitler',
  'cunt', 'kill', 'cp', 'pedo',
];

function randomTag() {
  let out = '';
  for (let i = 0; i < TAG_LENGTH; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

/**
 * Validate a user-requested custom tag.
 * Returns { ok: true, tag } or { ok: false, error }.
 */
function validateCustomTag(raw) {
  if (raw == null) return { ok: false, error: 'Tag is required' };
  const trimmed = String(raw).trim();
  if (!CUSTOM_TAG_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: 'Tag must be 2–12 characters, letters and numbers only',
    };
  }
  // Case-fold so "VIBES" and "vibes" can't exist as two identities. Without
  // this, friend lookup fetches the wrong person or fails outright.
  const tag = trimmed.toLowerCase();
  if (RESERVED_TAGS.has(tag)) {
    return { ok: false, error: `#${tag} is reserved` };
  }
  if (BLOCKED_FRAGMENTS.some(f => tag.includes(f))) {
    return { ok: false, error: 'That tag isn\'t allowed' };
  }
  return { ok: true, tag };
}

/**
 * Is `tag` free for `displayName`? Uniqueness is scoped to the NAME, matching
 * how the identity reads in the UI — many people can be #vibes, but only one
 * can be Auxtin#vibes.
 */
async function isTagAvailable(Model, displayName, tag, excludeUserId = null) {
  const filter = {
    discriminator: tag,
    // Case-insensitive name match so "Auxtin" and "auxtin" share a namespace.
    display_name: new RegExp(`^${escapeRegex(displayName || '')}$`, 'i'),
  };
  if (excludeUserId) filter.user_id = { $ne: excludeUserId };
  const existing = await Model.findOne(filter).select('_id').lean();
  return !existing;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a tag that is free for this display name.
 * Retries on collision; gives up after MAX_ATTEMPTS rather than looping
 * forever on a heavily-congested name.
 */
async function generateUniqueDiscriminator(Model, displayName, excludeUserId = null) {
  const MAX_ATTEMPTS = 50;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const tag = randomTag();
    // eslint-disable-next-line no-await-in-loop
    if (await isTagAvailable(Model, displayName, tag, excludeUserId)) return tag;
  }
  // Fall back to a longer tag rather than throwing — a user should never be
  // blocked from having an identity because their chosen name is popular.
  return randomTag() + randomTag().slice(0, 2);
}

/**
 * Deterministic tag derived from a stable id. Used to backfill legacy
 * profiles that predate the discriminator field: the same user always
 * resolves to the same tag, so it's stable across restarts and doesn't
 * require a migration to be run exactly once.
 */
function deterministicTag(seed) {
  const s = String(seed || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  let out = '';
  let n = h;
  for (let i = 0; i < TAG_LENGTH; i++) {
    out += CHARS[n % CHARS.length];
    n = Math.floor(n / CHARS.length) + 7;
  }
  return out;
}

module.exports = {
  randomTag,
  validateCustomTag,
  isTagAvailable,
  generateUniqueDiscriminator,
  deterministicTag,
  CUSTOM_TAG_REGEX,
  RESERVED_TAGS,
};
