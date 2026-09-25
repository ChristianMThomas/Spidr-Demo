import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearDJPreview, getDJPreviewPosition, getDJStreamState, resolveDJAudioRoute } from '../src/lib/djAudio.js';

class Media extends EventTarget {
  constructor() {
    super();
    this.src = ''; this.currentTime = 0; this.duration = 24; this.readyState = 0;
    this.paused = true; this.ended = false; this.volume = 1; this.muted = false; this.playCalls = 0;
  }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  play() { this.playCalls++; this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
  load() {}
  removeAttribute(name) { this[name] = ''; }
  getAttribute(name) { return this[name]; }
  ready() { this.readyState = 3; this.dispatchEvent(new Event('canplay')); }
}

const session = () => ({ host_id: 'dj', track_id: 'song', started_at: new Date().toISOString(), preview_url: 'https://example.test/preview', audio_route: 'preview' });
const stream = () => {
  const track = Object.assign(new EventTarget(), { readyState: 'live', enabled: true, muted: false });
  return Object.assign(new EventTarget(), { getAudioTracks: () => [track], track });
};

// Minimal hook scheduler: runs the production hook's effects/cleanup against
// EventTarget media doubles, without adding a browser/testing dependency.
function mount(initial, musicOverrides = {}) {
  let props = initial;
  let cursor = 0;
  let dirty = true;
  let output;
  let effects = [];
  const cells = [];
  const audio = new Media();
  const useState = initialValue => {
    const index = cursor++;
    if (!(index in cells)) cells[index] = typeof initialValue === 'function' ? initialValue() : initialValue;
    return [cells[index], value => {
      const next = typeof value === 'function' ? value(cells[index]) : value;
      if (!Object.is(next, cells[index])) { cells[index] = next; dirty = true; }
    }];
  };
  const useRef = value => {
    const index = cursor++;
    return cells[index] ||= { current: value };
  };
  const useEffect = (effect, deps) => {
    const index = cursor++;
    const prior = cells[index];
    if (prior && deps?.length === prior.deps?.length && deps.every((value, i) => Object.is(value, prior.deps[i]))) return;
    cells[index] = { deps, cleanup: prior?.cleanup };
    effects.push(() => { cells[index].cleanup?.(); cells[index].cleanup = effect(); });
  };
  const musicKit = { ready: false, authorized: false, instance: { current: null }, playTrack() {}, stop() {}, setVolume() {}, play() {}, pause() {}, ...musicOverrides };
  const source = readFileSync(new URL('../src/hooks/useDJAudio.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default function useDJAudio', 'function useDJAudio');
  const hook = new Function('useState', 'useRef', 'useEffect', 'useLayoutEffect', 'useCallback', 'useMusicKit', 'applySink',
    'clearDJPreview', 'getDJPreviewPosition', 'getDJStreamState', 'resolveDJAudioRoute', 'setInterval', 'clearInterval', 'window',
    `${source}\nreturn useDJAudio;`)(useState, useRef, useEffect, useEffect, callback => callback, () => musicKit, () => {},
    clearDJPreview, getDJPreviewPosition, getDJStreamState, resolveDJAudioRoute, () => 0, () => {}, { MusicKit: { PlaybackStates: { playing: 2, ended: 4, completed: 5 } } });
  const flush = () => {
    let iterations = 0;
    while (dirty) {
      assert.ok(++iterations < 30, 'hook converges after state updates');
      dirty = false; cursor = 0; effects = [];
      output = hook(props);
      output.audioRef.current = audio;
      effects.forEach(effect => effect());
    }
    return output;
  };
  flush();
  return {
    audio, flush,
    get current() { return output; },
    update(next) { props = { ...props, ...next }; dirty = true; return flush(); },
    unmount() { cells.forEach(cell => cell?.cleanup?.()); },
  };
}

test('DJ stream engages before route broadcast; an authoritative stream never falls back', () => {
  assert.equal(resolveDJAudioRoute(session(), stream()), 'stream');
  assert.equal(resolveDJAudioRoute({ ...session(), audio_route: 'stream' }, null), 'stream');
  assert.equal(resolveDJAudioRoute(null, stream()), 'idle');
});

test('stream handoff clears preview and removes its pending canplay callback', () => {
  const hook = mount({ djSession: session(), isHost: false });
  assert.ok(hook.audio.src);
  hook.update({ hostStream: stream() });
  assert.equal(hook.audio.src, '');
  assert.equal(hook.audio.currentTime, 0);
  hook.audio.ready();
  assert.equal(hook.audio.playCalls, 0);
  hook.unmount();
});

test('negotiated stream with missing source remains waiting and silent', () => {
  const hook = mount({ djSession: { ...session(), audio_route: 'stream' }, isHost: false });
  assert.equal(hook.current.status, 'waiting');
  assert.equal(hook.audio.src, '');
  assert.equal(hook.current.isPlaying, false);
  hook.unmount();
});

test('preview uses actual clip duration and does not loop or restart after its end', async () => {
  const hook = mount({ djSession: { ...session(), started_at: new Date(Date.now() - 25000).toISOString() } });
  hook.audio.ready();
  hook.flush();
  assert.equal(hook.current.status, 'ended');
  assert.equal(hook.current.durationSeconds, 24);
  assert.equal(hook.audio.loop, false);
  assert.equal(hook.audio.playCalls, 0);
  await hook.current.togglePause(); hook.flush();
  await hook.current.togglePause(); hook.flush();
  assert.equal(hook.audio.playCalls, 0);
  hook.unmount();
});

test('preview volume/deafen affect the physical local media element', async () => {
  const hook = mount({ djSession: session(), isDeafened: false });
  hook.audio.ready(); await Promise.resolve(); hook.flush();
  hook.current.setLocalVolume(25); hook.flush();
  assert.equal(hook.audio.volume, 0.25);
  hook.update({ isDeafened: true });
  assert.equal(hook.audio.muted, true);
  assert.equal(hook.current.isPlaying, false);
  hook.update({ isDeafened: false });
  assert.equal(hook.audio.muted, false);
  assert.equal(hook.audio.volume, 0.25);
  hook.unmount();
  assert.equal(hook.audio.src, '');
  assert.equal(hook.audio.paused, true);
});

test('local stream pause never disables the received or outgoing track', async () => {
  const source = stream();
  const hook = mount({ djSession: session(), hostStream: source, isHost: false });
  await hook.current.togglePause(); hook.flush();
  assert.equal(hook.current.userPaused, true);
  assert.equal(source.track.enabled, true);
  hook.update({ isHost: true });
  assert.equal(hook.current.canControlAudio, false);
  await hook.current.togglePause();
  assert.equal(source.track.enabled, true);
  hook.unmount();
});

test('clip positions clamp without modulo replay', () => {
  assert.deepEqual(getDJPreviewPosition('2026-01-01T00:00:00Z', 24, Date.parse('2026-01-01T00:00:40Z')), { position: 24, ended: true });
  assert.deepEqual(getDJPreviewPosition('invalid', 24), { position: 0, ended: false });
});

test('mobile Apple autoplay rejection stays on prepared queue and retries play synchronously on tap', async () => {
  let taps = 0;
  const player = Object.assign(new EventTarget(), { playbackState: 0, seekToTime: async () => {} });
  const hook = mount({ djSession: { ...session(), source: 'apple', duration_ms: 180000 } }, {
    ready: true, authorized: true, instance: { current: player },
    playTrack: async () => { throw new DOMException('Tap required', 'NotAllowedError'); },
    play: () => { taps++; return Promise.resolve(); },
  });
  await new Promise(resolve => setImmediate(resolve)); hook.flush();
  assert.equal(hook.current.fullTrackActive, true);
  assert.equal(hook.current.audioBlocked, true);
  assert.equal(hook.audio.src, '');
  const unlocking = hook.current.unlockAudio();
  assert.equal(taps, 1, 'play must run in the click stack, before awaiting anything');
  await unlocking; hook.flush();
  assert.equal(hook.current.audioBlocked, false);
  hook.unmount();
});

test('mobile preview can be unlocked before canplay and resuming a stream invokes play', async () => {
  const hook = mount({ djSession: session() });
  await hook.current.unlockAudio(); hook.flush();
  assert.equal(hook.audio.playCalls, 1);
  const remote = new Media();
  hook.update({ hostStream: stream(), streamElement: remote });
  await hook.current.togglePause(); hook.flush();
  const calls = remote.playCalls;
  await hook.current.togglePause(); hook.flush();
  assert.equal(remote.playCalls, calls + 1);
  hook.unmount();
});
