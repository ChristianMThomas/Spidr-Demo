const managed = key => /^(apple_music_|spotify_)/.test(key);
const secret = key => /token|secret/i.test(key);

function publicProfile(value) {
  if (Array.isArray(value)) return value.map(publicProfile);
  if (!value || typeof value !== 'object' || !value.neural_links) return value;
  return { ...value, neural_links: Object.fromEntries(Object.entries(value.neural_links).filter(([key]) => !secret(key))) };
}
function connectionSafeBody(body, patch) {
  const safe = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (key.startsWith('neural_links.')) continue;
    if (key !== 'neural_links') { safe[key] = value; continue; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const links = Object.fromEntries(Object.entries(value).filter(([name]) => /^[a-zA-Z0-9_]+$/.test(name) && !managed(name) && !secret(name)));
    // Patch individual preferences so a Steam toggle cannot erase stored OAuth state.
    if (patch) for (const [name, entry] of Object.entries(links)) safe['neural_links.' + name] = entry;
    else safe.neural_links = links;
  }
  return safe;
}
module.exports = { publicProfile, connectionSafeBody };
