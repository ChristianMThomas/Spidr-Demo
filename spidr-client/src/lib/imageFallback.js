/**
 * imageFallback — global broken-image safety net.
 *
 * Problem: 136 of the app's 147 <img> tags had no onError handler. Any dead
 * URL (deleted Azure blob, expired CDN link, user-supplied avatar that 404s,
 * offline dev server) rendered the browser's default torn-page icon — the
 * ugly broken-image glyph visible in the server rail and member lists.
 *
 * Rather than touch 136 call-sites (and rely on every FUTURE <img> author
 * remembering), we install ONE capture-phase listener on document. Image
 * load errors do not bubble, but they DO capture — so a single listener at
 * the document root sees every failure in the app, including images inside
 * portals and lazily-mounted routes.
 *
 * Behavior on failure:
 *   1. Swap to an inline SVG placeholder tinted to the Spidr palette. Inline
 *      data-URI means it can never itself 404 (a file-based fallback that
 *      goes missing would loop forever).
 *   2. Mark the element so a second failure can't retrigger (infinite-loop
 *      guard — the classic mistake with onError swaps).
 *   3. Preserve sizing/rounding: we only change the source, so the element's
 *      existing classes keep the layout stable.
 */

// Spider-mark placeholder, red on near-black, sized to fill its box.
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#141416"/>
    <g stroke="#ef4444" stroke-width="2.4" fill="none" stroke-linecap="round">
      <circle cx="32" cy="32" r="7.5" fill="#ef4444" fill-opacity="0.25"/>
      <path d="M24 27 L14 20 M24 32 L12 32 M24 37 L14 44"/>
      <path d="M40 27 L50 20 M40 32 L52 32 M40 37 L50 44"/>
    </g>
  </svg>`
);

const HANDLED = 'spidrImgFallback';

function onImageError(event) {
  const el = event.target;
  if (!el || el.tagName !== 'IMG') return;
  // Guard: never re-swap an element we've already handled, otherwise a
  // failing placeholder would fire error → swap → error → swap forever.
  if (el.dataset[HANDLED] === '1') return;
  el.dataset[HANDLED] = '1';
  // Respect an author-supplied fallback when one exists.
  const custom = el.getAttribute('data-fallback');
  el.src = custom || PLACEHOLDER;
  // Kill srcset too — otherwise the browser may re-resolve to the dead URL.
  if (el.srcset) el.srcset = '';
}

let installed = false;

export function installImageFallback() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // Capture phase (true) is REQUIRED — <img> error events don't bubble.
  document.addEventListener('error', onImageError, true);
}

export { PLACEHOLDER as IMAGE_PLACEHOLDER };
