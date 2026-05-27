const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Cloudflare R2 (production) ────────────────────────────────────────────────
let r2Client = null;
let r2Bucket = null;
let r2PublicUrl = null;

try {
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  ) {
    const { S3Client } = require('@aws-sdk/client-s3');
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    r2Bucket    = process.env.R2_BUCKET_NAME;
    r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  }
} catch {
  // SDK missing or config incomplete — will use local fallback
}

// ── Local fallback (development) ─────────────────────────────────────────────
const LOCAL_DIR = path.join(__dirname, '../../uploads');
if (!r2Client && !fs.existsSync(LOCAL_DIR)) {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

/**
 * uploadFile(buffer, originalName, mimeType)
 * Returns a public URL string.
 * Uses Cloudflare R2 when configured, local /uploads folder otherwise.
 */
async function uploadFile(buffer, originalName, mimeType) {
  const ext      = path.extname(originalName) || '';
  const key      = `${uuidv4()}${ext}`;
  const type     = mimeType || 'application/octet-stream';

  if (r2Client) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await r2Client.send(new PutObjectCommand({
      Bucket:      r2Bucket,
      Key:         key,
      Body:        buffer,
      ContentType: type,
    }));
    return `${r2PublicUrl}/${key}`;
  }

  // Local fallback
  const localPath = path.join(LOCAL_DIR, key);
  fs.writeFileSync(localPath, buffer);
  const BASE = process.env.SERVER_URL
    || process.env.CLIENT_ORIGIN?.replace(':5173', ':4000')
    || `http://localhost:${process.env.PORT || 4000}`;
  return `${BASE}/uploads/${key}`;
}

module.exports = { uploadFile };
