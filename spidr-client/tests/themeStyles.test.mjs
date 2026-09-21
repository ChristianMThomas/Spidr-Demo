import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTheme, themeBackground, themeOverlay, themeVariables, CHAT_THEME_VARIABLES } from '../src/lib/themeStyles.js';

test('saved Theme Studio formats retain their colors and background', () => {
  assert.equal(themeBackground({ type: 'solid', primaryColor: '#123456' }).backgroundColor, '#123456');
  assert.equal(themeBackground({ type: 'gradient', primaryColor: '#123456', secondaryColor: '#abcdef' }).backgroundImage, 'linear-gradient(135deg, #123456, #abcdef)');
  assert.equal(themeBackground({ type: 'image', backgroundImage: '/wallpaper.png' }).backgroundImage, 'url("/wallpaper.png")');
});
test('partial and malformed saved settings have bounded safe defaults', () => {
  assert.equal(normalizeTheme(null).primaryColor, '#dc2626');
  assert.equal(normalizeTheme({ primaryColor: '#abc' }).primaryColor, '#aabbcc');
  assert.equal(normalizeTheme({ primaryColor: 'red; color:black' }).primaryColor, '#dc2626');
  assert.equal(normalizeTheme({ blur: 99, opacity: -10 }).blur, 20);
  assert.equal(normalizeTheme({ opacity: -10 }).opacity, 0);
  assert.equal(normalizeTheme({ blur: 'oops' }).blur, 0);
});
test('explicit zero and full opacity are respected without forced tint', () => {
  assert.equal(themeOverlay({ opacity: 100, blur: 0 }).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(themeOverlay({ opacity: 0, blur: 8 }).backgroundColor, 'rgba(0, 0, 0, 1)');
  assert.equal(themeOverlay({ blur: 8 }).backdropFilter, 'blur(8px)');
});
test('accent foreground stays legible and chat variables remain independent', () => {
  assert.equal(themeVariables({ primaryColor: '#ffffff' })['--spidr-accent-ink'], '#08090b');
  assert.equal(themeVariables({ primaryColor: '#000000' })['--spidr-accent-ink'], '#ffffff');
  themeVariables({ primaryColor: '#00ff00' });
  assert.equal(CHAT_THEME_VARIABLES['--spidr-accent'], '#ff3333');
  assert.equal(CHAT_THEME_VARIABLES['--spidr-surface'], '#000000');
});
test('image URLs remain a single quoted CSS URL', () => {
  assert.equal(themeBackground({ type: 'image', backgroundImage: '/image (1).png' }).backgroundImage, 'url("/image (1).png")');
  assert.equal(themeBackground({ type: 'image', backgroundImage: '' }).backgroundImage, undefined);
});
