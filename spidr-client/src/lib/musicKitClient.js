// One MusicKit player and authorization state for Settings, profile widgets,
// and the persistent DJ player.
export function createMusicKitClient(api, browser = window) {
  let state = { configured: null, ready: false, connected: false, authorized: false, busy: false, pending: false, error: '' };
  let instance = null, scriptPromise = null, bootPromise = null, session = null, generation = 0;
  let userId = null, boundOwner = null;
  let poll = null, presenceTimer = null, emittedPresence = false, removePlayerListeners = () => {};
  const listeners = new Set();
  const sessionKey = () => browser.localStorage.getItem('spidr_token');
  const ownerKey = 'spidr_apple_music_owner';
  const readOwner = () => { try { return browser.localStorage.getItem(ownerKey); } catch { return boundOwner; } };
  const bindOwner = value => {
    boundOwner = value;
    try { if (value) browser.localStorage.setItem(ownerKey, value); else browser.localStorage.removeItem(ownerKey); } catch {}
  };
  const locallyAuthorized = () => !!userId && readOwner() === userId && !!instance?.isAuthorized;
  const update = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const current = key => key === sessionKey() && key === session;
  const clearPoll = () => { clearInterval(poll); poll = null; };
  const presence = () => {
    const item = instance?.nowPlayingItem;
    const playing = state.authorized && instance?.playbackState === browser.MusicKit?.PlaybackStates?.playing && item;
    if (!playing && !emittedPresence) return;
    emittedPresence = !!playing;
    browser.dispatchEvent(new browser.CustomEvent('spidr:musickit-now-playing', { detail: playing ? {
      isPlaying: true, source: 'apple', provider: 'apple_music',
      trackName: item.title || item.attributes?.name || '',
      artists: [item.artistName || item.attributes?.artistName || ''].filter(Boolean),
      albumArt: (item.artworkURL || item.attributes?.artwork?.url || '').replace('{w}', '120').replace('{h}', '120'),
      durationMs: item.attributes?.durationInMillis || (item.playbackDuration || 0) * 1000,
      positionMs: (instance.currentPlaybackTime || 0) * 1000,
    } : null }));
  };
  function reset() {
    generation++;
    clearPoll();
    clearInterval(presenceTimer);
    removePlayerListeners();
    try { Promise.resolve(instance?.stop()).catch(() => {}); Promise.resolve(instance?.unauthorize()).catch(() => {}); } catch {}
    if (emittedPresence) browser.dispatchEvent(new browser.CustomEvent('spidr:musickit-now-playing', { detail: null }));
    emittedPresence = false;
    instance = null; bootPromise = null; session = null; userId = null;
    update({ configured: null, ready: false, authorized: false, connected: false, busy: false, pending: false, error: '' });
  }
  function loadScript() {
    if (browser.MusicKit) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = browser.document.createElement('script');
      const fail = () => { clearTimeout(timer); script.remove(); scriptPromise = null; reject(new Error('Apple Music could not load. Please retry.')); };
      const timer = setTimeout(fail, 20000);
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      script.onload = () => { clearTimeout(timer); if (browser.MusicKit) resolve(); else fail(); };
      script.onerror = fail;
      browser.document.head.appendChild(script);
    });
    return scriptPromise;
  }
  async function refresh() {
    const key = session;
    if (!key) return;
    const data = await api.status();
    if (!current(key)) return;
    userId = data.user_id || null;
    update({ configured: !!data.configured, connected: !!data.connected, authorized: !!data.connected && locallyAuthorized(), error: data.error || '' });
    if (!state.authorized) presence();
    if (data.connected && state.pending) { clearPoll(); update({ pending: false, busy: false }); }
    return data;
  }
  async function boot(retry = false) {
    const key = sessionKey();
    if (session !== key) reset();
    session = key;
    if (!key) return;
    if (bootPromise) return bootPromise;
    if (state.ready) { await refresh().catch(() => {}); return; }
    const ownGeneration = generation;
    const task = (async () => {
      update({ error: '' });
      try {
        const data = await refresh();
        if (!data?.configured || !current(key) || ownGeneration !== generation) return;
        if (browser.electronAPI?.isElectron) { update({ ready: true }); return; }
        const developer = await api.devToken();
        await loadScript();
        if (!current(key) || ownGeneration !== generation) return;
        const player = await browser.MusicKit.configure({ developerToken: developer.token, app: { name: 'Spidr', build: '1.0.0' } });
        if (!current(key) || ownGeneration !== generation) return;
        removePlayerListeners();
        instance = player;
        // MusicKit may retain another account's authorization across a reload.
        if (player.isAuthorized && !locallyAuthorized()) await player.unauthorize();
        if (!current(key) || ownGeneration !== generation) return;
        const authChanged = () => { update({ authorized: state.connected && locallyAuthorized() }); presence(); };
        const playbackChanged = () => {
          presence();
          clearInterval(presenceTimer);
          if (emittedPresence) presenceTimer = setInterval(presence, 20000);
        };
        player.addEventListener('authorizationStatusDidChange', authChanged);
        player.addEventListener('playbackStateDidChange', playbackChanged);
        player.addEventListener('nowPlayingItemDidChange', playbackChanged);
        removePlayerListeners = () => {
          player.removeEventListener('authorizationStatusDidChange', authChanged);
          player.removeEventListener('playbackStateDidChange', playbackChanged);
          player.removeEventListener('nowPlayingItemDidChange', playbackChanged);
        };
        update({ ready: true, authorized: state.connected && locallyAuthorized() });
      } catch (error) { if (current(key)) update({ ready: false, error: error.message || 'Apple Music is unavailable.' }); }
    })();
    bootPromise = task;
    try { await task; } finally { if (bootPromise === task) bootPromise = null; }
  }
  async function authorize() {
    if (state.busy) return { pending: state.pending };
    const key = session;
    if (!state.ready) throw new Error('Apple Music is not ready. Please retry.');
    update({ busy: true, error: '' });
    try {
      if (browser.electronAPI?.isElectron) {
        const { url } = await api.connectionLink();
        if (!current(key)) throw new Error('Your Spidr account changed. Please reconnect.');
        browser.open(url, '_blank');
        update({ pending: true });
        const deadline = Date.now() + 300000;
        let checking = false;
        clearPoll();
        poll = setInterval(async () => {
          if (Date.now() >= deadline) { clearPoll(); update({ pending: false, busy: false, error: 'Connection timed out. Please try again.' }); return; }
          if (checking) return;
          checking = true;
          try { await refresh(); } catch {} finally { checking = false; }
        }, 3000);
        return { pending: true };
      }
      const token = await instance.authorize();
      if (!token) throw new Error('Authorization was cancelled.');
      if (!current(key)) throw new Error('Your Spidr account changed. Please reconnect.');
      await api.saveUserToken(token);
      if (!current(key)) return;
      bindOwner(userId);
      update({ connected: true, authorized: locallyAuthorized() });
      return { connected: true };
    } catch (error) {
      if (current(key)) update({ error: error.message || 'Could not connect Apple Music.' });
      throw error;
    } finally { if (current(key) && !state.pending) update({ busy: false }); }
  }
  async function unauthorize() {
    if (state.busy && !state.pending) return;
    const key = session;
    update({ busy: true, error: '' });
    try {
      // Do not claim success if server-side disconnect failed.
      await api.disconnect();
      if (!current(key)) return;
      clearPoll();
      bindOwner(null);
      try { await instance?.stop(); await instance?.unauthorize(); } catch {}
      update({ connected: false, authorized: false, pending: false });
      presence();
    } catch (error) { if (current(key)) update({ error: error.message }); throw error; }
    finally { if (current(key)) update({ busy: false }); }
  }
  const onFocus = () => { if (session !== sessionKey()) boot(); else refresh().catch(() => {}); };
  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        browser.addEventListener('focus', onFocus);
        browser.addEventListener('spidr:auth-expired', reset);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          browser.removeEventListener('focus', onFocus);
          browser.removeEventListener('spidr:auth-expired', reset);
          clearPoll();
          if (state.pending) update({ pending: false, busy: false });
        }
      };
    },
    getSnapshot: () => state, getInstance: () => instance, boot, refresh, authorize, unauthorize,
  };
}
