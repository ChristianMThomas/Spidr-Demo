/**
 * shareAudioSupport — what can actually carry audio when you share a screen.
 *
 * Screen-share audio is one of the least uniform APIs on the web. The rules
 * below are platform policy, not something the app can work around, and
 * getting them wrong means users pick a source that is silently mute and only
 * find out when someone in the call says they can't hear anything.
 *
 * The matrix:
 *
 *   Spidr desktop (Electron 30)
 *     Windows  — the main process grants `audio: 'loopback'`, which captures
 *                the SYSTEM MIX. That means the Spotify desktop app, a game,
 *                any player, regardless of which window you picked.
 *     macOS    — Electron's loopback grant is Windows-only. macOS has no
 *                system-audio device without a third-party virtual driver
 *                (BlackHole, Loopback), so app audio can't be captured.
 *
 *   Browser (Chromium)
 *     Tab      — "Share tab audio" works everywhere.
 *     Window   — NEVER carries audio, on any OS. Chromium cannot capture
 *                per-window audio at all. Picking the Spotify app window
 *                gives silent video, which is the single most common
 *                "why can't anyone hear my music" case.
 *     Screen   — "Share system audio" works on Windows only. On macOS
 *                Chromium can't capture system audio.
 *
 * Firefox and Safari don't offer display-audio capture in any meaningful
 * form, so they're treated as tab-audio-less.
 */

export function detectPlatform() {
  if (typeof navigator === 'undefined') {
    return { os: 'unknown', isElectron: false, isChromium: false };
  }
  const ua = navigator.userAgent || '';
  const plat = navigator.platform || '';
  const isMac = /Mac/i.test(plat) || /Mac OS X/i.test(ua);
  const isWin = /Win/i.test(plat) || /Windows/i.test(ua);
  const isElectron = !!(typeof window !== 'undefined' && window.electronAPI?.isElectron);
  // Electron is Chromium, and so are Chrome/Edge/Opera/Brave.
  const isChromium = isElectron || (/Chrome|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua));
  return {
    os: isWin ? 'windows' : isMac ? 'macos' : 'linux',
    isElectron,
    isChromium,
  };
}

/**
 * Can a given source kind carry audio here?
 * kind: 'screen' | 'window' | 'tab'
 * Returns { audio: boolean, why: string } — `why` is user-facing.
 */
export function audioSupportFor(kind, platform = detectPlatform()) {
  const { os, isElectron, isChromium } = platform;

  if (!isChromium) {
    return { audio: false, why: 'This browser can\'t share audio. Use the Spidr desktop app or Chrome.' };
  }

  if (isElectron) {
    if (os === 'windows') {
      // Loopback captures the system mix, so every source kind gets audio.
      return { audio: true, why: 'System audio is captured — the Spotify app, games, anything playing.' };
    }
    // macOS / Linux Electron: no loopback grant available.
    return {
      audio: false,
      why: os === 'macos'
        ? 'macOS can\'t capture app audio without a virtual audio device. Share a browser tab playing Spotify Web instead.'
        : 'System audio capture isn\'t available on this platform. Share a browser tab instead.',
    };
  }

  // Plain browser
  if (kind === 'tab') {
    return { audio: true, why: 'Tick "Share tab audio" in the picker or nobody will hear it.' };
  }
  if (kind === 'window') {
    return {
      audio: false,
      why: 'Browsers can never capture window audio. Share the tab playing the music, or use the Spidr desktop app.',
    };
  }
  // whole screen
  if (os === 'windows') {
    return { audio: true, why: 'Tick "Share system audio" in the picker or nobody will hear it.' };
  }
  return {
    audio: false,
    why: 'macOS browsers can\'t capture system audio. Share the tab playing the music instead.',
  };
}

/**
 * The single best route to shared music audio for this environment, used to
 * steer the user before they pick something silent.
 */
export function bestAudioRoute(platform = detectPlatform()) {
  const { os, isElectron, isChromium } = platform;
  if (!isChromium) {
    return { kind: null, label: 'Open Spidr in the desktop app or Chrome to share audio.' };
  }
  if (isElectron && os === 'windows') {
    return { kind: 'window', label: 'Pick the Spotify window — system audio comes through automatically.' };
  }
  if (isElectron) {
    return { kind: 'tab', label: 'Play music in a browser tab, then share that tab.' };
  }
  if (os === 'windows') {
    return { kind: 'tab', label: 'Share the tab playing your music, and tick "Share tab audio".' };
  }
  return { kind: 'tab', label: 'Share the Spotify Web tab and tick "Share tab audio".' };
}

/**
 * Does a captured stream actually carry audio? Used post-capture to warn
 * immediately rather than letting the DJ broadcast silence.
 */
export function streamHasAudio(stream) {
  try {
    return !!stream && stream.getAudioTracks().some(t => t.readyState === 'live');
  } catch {
    return false;
  }
}
