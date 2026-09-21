(() => {
  // A fragment never reaches HTTP access logs or referrers. Remove it immediately.
  const linkToken = location.hash.slice(1);
  history.replaceState(null, '', location.pathname);
  const status = document.getElementById('status');
  const button = document.getElementById('connect');
  let music;
  async function request(path, body) {
    const response = await fetch('/apple-music/auth/' + path, {
      method: 'POST', headers: { Authorization: 'Bearer ' + linkToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Connection failed. Reopen this page from Spidr.');
    return data;
  }
  button.onclick = async () => {
    button.disabled = true;
    status.textContent = 'Waiting for Apple Music authorization...';
    try {
      const token = await music.authorize();
      if (!token) throw new Error('Authorization was cancelled.');
      await request('complete', { music_user_token: token });
      status.textContent = 'Apple Music connected. You can close this tab and return to Spidr.';
      button.textContent = 'Connected';
    } catch (error) {
      status.textContent = error.message || 'Authorization was cancelled. Please try again.';
      button.disabled = false;
    }
  };
  (async () => {
    try {
      if (!/^[a-f0-9]{64}$/.test(linkToken)) throw new Error('Open this connection page from Spidr Settings.');
      const session = await request('session');
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
        const timer = setTimeout(() => reject(new Error('Apple Music could not load. Reopen this page to retry.')), 20000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); reject(new Error('Apple Music could not load. Reopen this page to retry.')); };
        document.head.appendChild(script);
      });
      music = await MusicKit.configure({ developerToken: session.token, app: { name: 'Spidr', build: '1.0.0' } });
      status.textContent = 'Authorize your Apple Music account to connect it to Spidr.';
      button.disabled = false;
    } catch (error) { status.textContent = error.message; }
  })();
})();
