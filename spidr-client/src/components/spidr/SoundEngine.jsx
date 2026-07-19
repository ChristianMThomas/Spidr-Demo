// Bio-Digital Sound Engine for Spidr

let ctx = null;
let noiseBuffer = null;

// ── Do-Not-Disturb status tracker ────────────────────────────────────────
// Notification-class sounds (incoming messages, calls, joins, etc.) are
// silenced when the user's status is 'dnd' / 'busy'. UI feedback sounds
// (hover, toggle, click) are USER-INITIATED and still play — they're not
// surprise interruptions.
//
// We listen for the `spidr-profile-updated` event UserStatusChip dispatches
// whenever the user changes their status. We also hydrate from localStorage
// on first import so the gate works before any status change occurs (e.g.
// the user reloads while busy).
let _currentStatus = 'online';
try {
  if (typeof window !== 'undefined') {
    const cached = window.localStorage?.getItem('spidr_user_status');
    if (cached) _currentStatus = cached;
    window.addEventListener('spidr-profile-updated', (e) => {
      const s = e?.detail?.profile?.status;
      if (typeof s === 'string') {
        _currentStatus = s;
        try { window.localStorage.setItem('spidr_user_status', s); } catch {}
      }
    });
  }
} catch { /* SSR-safe: any listener failure leaves the default 'online' status */ }

// Set of sound types that should be SILENCED when the user is busy. UI
// chrome sounds (hover, click, toggle, error) still play because the user
// triggered them directly.
const NOTIFICATION_SOUND_TYPES = new Set([
  'message',     // incoming chat message
  'notification',// generic notification
  'join',        // someone joined a voice channel
  'mention',     // someone @-mentioned the user
  'call',        // incoming call ring
  'ping',        // generic ping
]);

const initAudio = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
};

const createNoiseBuffer = () => {
  if (!ctx) return null;
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

// User sound preferences (Settings → Notifications & Sounds). Read fresh on
// every play so toggles apply instantly without a reload. Shape:
// { master, volume(0-100), send, receive, join_leave, ui }
const soundPrefs = () => {
  try {
    const raw = localStorage.getItem('spidr_sound_prefs');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
// Which pref switch governs each sound type.
const SOUND_CATEGORY = {
  send: 'send', sent: 'send',
  message: 'receive', receive: 'receive', notification: 'receive', ping: 'receive',
  join: 'join_leave', leave: 'join_leave', 'user-join': 'join_leave', 'user-leave': 'join_leave',
  toggle: 'ui', click: 'ui', hover: 'ui', open: 'ui', close: 'ui', pop: 'ui',
};

export const playSound = (type) => {
  // Gate notification sounds on user status. dnd = Do Not Disturb = "busy".
  if (_currentStatus === 'dnd' && NOTIFICATION_SOUND_TYPES.has(type)) {
    return;
  }
  // Gate on the user's saved sound settings — these switches used to be
  // decorative; now they actually silence their category (and Master mutes
  // everything).
  const prefs = soundPrefs();
  if (prefs) {
    if (prefs.master === false) return;
    const cat = SOUND_CATEGORY[type];
    if (cat && prefs[cat] === false) return;
  }
  try {
    initAudio();
    if (!ctx) {
      console.warn('Audio context not available');
      return;
    }
    
    if (!noiseBuffer) {
      noiseBuffer = createNoiseBuffer();
    }

    const t = ctx.currentTime;
    const masterGain = ctx.createGain();
    const userVol = prefs && typeof prefs.volume === 'number' ? Math.max(0, Math.min(1, prefs.volume / 100)) : 1;
    masterGain.gain.setValueAtTime(0.6 * userVol, t);
    masterGain.connect(ctx.destination);

    if (type === 'message') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.4);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(t);
      osc.stop(t + 0.8);

      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.frequency.setValueAtTime(1500, t);
      click.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      clickGain.gain.setValueAtTime(0.15, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      click.connect(clickGain);
      clickGain.connect(masterGain);
      click.start(t);
      click.stop(t + 0.1);
    } else if (type === 'join') {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();

      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(800, t);
      noiseFilter.frequency.linearRampToValueAtTime(2500, t + 0.2);

      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noise.start(t);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);

      oscGain.gain.setValueAtTime(0, t);
      oscGain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      oscGain.gain.linearRampToValueAtTime(0, t + 0.3);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'leave') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
      
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'hover') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.frequency.setValueAtTime(2000, t);
      osc.type = 'square';
      
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.03);
    } else if (type === 'toggle') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(10, t + 0.1);
      
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'send') {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();

      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(3000, t);

      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(0.4, t + 0.03);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noise.start(t);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);

      oscGain.gain.setValueAtTime(0, t);
      oscGain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  } catch (e) {
    console.error('Sound playback error:', e);
  }
};