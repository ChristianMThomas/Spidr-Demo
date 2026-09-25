const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

module.exports = async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' Electron/30.5.1', configurable: true });
    let state = { open: false, url: '', title: 'New page', loading: false, muted: true, canGoBack: false, canGoForward: false, error: '' };
    const listeners = new Set();
    const publish = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); return state; };
    window.__quickBrowser = { layouts: [], closes: 0, opens: 0, actions: [] };
    window.electronAPI = { isElectron: true, quickBrowser: {
      open: async () => { window.__quickBrowser.opens++; return publish({ open: true }); },
      close: async () => { window.__quickBrowser.closes++; return publish({ open: false }); },
      layout: async value => { window.__quickBrowser.layouts.push(value); return { ok: true }; },
      navigate: async value => publish({ url: 'https://example.com/guide', title: 'Game guide', error: '' }),
      action: async action => { window.__quickBrowser.actions.push(action); return action === 'mute' ? publish({ muted: !state.muted }) : state; },
      onState: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    } };
  });
  for (const [width, height] of [[1440, 900], [940, 600]]) {
    await page.setViewportSize({ width, height });
    await page.goto('about:blank');
    await page.goto('http://127.0.0.1:5173/#/home');
    await page.getByRole('button', { name: 'Quick browser', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Quick browser' });
    await panel.waitFor();
    await panel.getByRole('textbox', { name: 'Browser address' }).fill('example.com/guide');
    await panel.getByRole('button', { name: 'Go', exact: true }).click();
    await page.waitForFunction(() => window.__quickBrowser.layouts.at(-1)?.visible === true);
    const slot = await panel.locator('[data-quick-browser-slot]').boundingBox();
    const native = await page.evaluate(() => window.__quickBrowser.layouts.at(-1).bounds);
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(slot[key] - native[key]) < 1);
    assert.ok(slot.y >= 100 && slot.y + slot.height <= height - 96, 'native content avoids top chrome and bottom call controls');
    const main = await page.locator('main').boundingBox();
    const pane = await panel.boundingBox();
    assert.ok(main.x + main.width <= pane.x + 1, 'app reserves room beside browser');
    await panel.getByRole('button', { name: 'Unmute browser' }).click();
    await panel.getByRole('button', { name: 'Mute browser' }).waitFor();
    await panel.getByRole('button', { name: 'Open in default browser' }).click();
    assert.ok(await page.evaluate(() => window.__quickBrowser.actions.includes('external')));
    await page.evaluate(() => {
      const modal = document.createElement('div'); modal.id = 'qa-native-overlay';
      modal.setAttribute('aria-modal', 'true'); modal.dataset.state = 'open';
      modal.style.cssText = 'position:fixed;inset:0;z-index:300;background:#0009';
      document.body.append(modal);
    });
    await page.waitForFunction(() => window.__quickBrowser.layouts.at(-1)?.visible === false);
    await page.evaluate(() => document.querySelector('#qa-native-overlay').remove());
    await page.waitForFunction(() => window.__quickBrowser.layouts.at(-1)?.visible === true);
    await page.evaluate(() => { location.hash = '#/friends'; });
    await panel.waitFor();
    assert.equal(await page.evaluate(() => window.__quickBrowser.opens), 1, 'route navigation preserves browser');
    await page.screenshot({ path: path.join(os.tmpdir(), `spidr-quick-browser-${width}.png`) });
    await panel.getByRole('button', { name: 'Close quick browser' }).click();
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.__quickBrowser.closes), 1);
    assert.equal(await page.locator('main').evaluate(el => getComputedStyle(el).marginRight), '0px');
  }
  console.log('PASS: quick-browser UI actions, native slot bounds, overlay suspension, route persistence and close at desktop and minimum window sizes.');
};
