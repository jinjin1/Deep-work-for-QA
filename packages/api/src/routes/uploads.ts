import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

export const uploadRoutes = new Hono();

/** Maximum file size for uploads (10 MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** PNG magic bytes */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** JPEG magic bytes */
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
/** WebP magic bytes (RIFF at 0, WEBP at 8) */
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIG = [0x57, 0x45, 0x42, 0x50];

function bytesMatch(buffer: Buffer, offset: number, expected: number[]): boolean {
  for (let i = 0; i < expected.length; i++) {
    if (buffer[offset + i] !== expected[i]) return false;
  }
  return true;
}

/** Validate that the binary content matches the declared image type */
function validateMagicBytes(buffer: Buffer, declaredType: string): boolean {
  if (buffer.length < 12) return false;
  switch (declaredType) {
    case 'png':
      return bytesMatch(buffer, 0, PNG_MAGIC);
    case 'jpeg':
    case 'jpg':
      return bytesMatch(buffer, 0, JPEG_MAGIC);
    case 'webp':
      return bytesMatch(buffer, 0, WEBP_RIFF) && bytesMatch(buffer, 8, WEBP_SIG);
    default:
      return false;
  }
}

/** Directory where uploaded files are stored */
function getUploadsDir(): string {
  const dir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data/uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Save a base64 data URL to disk and return the relative URL path.
 * Returns null if the input is not a valid image data URL.
 */
export function saveDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) return null;

  const declaredType = match[1];
  const ext = declaredType === 'jpg' ? 'jpeg' : declaredType;
  const buffer = Buffer.from(match[2], 'base64');

  // Enforce file size limit
  if (buffer.length > MAX_FILE_SIZE) {
    console.warn(`[uploads] Rejected file: size ${buffer.length} exceeds limit ${MAX_FILE_SIZE}`);
    return null;
  }

  // Validate magic bytes match declared type
  if (!validateMagicBytes(buffer, declaredType)) {
    console.warn(`[uploads] Rejected file: magic bytes do not match declared type '${declaredType}'`);
    return null;
  }

  const filename = `${uuid()}.${ext}`;
  const filepath = path.join(getUploadsDir(), filename);

  fs.writeFileSync(filepath, new Uint8Array(buffer));
  return `/uploads/${filename}`;
}

/**
 * Process an array of screenshot URLs — convert any data URLs to files.
 */
export function processScreenshotUrls(urls: string[]): string[] {
  return urls.map((url) => {
    if (url.startsWith('data:image/')) {
      return saveDataUrl(url) || url;
    }
    return url;
  });
}

/**
 * Delete an uploaded file from disk.
 */
export function deleteUploadedFile(filename: string): void {
  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return;
  }
  const filepath = path.join(getUploadsDir(), filename);
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (err) {
    console.error(`[uploads] Failed to delete file ${filename}:`, err);
  }
}

// Serve uploaded files
uploadRoutes.get('/:filename', async (c) => {
  const filename = c.req.param('filename');

  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return c.json({ error: 'Invalid filename' }, 400);
  }

  const filepath = path.join(getUploadsDir(), filename);

  if (!fs.existsSync(filepath)) {
    return c.json({ error: 'File not found' }, 404);
  }

  const buffer = fs.readFileSync(filepath);
  const ext = path.extname(filename).slice(1);
  const mimeType = ext === 'png' ? 'image/png' : ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

  c.header('Content-Type', mimeType);
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Disposition', 'inline');
  c.header('Content-Security-Policy', "default-src 'none'");
  return c.body(new Uint8Array(buffer));
});
