const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

module.exports = async ({ page, user }) => {
  // A real, locally generated video keeps layout tests independent of remote media.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    const result = new Promise(resolve => {
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
    });
    recorder.start();
    for (let frame = 0; frame < 15; frame++) {
      ctx.fillStyle = '#14232c'; ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#3b9b8a'; ctx.fillRect(40 + frame * 8, 70, 160, 160);
      ctx.fillStyle = '#ffffff'; ctx.font = '24px sans-serif'; ctx.fillText('Spidr layout test', 40, 300);
      await new Promise(resolve => setTimeout(resolve, 65));
    }
    recorder.stop(); stream.getTracks().forEach(track => track.stop());
    return result;
  });
  const clip = {
    id: 'cececececececececececece', author_id: user.id, author_name: 'Austin123',
    video_url: 'http://127.0.0.1:5173/qa-video.webm', aspect_ratio: '1:1',
    caption: 'shadow so tuff', hashtags: ['shadow', 'sonic'],
    server_id: 'abababababababababababab', server_name: 'Punbelievable Secrets',
    views: 31, likes: [user.id], relays: [user.id], comments_count: 0,
    reactions: [{ emoji: '\u2764\ufe0f', users: [user.id] }],
    grafted_audio: { title: 'Test audio', sourceUrl: 'https://example.test/audio', thumbnail: '/brand/spidr-symbol.png' },
    created_date: new Date().toISOString(),
  };
  const mediaRoute = route => route.fulfill({ contentType: 'video/webm', body: Buffer.from(bytes) });
  const clipRoute = route => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(route.request().method() === 'GET' ? [clip] : clip) });
  await page.route('**/qa-video.webm', mediaRoute);
  await page.route('**/clips**', clipRoute);
  const active = page.locator('.clip-card').first();
  async function checkLayout(name) {
    await active.waitFor();
    await active.locator('video').evaluate(video => video.pause());
    await page.waitForFunction(() => document.querySelector('.clip-card video')?.readyState >= 2);
    const layout = await active.evaluate(card => {
      const box = selector => {
        const b = card.querySelector(selector).getBoundingClientRect();
        return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
      };
      const r = card.getBoundingClientRect();
      return { server: box('.clip-server-link'), telemetry: box('.clip-telemetry'), details: box('.clip-details'), actions: box('.clip-actions'), reactions: box('.clip-reactions'), card: { x: r.x, y: r.y, right: r.right, bottom: r.bottom } };
    });
    assert.ok(layout.server.bottom <= layout.telemetry.y + 1, name + ': telemetry below server banner');
    assert.ok(layout.reactions.bottom <= layout.server.y + 1, name + ': reactions above server banner');
    assert.ok(layout.details.right <= layout.actions.x + 1, name + ': action column reserved');
    assert.ok(layout.actions.y >= layout.card.y && layout.actions.bottom <= layout.card.bottom, name + ': actions bounded by card');
    assert.ok(layout.card.x >= 0 && layout.card.right <= (await page.viewportSize()).width + 1, name + ': card stays in viewport');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ': no horizontal overflow');
    await active.locator('.clip-details').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.screenshot({ path: path.join(os.tmpdir(), 'spidr-web-layout-' + name + '.png') });
  }
  for (const [name, width, height, ratio] of [
    ['desktop', 1440, 900, '1:1'], ['wide', 1440, 900, '16:9'],
    ['short-desktop', 1024, 600, '16:9'], ['mobile', 390, 844, '9:16'],
    ['small-mobile', 320, 568, '9:16'], ['landscape', 844, 390, '16:9'],
  ]) {
    clip.aspect_ratio = ratio;
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:5173/feed');
    await checkLayout(name);
    await active.getByRole('button', { name: 'Share clip', exact: true }).click();
    const share = page.getByRole('dialog', { name: 'Share clip options' });
    await share.waitFor();
    const b = await share.boundingBox();
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width + 1 && b.y + b.height <= height + 1, name + ': share menu fits');
    await page.keyboard.press('Escape');
    await active.getByRole('button', { name: 'Comments', exact: true }).click();
    await page.getByRole('button', { name: 'Close comments' }).click();
    await page.locator('.clip-comments').waitFor({ state: 'hidden' });
  }
  await page.unroute('**/qa-video.webm', mediaRoute);
  await page.unroute('**/clips**', clipRoute);
  console.log('PASS: WEB footer, server CTA, reactions, telemetry and action rail do not overlap; share and comments accessible at six viewport/aspect combinations.');
};
