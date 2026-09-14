const express = require('express');
const multer  = require('multer');
const authMW  = require('../middleware/auth');
const { uploadFile } = require('../utils/azureStorage');

const router  = express.Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  // Audio — voice messages record as webm/opus in most browsers, so this MUST
  // include audio/webm (its absence silently rejected every voice note).
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  'audio/webm', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/opus',
]);

// Some browsers send a codecs suffix (e.g. "audio/webm;codecs=opus") or an
// empty/octet-stream type for blobs. Normalize to the base mime before checking.
function isAllowed(mimetype = '') {
  const base = mimetype.split(';')[0].trim().toLowerCase();
  if (ALLOWED_MIME_TYPES.has(base)) return true;
  // Last-resort: allow generic audio/* and the common octet-stream blob case
  // only when it's clearly audio (handled by the caller's extension), but keep
  // images/video strict. audio/* covers exotic recorder mimes safely.
  return base.startsWith('audio/');
}

// ── Magic-byte sniffing ─────────────────────────────────────────────────────
// multer's fileFilter only ever sees the CLIENT-DECLARED Content-Type, so a
// caller could label arbitrary bytes 'image/png'. That matters because in dev
// the uploads dir is served by express.static, which derives the response
// Content-Type from the stored file extension - upload HTML as x.html labelled
// image/png and it came back as text/html. We now identify the real bytes and
// let those, not the filename or the declared type, decide what gets stored.
function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  const b = buf;
  const at = (o, n) => b.subarray(o, o + n).toString('latin1');

  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF)          return 'image/jpeg';
  if (at(0, 8) === '\x89PNG\r\n\x1a\n')                        return 'image/png';
  if (at(0, 3) === 'GIF')                                       return 'image/gif';
  if (at(0, 4) === 'RIFF' && at(8, 4) === 'WEBP')               return 'image/webp';
  if (at(0, 4) === 'RIFF' && at(8, 4) === 'WAVE')               return 'audio/wav';
  if (at(0, 4) === 'OggS')                                      return 'audio/ogg';
  if (at(0, 3) === 'ID3')                                       return 'audio/mpeg';
  if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)                  return 'audio/mpeg';
  // ISO-BMFF (mp4 / mov / m4a) - the brand after 'ftyp' says which.
  if (at(4, 4) === 'ftyp') {
    const brand = at(8, 4);
    if (brand.startsWith('qt'))  return 'video/quicktime';
    if (brand.startsWith('M4A')) return 'audio/mp4';
    return 'video/mp4';
  }
  // EBML - WebM/Matroska. Audio-only and A/V share this header, so the
  // declared type picks the lane (both are in the allowlist).
  if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'webm';
  return null;
}

function familyOf(mime = '') {
  return String(mime).split('/')[0].toLowerCase();
}

const upload  = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowed(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

router.post('/', authMW, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const declared = (req.file.mimetype || '').split(';')[0].trim().toLowerCase();
    const sniffed  = sniffMime(req.file.buffer);
    let effective  = declared;

    if (sniffed === 'webm') {
      // Container matches; trust the declared lane (audio/webm or video/webm).
      effective = declared === 'video/webm' ? 'video/webm' : 'audio/webm';
    } else if (sniffed) {
      // Real bytes win. Cross-family mismatch (HTML claiming to be a PNG,
      // an mp4 claiming to be an image) is a hard reject.
      if (familyOf(sniffed) !== familyOf(declared)) {
        return res.status(415).json({ error: 'File content does not match its declared type' });
      }
      effective = sniffed;
    } else if (familyOf(declared) === 'audio') {
      // Unidentifiable bytes are tolerated ONLY for audio: exotic browser
      // recorders emit containers we can't fingerprint, and rejecting them is
      // what silently broke voice notes before. Keeps prior behaviour.
      effective = declared;
    } else {
      // Images and video always carry a recognisable header.
      return res.status(415).json({ error: 'Unrecognised file content' });
    }

    const url = await uploadFile(req.file.buffer, req.file.originalname, effective);
    res.json({ url, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
