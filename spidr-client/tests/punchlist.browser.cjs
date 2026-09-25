const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

const user = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', username: 'qa', full_name: 'QA User', email: 'qa@example.test' };
const peer = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const message = { id: 'cccccccccccccccccccccccc', scope: 'dm', sender_id: peer, sender_name: 'Riley', recipient_id: user.id, conversation_id: `${user.id}-${peer}`, content: 'A message to save and forward', created_date: new Date().toISOString() };
const writes = [];
const saved = [];
const errors = [];
let profile = { id: user.id, user_id: user.id, display_name: user.full_name };
const themeGroup = { id: 'cdcdcdcdcdcdcdcdcdcdcdcd', name: 'Theme Test Group', owner_id: user.id, members: [{ user_id: user.id }], background_url: '/brand/spidr-wordmark.png' };
const radarServers = [
  { id: 'dddddddddddddddddddddddd', name: 'React Collective', description: 'A place for curious developers. Build, review, and share projects with the community.', tags: ['code', 'frontend'], category: 'technology', rules: ['Be respectful.', 'Share feedback, not spam.'], is_public: true, member_count: 142, friend_count: 2, is_member: false },
  { id: 'eeeeeeeeeeeeeeeeeeeeeeee', name: 'Midnight Studio', description: 'Music production, listening sessions, and late-night experiments.', tags: ['music', 'chill'], category: 'music', rules: ['Respect the artists.'], is_public: false, allow_join_requests: true, member_count: 89, friend_count: 0, is_member: false },
  { id: 'ffffffffffffffffffffffff', name: 'Private Workshop', description: 'A small invite-only creative community.', tags: ['art'], category: 'art', rules: [], is_public: false, allow_join_requests: false, member_count: 24, friend_count: 0, is_member: false },
];
const ownedServer = { id: 'abababababababababababab', name: 'QA Community', owner_id: user.id, members: [{ user_id: user.id, role: 'admin', user_name: 'QA User' }], channels: [{ id: 'general', name: 'general', type: 'text' }], roles: [{ id: 'admin', name: 'Admin', permissions: ['all'] }], tags: ['code'], rules: ['Be kind'], is_public: false, is_discoverable: true, allow_join_requests: true };
let requests = [{ user_id: peer, name: 'Riley', requested_at: new Date().toISOString() }];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
    page.on('requestfailed', request => { if (request.url().includes('/users/me')) console.log('AUTH REQUEST FAILED', request.failure()); });
    page.on('console', message => { if (message.type() === 'error') console.log('BROWSER', message.text().slice(0, 400)); });
    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === 'http://127.0.0.1:5173') return route.continue();
      if (!['xhr', 'fetch'].includes(req.resourceType())) return route.abort();
      if (url.pathname === '/users/me') console.log('AUTH MOCK', req.method());
      let data = [];
      if (req.method() !== 'GET') writes.push({ path: url.pathname, body: req.postDataJSON() });
      if (url.pathname === '/users/me') data = user;
      else if (url.pathname === '/servers/discover') {
        let items = radarServers.filter(s => !url.searchParams.get('q') || [s.name, s.description, ...s.tags].join(' ').toLowerCase().includes(url.searchParams.get('q').toLowerCase()));
        if (url.searchParams.get('view') === 'requests') items = items.filter(s => s.request_pending);
        if (url.searchParams.get('view') === 'friends') items = items.filter(s => s.friend_count > 0);
        if (url.searchParams.get('category')) items = items.filter(s => s.category === url.searchParams.get('category'));
        data = { items, total: items.length, next_page: null };
      }
      else if (url.pathname === '/servers') data = req.method() === 'POST' ? { id: 'created', ...req.postDataJSON() } : [ownedServer];
      else if (url.pathname === '/servers/' + ownedServer.id) data = ownedServer;
      else if (url.pathname === '/servers/' + ownedServer.id + '/join-requests') data = requests;
      else if (url.pathname.includes('/servers/' + ownedServer.id + '/join-requests/')) { requests = []; data = { ok: true }; }
      else if (url.pathname.startsWith('/servers/')) {
        const server = radarServers.find(s => url.pathname.includes(s.id));
        if (server && url.pathname.endsWith('/join')) server.is_member = true;
        else if (server && url.pathname.includes('/join-requests')) server.request_pending = req.method() !== 'DELETE';
        data = { ok: true, name: server?.name };
      }
      else if (url.pathname === '/user-profiles') data = [profile];
      else if (url.pathname === '/user-profiles/' + user.id) { profile = { ...profile, ...req.postDataJSON() }; data = profile; }
      else if (url.pathname === '/group-chats/' + themeGroup.id) data = themeGroup;
      else if (url.pathname.startsWith('/conversation-settings/')) data = { background_url: '/brand/spidr-symbol.png' };
      else if (url.pathname === '/message-actions/destinations') data = [{ id: peer, type: 'dm', name: 'Riley' }];
      else if (url.pathname === '/message-actions/saved') {
        if (req.method() === 'POST') saved.push({ ...message, sender_name: 'Riley', context_name: 'Direct message', source_type: 'dm' });
        data = req.method() === 'GET' ? { items: saved, next_cursor: null } : saved[0];
      }
      else if (url.pathname === '/message-actions/forward') data = { ...message, id: 'forwarded' };
      else if (url.pathname === '/message-actions/read-state') data = { channels: {}, groups: {} };
      else if (url.pathname === '/feeds') data = Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1).padStart(24, '0'), user_id: peer, user_name: 'Riley', type: 'status', title: `Activity ${i + 1}`, content: `Feed entry ${i + 1}`, created_date: new Date().toISOString() }));
      else if (url.pathname.includes('/wallet')) data = { balance: 0 };
      else if (url.pathname.includes('/tension')) data = { level: 1, xp: 0 };
      else if (url.pathname.includes('/streak')) data = { current_streak: 0 };
      else if (url.pathname.includes('apple-music')) data = { configured: false };
      else if (url.pathname.includes('spotify')) data = { connected: false, tracks: [] };
      else if (url.pathname.includes('socket.io')) return route.abort();
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.routeWebSocket(/socket\.io/, socket => socket.close());
    await page.addInitScript(() => {
      if (!location.protocol.startsWith('http')) return;
      if (location.pathname === '/login') localStorage.removeItem('spidr_token');
      else localStorage.setItem('spidr_token', 'qa-browser-fixture');
      localStorage.setItem('spidr_sidebar_position', 'hidden');
    });
    await page.goto('http://127.0.0.1:5173/');
    if (process.env.QUICK_BROWSER_ONLY === '1') {
      await require('./quickBrowser.browser.cjs')({ page });
      assert.deepEqual(errors, []);
      return;
    }
    if (process.env.WEB_LAYOUT_ONLY === '1') {
      await require('./webLayout.browser.cjs')({ page, user });
      assert.deepEqual(errors, []);
      return;
    }
    await page.locator('.spidr-sidebar-handle').waitFor().catch(async error => {
      console.log('PAGE', page.url(), (await page.locator('body').innerText()).slice(0, 2500), errors);
      await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-qa-failure.png') });
      throw error;
    });
    await page.mouse.move(2, 400);
    await page.waitForFunction(() => document.querySelector('.spidr-sidebar-dock')?.dataset.open === 'true');
    await page.mouse.move(500, 500);
    await page.waitForFunction(() => document.querySelector('.spidr-sidebar-dock')?.dataset.open === 'false');
    await page.locator('.spidr-sidebar-handle').focus();
    await page.waitForFunction(() => document.querySelector('.spidr-sidebar-dock')?.dataset.open === 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.spidr-sidebar-dock').getAttribute('data-open'), 'false');
    for (const position of ['left', 'right', 'top', 'bottom']) {
      await page.evaluate(position => window.dispatchEvent(new CustomEvent('spidr-sidebar-pref-changed', { detail: { position } })), position);
      await page.locator('.spidr-sidebar-panel button[aria-label="Friends"]').hover();
      await page.waitForFunction(() => document.querySelector('.spidr-nav-popout')?.getBoundingClientRect().width >= 230);
      const box = await page.locator('.spidr-nav-popout').boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1441 && box.y + box.height <= 1001, `${position} popout stays in viewport`);
      await page.screenshot({ path: path.join(os.tmpdir(), `spidr-sidebar-${position}.png`) });
    }
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('spidr-sidebar-pref-changed', { detail: { position: 'left' } })));
    await page.evaluate(message => window.dispatchEvent(new CustomEvent('spidr-menu-action', { detail: { type: 'message', action: 'save-msg', data: message } })), message);
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'Saved Messages', exact: true }).click();
    await page.getByRole('dialog').getByText(message.content).waitFor();
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-saved.png') });
    await page.keyboard.press('Escape');
    await page.evaluate(message => window.dispatchEvent(new CustomEvent('spidr-menu-action', { detail: { type: 'message', action: 'share', data: message } })), message);
    await page.getByRole('radio', { name: /Riley/ }).click();
    await page.getByRole('button', { name: 'Forward', exact: true }).click();
    await page.waitForTimeout(250);
    assert.ok(writes.some(w => w.path === '/message-actions/forward' && w.body.target_id === peer));
    await page.getByRole('button', { name: /View All/ }).click();
    await page.getByRole('dialog').getByText('Feed entry 8').waitFor();
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-activity.png') });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-home-mobile.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:5173/radar');
    const publicCard = page.getByRole('article', { name: 'React Collective' });
    const privateCard = page.getByRole('article', { name: 'Midnight Studio' });
    await publicCard.getByRole('button', { name: 'Server info & rules' }).click();
    await publicCard.getByText('Share feedback, not spam.').waitFor();
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-radar-desktop.png'), fullPage: true });
    await publicCard.getByRole('button', { name: 'Join server', exact: true }).click();
    await publicCard.getByRole('button', { name: 'Open server' }).waitFor();
    await privateCard.getByRole('button', { name: 'Request to join' }).click();
    await privateCard.getByRole('button', { name: 'Request pending' }).waitFor();
    await page.getByRole('tab', { name: 'My requests' }).click();
    assert.equal(await page.getByRole('article').count(), 1);
    await page.reload();
    await privateCard.getByRole('button', { name: 'Request pending' }).waitFor();
    await privateCard.getByRole('button', { name: 'Cancel request to Midnight Studio' }).click();
    await privateCard.getByRole('button', { name: 'Request to join' }).waitFor();
    await page.getByRole('textbox', { name: 'Search servers' }).fill('nonexistent');
    await page.getByRole('heading', { name: 'No servers found' }).waitFor();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await page.getByRole('article', { name: 'Private Workshop' }).getByRole('button', { name: 'Use invite code' }).click();
    await page.getByRole('dialog', { name: 'Add a server' }).getByPlaceholder('x4k9-zr2').waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Create server', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Add a server' });
    await create.getByPlaceholder('My awesome server').fill('Browser community');
    await create.getByLabel('Category', { exact: true }).selectOption('art');
    await create.getByLabel('Tags (up to 5)', { exact: true }).fill('#art #community');
    await create.getByLabel('Server rules (one per line)', { exact: true }).fill('Be kind\nNo spam');
    await create.getByLabel('Membership', { exact: true }).selectOption('private');
    await create.getByRole('button', { name: 'Create server', exact: true }).click();
    await create.waitFor({ state: 'hidden' });
    assert.ok(writes.some(w => w.path === '/servers' && w.body.is_public === false && w.body.is_discoverable === true && w.body.rules.length === 2));
    await page.setViewportSize({ width: 390, height: 844 });
    await privateCard.getByRole('button', { name: 'Server info & rules' }).click();
    await page.getByRole('heading', { name: 'Signal Radar' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-radar-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:5173/servers/' + ownedServer.id);
    await page.getByText('QA Community', { exact: true }).first().waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(serverId => window.dispatchEvent(new CustomEvent('spidr-open-server-settings', { detail: { serverId } })), ownedServer.id);
    await page.getByRole('button', { name: 'Join requests', exact: true }).click();
    await page.getByRole('button', { name: 'Approve Riley' }).click();
    await page.getByText('No pending join requests.').waitFor();
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-server-requests.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:5173/.dj-preview.html');
    await page.getByRole('heading', { name: 'After Hours' }).waitFor();
    await page.getByRole('button', { name: 'Pause my audio' }).click();
    await page.getByRole('button', { name: 'Resume my audio' }).waitFor();
    await page.getByRole('button', { name: /Queue/ }).click();
    await page.getByText('Nightcall', { exact: true }).waitFor();
    await page.locator('.dj-room').evaluate(el => { el.scrollTop = 0; });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-dj-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-dj-desktop.png'), fullPage: true });
    await require('./webLayout.browser.cjs')({ page, user });
    await require('./connectionsPrivacy.browser.cjs')({ page, user });
    await require('./theme.browser.cjs')({ page, user, peer, themeGroup, ownedServer, writes });
    await require('./quickBrowser.browser.cjs')({ page });
    assert.deepEqual(errors, []);
    console.log('PASS: sidebar positions, save/forward, activity, Radar details/join/requests/create/admin approval, mobile layouts, DJ controls.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
