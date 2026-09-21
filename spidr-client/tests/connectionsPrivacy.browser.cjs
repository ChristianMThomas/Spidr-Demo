const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

module.exports = async ({ page, user }) => {
  const base = 'http://127.0.0.1:5173';
  let privacy = { is_private: false, hide_activity: false };
  let connected = false, configured = true, failSave = false, failDisconnect = false, failPrivacy = false;
  const activity = { id: 'acacacacacacacacacacacac', user_id: user.id, user_name: 'QA User', type: 'status', title: 'My activity', content: 'Privacy test activity', is_hidden: false, created_date: new Date().toISOString() };
  const reply = (route, data, status = 200) => route.fulfill({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: 'application/json', body: JSON.stringify(data) });
  await page.route('**/user-profiles/privacy', async route => {
    if (route.request().method() === 'PATCH') {
      if (failPrivacy) return reply(route, { error: 'Privacy save failed' }, 500);
      privacy = { ...privacy, ...route.request().postDataJSON() };
    }
    return reply(route, privacy);
  });
  await page.route('**/apple-music/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user-token')) {
      if (failSave) return reply(route, { error: 'Connection save failed' }, 503);
      connected = true;
    }
    if (url.pathname.endsWith('/disconnect')) {
      if (failDisconnect) return reply(route, { error: 'Disconnect failed' }, 503);
      connected = false;
    }
    return reply(route, { configured, connected, user_id: user.id, token: 'mock-developer-token', error: configured ? '' : 'Apple Music is not configured on this server.' });
  });
  await page.route('**/feeds**', route => {
    if (route.request().method() === 'PATCH') Object.assign(activity, route.request().postDataJSON());
    return reply(route, route.request().method() === 'GET' ? [activity] : activity);
  });
  await page.addInitScript(() => {
    const player = Object.assign(new EventTarget(), {
      isAuthorized: false,
      async authorize() { if (window.__cancelApple) throw new Error('Authorization was cancelled'); this.isAuthorized = true; return 'mock-user-token'; },
      async unauthorize() { this.isAuthorized = false; },
      async stop() {},
    });
    window.MusicKit = { configure: async () => player, PlaybackStates: { playing: 2 } };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/settings');
  await page.getByRole('tab', { name: 'Privacy', exact: true }).click();
  const privateSwitch = page.getByRole('switch', { name: 'Private account' });
  await privateSwitch.click();
  await page.waitForFunction(() => document.querySelector('#private-account')?.getAttribute('aria-checked') === 'true');
  assert.equal(privacy.is_private, true);
  failPrivacy = true;
  await privateSwitch.click();
  await page.getByText('Privacy settings were not saved. Please try again.').waitFor();
  assert.equal(await privateSwitch.getAttribute('aria-checked'), 'true');
  failPrivacy = false;
  await page.getByRole('switch', { name: 'Hide my activity' }).click();
  await page.waitForFunction(() => document.querySelector('#hide-activity')?.getAttribute('aria-checked') === 'true');
  await page.reload();
  await page.getByRole('tab', { name: 'Privacy', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#private-account')?.getAttribute('aria-checked') === 'true');
  await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-privacy-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-privacy-mobile.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('tab', { name: 'Neural', exact: true }).click();
  const apple = page.getByRole('region', { name: 'Apple Music connection' });
  const connect = apple.getByRole('button', { name: 'Connect Apple Music' });
  await page.evaluate(() => { window.__cancelApple = true; });
  await connect.click();
  await apple.getByText('Authorization was cancelled', { exact: true }).waitFor();
  assert.equal(connected, false);
  await page.evaluate(() => { window.__cancelApple = false; });
  failSave = true;
  await connect.click();
  await apple.getByText('Connection save failed', { exact: true }).waitFor();
  assert.equal(connected, false);
  failSave = false;
  await connect.click();
  await apple.getByText('Connected', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-apple-connected.png') });
  failDisconnect = true;
  await apple.getByRole('button', { name: 'Disconnect Apple Music' }).click();
  await apple.getByText('Disconnect failed', { exact: true }).waitFor();
  assert.equal(connected, true);
  failDisconnect = false;
  await apple.getByRole('button', { name: 'Disconnect Apple Music' }).click();
  await apple.getByText('Not connected', { exact: true }).waitFor();
  configured = false;
  await page.reload();
  await page.getByRole('tab', { name: 'Neural', exact: true }).click();
  await apple.getByText('Server setup required', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await apple.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-apple-mobile.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/home');
  await page.getByText('Privacy test activity', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Activity options' }).click();
  await page.getByRole('menuitem', { name: 'Hide activity' }).click();
  await page.getByText('Hidden, only you').waitFor();
  assert.equal(activity.is_hidden, true);
  await page.getByRole('button', { name: 'Activity options' }).click();
  await page.getByRole('menuitem', { name: 'Unhide activity' }).click();
  await page.getByText('Hidden, only you').waitFor({ state: 'hidden' });
  assert.equal(activity.is_hidden, false);
  console.log('PASS: privacy persists, failed saves stay honest, own activity hide/unhide, Apple cancellation/save failure/connect/disconnect/setup states, mobile layouts (mocked MusicKit).');
};
