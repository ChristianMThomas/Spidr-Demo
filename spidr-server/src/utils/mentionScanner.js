/**
 * mentionScanner.js — extract @user mentions from a message body and resolve
 * them to user IDs.
 *
 * Mentions take the form `@<word>` where <word> matches `\w+` (alphanumeric +
 * underscore), matching the format the client inserts. Special tokens
 * `@everyone` and `@here` are recognized but never expanded into individual
 * recipients (those are broadcast notifications; we deliberately don't fan
 * out into N feed entries when a server admin posts `@everyone`).
 *
 * Resolution strategy — given a list of candidate users (server members for
 * server messages, or DM/group participants for DMs/group chats):
 *
 *   1. Compare against `username` exactly (case-insensitive)
 *   2. Compare against `display_name` exactly (case-insensitive)
 *   3. Compare against first token of `display_name` (case-insensitive) —
 *      the input bar inserts only the first word for multi-word names
 *   4. Compare against `member.user_name` from the server's member list
 *
 * Returns an array of unique user_ids. The actor (sender) is filtered out so
 * a user mentioning themselves doesn't generate a self-notification.
 */

const MENTION_REGEX = /@(\w+)/g;
const RESERVED = new Set(['everyone', 'here', 'all']);

/**
 * Extract raw mention tokens (the part after @) from a content string.
 * Returns Set of lowercased tokens, with reserved tokens filtered out.
 */
function extractMentionTokens(content) {
  if (!content || typeof content !== 'string') return new Set();
  const tokens = new Set();
  let match;
  // Reset state since the regex has the /g flag
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const lower = match[1].toLowerCase();
    if (!RESERVED.has(lower)) tokens.add(lower);
  }
  return tokens;
}

/**
 * Resolve mention tokens against a candidate list of users.
 *
 * @param {Set<string>} tokens — lowercased mention tokens from extractMentionTokens
 * @param {Array} candidates — [{ user_id, username, display_name, user_name }]
 * @param {string} senderId — exclude from results
 * @returns {Array<{user_id, display_name}>} resolved mentioned users
 */
function resolveMentions(tokens, candidates, senderId) {
  if (tokens.size === 0 || !candidates || candidates.length === 0) return [];
  const resolved = new Map(); // user_id → { user_id, display_name }

  for (const cand of candidates) {
    if (!cand?.user_id) continue;
    if (cand.user_id === senderId) continue;

    const username  = (cand.username     || '').toLowerCase();
    const display   = (cand.display_name || '').toLowerCase();
    const memberNm  = (cand.user_name    || '').toLowerCase();
    const firstWord = display.split(/\s+/)[0] || '';

    let hit = null;
    if (username && tokens.has(username))      hit = username;
    else if (display && tokens.has(display))   hit = display;
    else if (firstWord && tokens.has(firstWord)) hit = firstWord;
    else if (memberNm && tokens.has(memberNm)) hit = memberNm;

    if (hit) {
      resolved.set(cand.user_id, {
        user_id: cand.user_id,
        display_name: cand.display_name || cand.user_name || cand.username || 'someone',
      });
    }
  }

  return [...resolved.values()];
}

/**
 * Combined helper: scan content + resolve in one call.
 */
function scanMentions(content, candidates, senderId) {
  const tokens = extractMentionTokens(content);
  if (tokens.size === 0) return [];
  return resolveMentions(tokens, candidates, senderId);
}

module.exports = { extractMentionTokens, resolveMentions, scanMentions };
