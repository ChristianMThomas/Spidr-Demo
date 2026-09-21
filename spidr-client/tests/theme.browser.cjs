const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

module.exports = async function testThemes({ page, peer, themeGroup, ownedServer, writes }) {
  const base = 'http://127.0.0.1:5173';
  const snap = name => page.screenshot({ path: path.join(os.tmpdir(), 'spidr-theme-' + name + '.png') });
  const openStudio = async () => {
    await page.goto(base + '/settings');
    await page.getByRole('tab', { name: 'Appearance' }).click();
    await page.getByRole('button', { name: 'Open Theme Studio' }).click();
    return page.getByRole('dialog');
  };
  const apply = async dialog => {
    await dialog.getByRole('button', { name: 'Apply Theme' }).click();
    await dialog.waitFor({ state: 'hidden' });
  };
  const checkPages = async (mode, accent) => {
    for (const route of ['/friends', '/servers/' + ownedServer.id, '/feed']) {
      await page.goto(base + route);
      await page.locator('.page-theme-surface').waitFor();
      assert.equal(await page.getByRole('button', { name: /Customize/i }).count(), 0);
      assert.equal(await page.locator('.themed-page').evaluate(el => getComputedStyle(el).getPropertyValue('--spidr-accent').trim()), accent);
      const surface = await page.locator('.page-theme-surface').first().evaluate(el => getComputedStyle(el).backgroundColor);
      assert.equal(surface, 'rgba(8, 9, 11, 0.72)');
      const background = await page.locator('[data-theme-background]').evaluate(el => ({ image: getComputedStyle(el).backgroundImage, color: getComputedStyle(el).backgroundColor }));
      if (mode === 'gradient') assert.match(background.image, /linear-gradient/);
      if (mode === 'solid') assert.equal(background.color, 'rgb(22, 163, 74)');
      if (mode === 'image') assert.match(background.image, /spidr-app-icon.png/);
      assert.equal(await page.locator('.themed-page').evaluate(el => getComputedStyle(el).filter), 'none');
      await snap(mode + '-' + route.split('/')[1]);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await snap(mode + '-' + route.split('/')[1] + '-mobile');
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  };
  const checkChats = async mode => {
    for (const kind of ['dm', 'group']) {
      await page.goto(base + '/friends');
      await page.locator('.page-theme-surface').waitFor();
      await page.evaluate(({ kind, peer, groupId }) => {
        if (kind === 'dm') {
          window.__spidrPendingDM = { userId: peer, at: Date.now() };
          window.dispatchEvent(new Event('spidr-pending-dm'));
        } else {
          window.__spidrPendingGroup = { groupId, at: Date.now() };
          window.dispatchEvent(new Event('spidr-pending-group'));
        }
      }, { kind, peer, groupId: themeGroup.id });
      const root = page.locator('[data-chat-theme=' + kind + ']');
      await root.waitFor();
      assert.equal(await root.evaluate(el => getComputedStyle(el).getPropertyValue('--spidr-accent').trim()), '#ff3333');
      assert.equal(await root.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)');
      await root.locator('[style*="background-image"]').first().waitFor();
      assert.match(await root.locator('[style*="background-image"]').first().getAttribute('style'), kind === 'dm' ? /spidr-symbol.png/ : /spidr-wordmark.png/);
      await snap(mode + '-' + kind);
    }
  };
  let dialog = await openStudio();
  await dialog.getByRole('button', { name: 'Matrix', exact: true }).click();
  await apply(dialog);
  assert.ok(writes.some(w => w.body?.app_theme?.primaryColor === '#16a34a'), 'Theme Studio persists to profile');
  assert.equal(await page.locator('[data-app-theme]').evaluate(el => getComputedStyle(el).getPropertyValue('--spidr-accent').trim()), '#16a34a', 'Theme applies without a reload');
  await checkPages('gradient', '#16a34a');
  await checkChats('gradient');
  dialog = await openStudio();
  await dialog.getByRole('button', { name: /^solid$/i }).click();
  await apply(dialog);
  await checkPages('solid', '#16a34a');
  dialog = await openStudio();
  await dialog.getByRole('button', { name: /^image$/i }).click();
  await dialog.getByPlaceholder('https://example.com/wallpaper.jpg').fill('/brand/spidr-app-icon.png');
  await dialog.getByRole('slider').first().focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await apply(dialog);
  await checkPages('image', '#16a34a');
  assert.equal(await page.locator('[data-theme-overlay]').evaluate(el => getComputedStyle(el).backdropFilter), 'blur(1px)');
  await checkChats('image');
  await page.goto(base + '/home');
  await page.locator('img[src="/brand/spidr-wordmark.png"]').first().waitFor();
  assert.ok(await page.locator('img[src="/brand/spidr-wordmark.png"]').first().evaluate(el => el.complete && el.naturalWidth === 1448));
  assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), '/brand/spidr-app-icon.png');
  await page.evaluate(() => localStorage.removeItem('spidr_token'));
  await page.goto(base + '/login');
  await page.getByPlaceholder('you@example.com').waitFor();
  await page.locator('img[src="/brand/spidr-wordmark.png"]').waitFor();
  await snap('login');
  await page.setViewportSize({ width: 390, height: 844 });
  await snap('login-mobile');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  console.log('PASS: centralized Theme Studio saves, reloads, gradient/solid/image on all 3 pages, mobile layouts, DM/group isolation, branding.');
};
