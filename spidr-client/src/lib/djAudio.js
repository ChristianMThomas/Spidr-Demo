/** Route selection uses only the identified DJ's share, never another peer's. */
export function getDJStreamState(stream) {
  const tracks = stream?.getAudioTracks?.() || [];
  return {
    connected: tracks.some(track => track.readyState === 'live'),
    active: tracks.some(track => track.readyState === 'live' && track.enabled && !track.muted),
  };
}

export function resolveDJAudioRoute(session, stream) {
  if (!session) return 'idle';
  return session.audio_route === 'stream' || getDJStreamState(stream).connected ? 'stream' : 'preview';
}

/** Stop buffering as well as playback; stale canplay listeners must also be removed by the owner. */
export function clearDJPreview(element) {
  if (!element) return;
  element.pause();
  try { element.currentTime = 0; } catch { /* metadata may not have loaded */ }
  element.removeAttribute('src');
  element.load();
}

export function getDJPreviewPosition(startedAt, duration, now = Date.now()) {
  const start = new Date(startedAt).getTime();
  const elapsed = Number.isFinite(start) ? Math.max(0, (now - start) / 1000) : 0;
  const length = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return { position: length ? Math.min(elapsed, length) : elapsed, ended: !!length && elapsed >= length };
}
