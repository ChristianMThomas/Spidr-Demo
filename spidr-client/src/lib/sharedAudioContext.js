/**
 * sharedAudioContext — ONE Web Audio context for the whole app.
 *
 * Why: Chrome caps AudioContexts at ~6 per page. Voice calls used to create
 * one per speaking-detector tile PLUS one for the minimized-pill broadcaster,
 * and every mute/deafen toggle tore down + recreated them (close() resolves
 * async, so the old context still counts against the cap for a beat). A few
 * members + a few toggles exhausted the pool, new AudioContext() started
 * throwing, and every speaking ring in the app silently died.
 *
 * All analysers now share this singleton. Sources connect/disconnect freely;
 * the context itself is never closed.
 *
 * SECOND critical rule: only ONE MediaStreamAudioSourceNode may exist per
 * MediaStream. Chrome silently detaches the audio element's playback pipeline
 * when a second createMediaStreamSource is called on the same stream — this
 * killed voice audio during screen shares (multiple analysers per remote
 * stream conflicting). getSharedSource() returns a ref-counted source node
 * that every consumer uses instead of tapping the stream directly.
 */
let ctx = null;

// Registry of shared source nodes, keyed by MediaStream id. Each entry:
//   { source: MediaStreamAudioSourceNode, refCount: number }
const sourceRegistry = new Map();

export function getSharedAudioContext() {
  if (!ctx || ctx.state === 'closed') {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Autoplay policy can leave it suspended until a user gesture — resume
  // opportunistically; callers work either way once it's running.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * getSharedSource(stream) — returns a shared MediaStreamAudioSourceNode
 * for the given stream. Every consumer that wants to analyse the stream
 * calls this, connects THEIR own analyser to the returned source, and
 * calls releaseSharedSource(stream) when done. This guarantees we never
 * create a second source on the same stream.
 *
 * Returns null if the context is unavailable or the source can't be created.
 */
export function getSharedSource(stream) {
  if (!stream) return null;
  const context = getSharedAudioContext();
  if (!context) return null;
  const key = stream.id;
  let entry = sourceRegistry.get(key);
  if (!entry) {
    try {
      const source = context.createMediaStreamSource(stream);
      entry = { source, refCount: 0 };
      sourceRegistry.set(key, entry);
    } catch {
      return null;
    }
  }
  entry.refCount += 1;
  return entry.source;
}

export function releaseSharedSource(stream) {
  if (!stream) return;
  const key = stream.id;
  const entry = sourceRegistry.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    try { entry.source.disconnect(); } catch {}
    sourceRegistry.delete(key);
  }
}
