/**
 * mediaDevicePrefs — the single source of truth for the user's chosen
 * microphone / speaker / camera + processing toggles.
 *
 * Written by Settings → Voice & Video; read by useWebRTC (mic + camera
 * constraints), VoiceChannel (speaker via setSinkId on remote <audio>), and
 * anything else that captures media. localStorage so it survives restarts
 * and applies before any profile fetch resolves.
 */
const KEY = 'spidr_media_devices';

export const DEFAULT_MEDIA_PREFS = {
  micId: '',            // '' = system default
  speakerId: '',
  cameraId: '',
  inputVolume: 100,
  outputVolume: 100,
  noiseSuppression: true,
  echoCancellation: true,
};

export function getMediaPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_MEDIA_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_MEDIA_PREFS };
  } catch {
    return { ...DEFAULT_MEDIA_PREFS };
  }
}

export function setMediaPrefs(patch) {
  const next = { ...getMediaPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  // Live listeners (e.g. an active call applying a new speaker) can react.
  try { window.dispatchEvent(new CustomEvent('spidr-media-prefs-changed', { detail: next })); } catch {}
  return next;
}

/** Apply the chosen output device to an <audio>/<video> element (Chrome/Edge/
 *  Electron support setSinkId; Safari doesn't — we no-op there). */
export async function applySink(el) {
  const { speakerId } = getMediaPrefs();
  if (!el || !speakerId || typeof el.setSinkId !== 'function') return;
  try { await el.setSinkId(speakerId); } catch { /* device unplugged etc. */ }
}
