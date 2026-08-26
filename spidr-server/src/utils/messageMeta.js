/**
 * messageMeta — derive search/gallery flags from a message at write time.
 *
 * The Images and Links tabs must not scan message bodies at query time. With
 * enough history that becomes a full collection scan per tab open. Instead we
 * compute boolean flags once, on save, and index them — so opening a gallery
 * is an index hit regardless of how much history a chat has.
 *
 * Attachments in this codebase are Mixed: sometimes a plain URL string,
 * sometimes { url, type, name }. Both shapes are handled.
 */

// Deliberately permissive on the scheme but anchored on a real TLD-ish host,
// so "e.g." or "3.5" in prose don't register as links.
const URL_REGEX = /\bhttps?:\/\/[^\s<>"')]+/gi;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

function attachmentUrl(a) {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return a.url || a.file_url || a.src || '';
}

function attachmentType(a) {
  if (!a || typeof a === 'string') return '';
  return (a.type || a.mime || '').toLowerCase();
}

function isImageAttachment(a) {
  const t = attachmentType(a);
  if (t.startsWith('image/') || t === 'image') return true;
  const url = attachmentUrl(a);
  return IMAGE_EXT.test(url);
}

function isVideoAttachment(a) {
  const t = attachmentType(a);
  if (t.startsWith('video/') || t === 'video') return true;
  return VIDEO_EXT.test(attachmentUrl(a));
}

/**
 * Returns { has_images, has_links, media_urls, link_urls }.
 * media_urls holds image/video attachment URLs plus any bare image URLs
 * pasted into the body — people share pictures by pasting links constantly,
 * and a gallery that ignored those would look broken.
 */
function extractMessageMeta(content = '', attachments = []) {
  const list = Array.isArray(attachments) ? attachments : [];

  const media_urls = [];
  for (const a of list) {
    const url = attachmentUrl(a);
    if (!url) continue;
    if (isImageAttachment(a) || isVideoAttachment(a)) media_urls.push(url);
  }

  const link_urls = [];
  const body = typeof content === 'string' ? content : '';
  const found = body.match(URL_REGEX) || [];
  for (const raw of found) {
    // Trim trailing punctuation that commonly rides along in prose.
    const url = raw.replace(/[.,;:!?)\]}]+$/, '');
    if (IMAGE_EXT.test(url) || VIDEO_EXT.test(url)) {
      media_urls.push(url);   // a pasted image link belongs in the gallery
    } else {
      link_urls.push(url);
    }
  }

  return {
    has_images: media_urls.length > 0,
    has_links:  link_urls.length > 0,
    media_urls,
    link_urls,
  };
}

module.exports = { extractMessageMeta, URL_REGEX };
