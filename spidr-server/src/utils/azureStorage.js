const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Azure Blob (production) ───────────────────────────────────────────────────
let azureAvailable = false;
let containerClient;

try {
  if (process.env.AZURE_STORAGE_CONN && process.env.AZURE_CONTAINER_NAME) {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const serviceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONN);
    containerClient = serviceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);
    azureAvailable = true;
  }
} catch {
  // Azure SDK not installed or config missing — will use local fallback
}

// ── Local fallback (development) ─────────────────────────────────────────────
const LOCAL_DIR = path.join(__dirname, '../../uploads');
if (!azureAvailable && !fs.existsSync(LOCAL_DIR)) {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

/**
 * uploadFile(buffer, originalName, mimeType)
 * Returns a public URL string.
 * Uses Azure Blob in production, local /uploads folder in dev.
 */
async function uploadFile(buffer, originalName, mimeType) {
  const ext      = path.extname(originalName) || '';
  const blobName = `${uuidv4()}${ext}`;

  if (azureAvailable) {
    const blockBlob = containerClient.getBlockBlobClient(blobName);
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType || 'application/octet-stream' },
    });
    return blockBlob.url;
  }

  // Local fallback: save to /uploads and serve via Express static
  const localPath = path.join(LOCAL_DIR, blobName);
  fs.writeFileSync(localPath, buffer);
  // Use SERVER_URL if set (production), otherwise localhost (development)
  const BASE = process.env.SERVER_URL || process.env.CLIENT_ORIGIN?.replace(':5173',':4000') || `http://localhost:${process.env.PORT || 4000}`;
  return `${BASE}/uploads/${blobName}`;
}

module.exports = { uploadFile };
