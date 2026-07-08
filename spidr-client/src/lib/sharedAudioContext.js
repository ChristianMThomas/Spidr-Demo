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
 */
let ctx = null;

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
