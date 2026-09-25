const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { browserHash } = require('../node_modules/.vite/deps/_metadata.json');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
    page.on('console', message => { if (message.type() === 'error') console.log('BROWSER', message.text()); });
    let profile = { id: 'profile', user_id: 'user' };
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__qa/music') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101012"><div id="root"></div><script type="module">
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import { QueryClient, QueryClientProvider, useQuery } from '/node_modules/.vite/deps/@tanstack_react-query.js?v=${browserHash}';
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const {default: Anthem} = await import('/src/components/spidr/ProfileAnthem.jsx');
        const {default: DJ} = await import('/src/components/spidr/DJMatrix.jsx');
        import '/src/index.css';
        const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
        const session = {host_id:'host',host_user_name:'Riley',track_id:'live:test',track_name:'Mobile DJ test',queue:[],audio_route:'stream'};
        function App(){const {data} = useQuery({queryKey:['userProfile','user'],queryFn:()=>fetch('http://localhost:4000/user-profiles').then(r=>r.json()).then(r=>r[0])});
          return React.createElement(React.Fragment,null,
            React.createElement(Anthem,{userProfile:data,isOwnProfile:true}),
            React.createElement('div',{style:{height:640}},React.createElement(DJ,{channel:{id:'channel',name:'Music'},djSession:session,currentUser:{id:'user'},audio:{audioRoute:'stream',status:'blocked',audioBlocked:true,canControlAudio:true,localVolume:80,setLocalVolume(){},togglePause(){},unlockAudio(){window.unlocked=true}}})));
        }
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client},React.createElement(App)));
      </script></body></html>` });
      if (url.origin === 'http://127.0.0.1:5173') return route.continue();
      let data = {};
      if (url.pathname === '/user-profiles') data = [profile];
      else if (url.pathname === '/user-profiles/profile') { profile = { ...profile, ...route.request().postDataJSON() }; data = profile; }
      else if (url.pathname === '/apple-music/search') data = { tracks: [{ id: '12345', name: 'Apple Anthem', artist: 'Test Artist', external_url: 'https://music.apple.com/song/12345', source: 'apple' }] };
      else if (url.pathname === '/spotify/search') { await new Promise(resolve => setTimeout(resolve, 800)); data = { tracks: [{ id: 'spotify1', name: 'Spotify Anthem', artist: 'Other Artist' }] }; }
      else if (url.pathname.includes('now-playing')) data = null;
      await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(data) });
    });
    await page.addInitScript(() => localStorage.setItem('spidr_token', 'qa'));
    await page.goto('http://127.0.0.1:5173/__qa/music');
    await page.getByRole('button', { name: /Set a profile anthem/ }).click();
    await page.getByPlaceholder('Search songs, artists…').fill('test');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'APPLE MUSIC', exact: true }).click();
    await page.getByText('Apple Anthem', { exact: true }).waitFor();
    await page.waitForTimeout(1000);
    assert.equal(await page.getByText('Spotify Anthem', { exact: true }).count(), 0, 'stale Spotify response must not overwrite Apple results');
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-mobile-anthem-search.png') });
    await page.getByRole('button', { name: 'Set', exact: true }).click();
    await page.getByTitle('Preview unavailable - open on Apple Music').waitFor();
    assert.equal(profile.anthem_provider, 'apple'); assert.equal(profile.anthem_track_id, '12345'); assert.equal(profile.anthem_spotify_id, '');
    await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
    assert.equal(await page.evaluate(() => window.unlocked), true);
    for (const width of [390, 320, 844]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-mobile-dj-' + width + '.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Remove anthem', exact: true }).click();
    await page.getByRole('button', { name: /Set a profile anthem/ }).waitFor();
    assert.equal(profile.anthem_track_id, '');
    assert.deepEqual(errors, []);
    console.log('PASS: mobile Apple anthem search/save/remove, cross-provider request race, and DJ controls/layout at 320/390/844px.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
