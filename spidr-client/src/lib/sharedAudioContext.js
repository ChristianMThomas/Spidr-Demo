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

/**
 * getSharedElementSource(el) — same idea as getSharedSource but for an
 * <audio>/<video> ELEMENT, used to visualise the DJ's 30s preview.
 *
 * Two traps this exists to avoid, both of which silence audio outright:
 *
 *   1. createMediaElementSource may be called ONCE per element, exactly like
 *      the MediaStream rule. A second call throws and the element is left in
 *      a broken state.
 *   2. Creating the source REROUTES the element's output into the graph. If
 *      you never connect onward to ctx.destination, the audio simply stops
 *      coming out of the speakers — the element looks like it's playing and
 *      nothing is audible. So we wire source -> destination immediately here
 *      and hand callers a node they can tap without owning that
 *      responsibility.
 *
 * Ref-counted; the connection to destination persists for the element's life
 * because disconnecting it would mute playback.
 */
const elementRegistry = new Map();

export function getSharedElementSource(el) {
  if (!el) return null;
  const context = getSharedAudioContext();
  if (!context) return null;
  let entry = elementRegistry.get(el);
  if (!entry) {
    try {
      const source = context.createMediaElementSource(el);
      // CRITICAL: keep the audio audible.
      source.connect(context.destination);
      entry = { source, refCount: 0 };
      elementRegistry.set(el, entry);
    } catch {
      return null;
    }
  }
  entry.refCount += 1;
  return entry.source;
}

export function releaseSharedElementSource(el) {
  if (!el) return;
  const entry = elementRegistry.get(el);
  if (!entry) return;
  entry.refCount -= 1;
  // Deliberately NOT disconnecting the source from destination even at zero:
  // an element can only ever have one source node, so tearing it down would
  // permanently mute an element we may visualise again later.
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
