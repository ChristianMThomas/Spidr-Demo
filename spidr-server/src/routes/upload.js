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
    const url = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
