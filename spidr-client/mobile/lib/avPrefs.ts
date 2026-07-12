import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Device-local A/V preferences ─────────────────────────────────────────────
// Single source of truth for the `spidr_av_prefs` AsyncStorage blob. Written
// by app/settings/voice-video.tsx, read by the call stack (callManager) at
// media-join time. Deliberately device-local — these are hardware defaults
// for THIS phone, so they never sync to the profile.

export const AV_DEFAULTS = {
  join_muted: false,        // enter calls/voice webs muted
  noise_suppression: true,  // getUserMedia noiseSuppression constraint
  echo_cancellation: true,  // getUserMedia echoCancellation constraint
  speaker_default: false,   // start voice calls on speakerphone
  camera_default_off: true, // video calls start with camera off
};

export type AvPrefs = typeof AV_DEFAULTS;

const KEY = 'spidr_av_prefs';

export async function loadAvPrefs(): Promise<AvPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...AV_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* corrupt blob — fall back to defaults */ }
  return { ...AV_DEFAULTS };
}

export async function saveAvPrefs(prefs: AvPrefs): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
}
