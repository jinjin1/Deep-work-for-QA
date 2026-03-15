import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

export const uploadRoutes = new Hono();

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
 * Returns null if the input is not a data URL.
 */
export function saveDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) return null;

  const ext = match[1] === 'jpg' ? 'jpeg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
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

// Serve uploaded files
uploadRoutes.get('/:filename', async (c) => {
  const filename = c.req.param('filename');

  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
    return c.json({ error: 'Invalid filename' }, 400);
  }

  const filepath = path.join(getUploadsDir(), filename);

  if (!fs.existsSync(filepath)) {
    return c.json({ error: 'File not found' }, 404);
  }

  const buffer = fs.readFileSync(filepath);
  const ext = path.extname(filename).slice(1);
  const mimeType = ext === 'png' ? 'image/png' : ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
