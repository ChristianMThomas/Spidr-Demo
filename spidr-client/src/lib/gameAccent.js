/**
 * gameAccent — pick a single accent color for a game.
 *
 * Strategy is hybrid:
 *   1. CURATED_ACCENTS — hand-picked brand colors for games where we want
 *      to guarantee the iconic shade (Valorant red, Fortnite blue, R.E.P.O.
 *      yellow, etc.). This wins over extraction.
 *   2. extractDominantColor() — for everything else, sample pixels off the
 *      game's artwork on a canvas and pick the dominant saturated hue.
 *      Results are cached by URL.
 *
 * Used by the Gaming Uplink card to color its border and accent text.
 */

// Curated overrides — game name (as stored in gaming_status.game) → hex color.
// Keep names matching the keys used in GamingUplink's GAME_ARTWORK / detection.
const CURATED_ACCENTS = {
  'VALORANT':                  '#FF4655', // Riot brand red
  'Fortnite':                  '#67B6FF', // light Fortnite blue
  'Call of Duty: Black Ops 6': '#FFFFFF', // icon is black/white — accent in white
  'Call of Duty':              '#FFFFFF',
  'R.E.P.O.':                  '#F4D03F', // signature yellow
  'League of Legends':         '#C89B3C', // Riot gold
  'Teamfight Tactics':         '#3B82F6', // TFT blue
  'CS2':                       '#F4D03F', // CS yellow
  'Apex Legends':              '#FF7733', // Apex orange-red
  'Overwatch 2':               '#F99E1A', // OW orange
  'Minecraft':                 '#5FAB57', // grass green
  'Genshin Impact':            '#F5A623', // amber
  'Destiny 2':                 '#7E8FD9', // ghost purple-blue
  'Warframe':                  '#19D1A0', // Tenno teal
  'Monster Hunter World':      '#E8C547',
  'Monster Hunter Wilds':      '#E8C547',
  'Rocket League':             '#0099FF',
  'Escape from Tarkov':        '#A8A8A8',
  'World of Warcraft':         '#FFD800',
  'Diablo IV':                 '#B22222',
  "Baldur's Gate 3":           '#8B5CF6',
  'Palworld':                  '#7FBA00',
  'Helldivers 2':              '#FFCC00',
  'Marvel Rivals':             '#E11D48',
  'Delta Force':               '#3B82F6',
  '2XKO':                      '#C0C0C0',
};

export const DEFAULT_ACCENT = '#FFFFFF';

/** @returns {string|null} curated hex color or null if not mapped. */
export function curatedAccent(gameName) {
  if (!gameName) return null;
  return CURATED_ACCENTS[gameName] || null;
}

// Color cache so we don't re-extract for the same image across renders /
// remounts. Keyed by image URL (data URLs from exe icons are stable too).
const colorCache = new Map();

/**
 * Extract the dominant *saturated* color from an image. Returns a hex string
 * or null if the image fails to load (CORS, 404, etc.).
 *
 * Algorithm:
 *   - Downsample to 50×50 on an offscreen canvas (~2500 pixels, plenty for
 *     a stable result without expensive iteration).
 *   - For each pixel, convert RGB → HSL.
 *   - Drop pixels that are near-black, near-white, or low-saturation (gray).
 *     These usually represent background / chrome / shadows, not brand color.
 *   - Bucket the rest by hue quantized to 10° steps. Average the RGB inside
 *     the winning bucket so we return the bucket's actual color, not a
 *     theoretical hue.
 *   - Fall back to white if no saturated pixels survive (e.g. monochrome icon).
 */
export function extractDominantColor(imageUrl) {
  if (!imageUrl) return Promise.resolve(null);
  if (colorCache.has(imageUrl)) return Promise.resolve(colorCache.get(imageUrl));

  return new Promise((resolve) => {
    const img = new Image();
    // Required so we can read pixels back out of the canvas.
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Bucket key (hue / 10) → { count, r, g, b } running sums.
        const buckets = new Map();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 200) continue;

          // RGB → HSL (lightness + saturation only — we re-derive hue below)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 510; // 0..1
          if (l < 0.15 || l > 0.85) continue; // skip near-black / near-white

          const delta = max - min;
          const sat = delta === 0
            ? 0
            : (l < 0.5 ? delta / (max + min) : delta / (510 - max - min));
          if (sat < 0.3) continue; // skip grays / desaturated noise

          // Hue in degrees
          let h;
          if (max === r) h = ((g - b) / delta) % 6;
          else if (max === g) h = (b - r) / delta + 2;
          else                h = (r - g) / delta + 4;
          h = Math.round(h * 60);
          if (h < 0) h += 360;

          const key = Math.round(h / 10) * 10; // 36 buckets
          const slot = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
          slot.count++;
          slot.r += r;
          slot.g += g;
          slot.b += b;
          buckets.set(key, slot);
        }

        if (buckets.size === 0) {
          colorCache.set(imageUrl, DEFAULT_ACCENT);
          return resolve(DEFAULT_ACCENT);
        }

        let best = null;
        for (const slot of buckets.values()) {
          if (!best || slot.count > best.count) best = slot;
        }
        const r = Math.round(best.r / best.count);
        const g = Math.round(best.g / best.count);
        const b = Math.round(best.b / best.count);
        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        colorCache.set(imageUrl, hex);
        resolve(hex);
      } catch {
        // Tainted canvas (cross-origin not allowed) or any other failure
        colorCache.set(imageUrl, null);
        resolve(null);
      }
    };
    img.onerror = () => {
      colorCache.set(imageUrl, null);
      resolve(null);
    };
    img.src = imageUrl;
  });
}

/**
 * Convert a hex color to an rgba() string with the given alpha. Handles
 * 3- and 6-digit hex, and passes rgb()/rgba() through unchanged (so we can
 * paint glows over either curated hex or extracted hex).
 */
export function withAlpha(color, alpha) {
  if (!color) return `rgba(255,255,255,${alpha})`;
  if (color.startsWith('rgb')) return color; // already has its own alpha
  const hex = color.replace('#', '');
  const full = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
