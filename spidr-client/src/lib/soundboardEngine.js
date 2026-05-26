/**
 * soundboardEngine.js — Web Audio engine for the Spidr Soundboard.
 *
 * Two responsibilities:
 *   1) Synthesized sound effects (no audio files) — oscillator/noise based,
 *      in the same spirit as components/spidr/SoundEngine.jsx.
 *   2) Offline voice filters — takes a recorded AudioBuffer (from the mic) and
 *      renders a filtered copy (pitch / robot / reverb / deep / chipmunk / alien)
 *      via an OfflineAudioContext, returning a Blob URL for playback.
 *
 * Everything is best-effort and guarded: if Web Audio is unavailable, calls
 * resolve to null / no-op rather than throwing.
 */

let _ctx = null;
function ctx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!_ctx) _ctx = new Ctx();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function noiseBuffer(c, seconds = 1) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Synthesized sound effects ───────────────────────────────────────────────
// Each entry is a function (c, t) that schedules its sound starting at time t.
const SFX = {
  // A descending "web pluck"
  pluck(c, t) {
    [392, 261.6].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      const s = t + i * 0.12;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.3, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.3);
      o.connect(g); g.connect(c.destination);
      o.start(s); o.stop(s + 0.32);
    });
    return 0.5;
  },
  // Rising zap
  zap(c, t) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.42);
    return 0.45;
  },
  // Bubbly "blip"
  blip(c, t) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.08);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.16);
    return 0.2;
  },
  // Airhorn-ish stab
  airhorn(c, t) {
    [233, 311, 466].forEach((f) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
      g.gain.setValueAtTime(0.18, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.77);
    });
    return 0.8;
  },
  // Sad trombone-ish "womp"
  womp(c, t) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.62);
    return 0.6;
  },
  // Snare-ish noise hit
  snare(c, t) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.2);
    const g = c.createGain();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1200;
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(hp); hp.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + 0.2);
    return 0.2;
  },
  // Eerie alien warble
  alien(c, t) {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const g = c.createGain();
    o.type = 'sine'; o.frequency.value = 440;
    lfo.frequency.value = 18; lfoGain.gain.value = 120;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(c.destination);
    lfo.start(t); o.start(t); o.stop(t + 0.72); lfo.stop(t + 0.72);
    return 0.75;
  },
  // Quick rising "level/coin"
  coin(c, t) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(660, t);
    o.frequency.setValueAtTime(990, t + 0.08);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.26);
    return 0.3;
  },
};

export const SOUND_EFFECTS = [
  { id: 'pluck',   label: 'Web Pluck', emoji: '🕸️' },
  { id: 'zap',     label: 'Zap',       emoji: '⚡' },
  { id: 'blip',    label: 'Blip',      emoji: '🔵' },
  { id: 'airhorn', label: 'Airhorn',   emoji: '📢' },
  { id: 'womp',    label: 'Womp',      emoji: '📉' },
  { id: 'snare',   label: 'Snare',     emoji: '🥁' },
  { id: 'alien',   label: 'Alien',     emoji: '👽' },
  { id: 'coin',    label: 'Coin',      emoji: '🪙' },
];

export function playEffect(id) {
  const c = ctx();
  if (!c || !SFX[id]) return 0;
  try { return SFX[id](c, c.currentTime); } catch { return 0; }
}

// Play an arbitrary audio URL (used for user-uploaded custom sounds). Decodes
// and plays through the shared context so it respects the same gain/output.
// Cached by URL so repeated taps don't re-fetch. Best-effort; resolves silently
// on failure.
const _customCache = new Map(); // url -> AudioBuffer
export async function playUrl(url) {
  const c = ctx();
  if (!c || !url) return;
  try {
    let buf = _customCache.get(url);
    if (!buf) {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      buf = await c.decodeAudioData(arr);
      _customCache.set(url, buf);
    }
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = 0.85;
    src.buffer = buf;
    src.connect(g); g.connect(c.destination);
    src.start(c.currentTime);
  } catch { /* best-effort */ }
}

// ── Voice filters (offline render of a recorded buffer) ─────────────────────
export const VOICE_FILTERS = [
  { id: 'none',     label: 'Normal',    emoji: '🎙️' },
  { id: 'chipmunk', label: 'Chipmunk',  emoji: '🐿️' },
  { id: 'deep',     label: 'Deep',      emoji: '🔊' },
  { id: 'robot',    label: 'Robot',     emoji: '🤖' },
  { id: 'reverb',   label: 'Cavern',    emoji: '🌀' },
  { id: 'alien',    label: 'Alien',     emoji: '👽' },
];

// Build a synthetic impulse response for a simple reverb.
function impulseResponse(c, seconds = 1.6, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return ir;
}

/**
 * Render a recorded AudioBuffer through a filter. Returns a Promise<Blob|null>
 * (a WAV blob) — null if Web Audio/offline rendering isn't available.
 *
 * Pitch effects use playbackRate on a buffer source (changes pitch + speed,
 * the classic chipmunk/deep effect). Robot uses a ring-modulator. Reverb uses
 * a convolver with a synthetic impulse. Alien combines pitch + ring mod.
 */
export async function renderVoiceFilter(audioBuffer, filterId) {
  if (!audioBuffer) return null;
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineCtx) return null;

  const rate =
    filterId === 'chipmunk' ? 1.5 :
    filterId === 'deep'     ? 0.72 :
    filterId === 'alien'    ? 1.25 : 1.0;

  // Output length scales with playbackRate (faster rate => shorter output).
  const outLen = Math.ceil(audioBuffer.length / rate) + audioBuffer.sampleRate; // + tail for reverb
  const oc = new OfflineCtx(1, outLen, audioBuffer.sampleRate);

  const src = oc.createBufferSource();
  src.buffer = audioBuffer;
  src.playbackRate.value = rate;

  let node = src; // current tail of the chain

  // Robot / alien: ring modulation (multiply by a carrier oscillator).
  if (filterId === 'robot' || filterId === 'alien') {
    const carrier = oc.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = filterId === 'robot' ? 50 : 110;
    const ring = oc.createGain();
    ring.gain.value = 0; // gain is driven by the carrier
    carrier.connect(ring.gain);
    node.connect(ring);
    node = ring;
    carrier.start(0);
  }

  // Reverb (cavern): convolver with synthetic impulse, mixed with dry.
  if (filterId === 'reverb') {
    const conv = oc.createConvolver();
    conv.buffer = impulseResponse(oc);
    const wet = oc.createGain(); wet.gain.value = 0.7;
    const dry = oc.createGain(); dry.gain.value = 0.6;
    node.connect(dry); dry.connect(oc.destination);
    node.connect(conv); conv.connect(wet); wet.connect(oc.destination);
  } else {
    const out = oc.createGain();
    out.gain.value = 1.0;
    node.connect(out);
    out.connect(oc.destination);
  }

  src.start(0);

  let rendered;
  try {
    rendered = await oc.startRendering();
  } catch {
    return null;
  }
  return audioBufferToWavBlob(rendered);
}

// Encode an AudioBuffer to a 16-bit PCM WAV Blob.
function audioBufferToWavBlob(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const blockAlign = numCh * 2;
  const dataSize = samples * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

// Decode a recorded Blob (e.g. from MediaRecorder) into an AudioBuffer.
export async function blobToAudioBuffer(blob) {
  const c = ctx();
  if (!c) return null;
  try {
    const arr = await blob.arrayBuffer();
    return await c.decodeAudioData(arr);
  } catch {
    return null;
  }
}
