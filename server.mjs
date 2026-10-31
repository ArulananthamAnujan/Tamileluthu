// Production server for Node.js hosting (Hostinger, Render, etc.).
// Serves the built website from dist/ and sends every other path to index.html.
// Uses only Node's built-in modules. Run with: npm start
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 3000;

// Build the site on first start if the host did not run "npm run build".
if (!existsSync(join(ROOT, 'index.html'))) {
  console.log('dist/ not found, building the website…');
  const { build } = await import('vite');
  await build();
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
};

async function fileFor(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  const full = normalize(join(ROOT, p));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null; // no ../ escapes
  try {
    const s = await stat(full);
    if (s.isFile()) return full;
    if (s.isDirectory() && existsSync(join(full, 'index.html'))) return join(full, 'index.html');
  } catch { /* not found */ }
  return null;
}

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY }).end();
    return;
  }
  const url = req.url || '/';
  let file = await fileFor(url);
  // Unknown paths load the app (it uses #/ links), but missing assets stay 404.
  if (!file) {
    if (/\.[a-z0-9]+$/i.test(url.split('?')[0])) { res.writeHead(404, SECURITY).end('Not found'); return; }
    file = join(ROOT, 'index.html');
  }
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const cache = file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable'
    : file.endsWith('sw.js') || file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600';
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, ...SECURITY });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500, SECURITY).end('Server error');
  }
}).listen(PORT, () => console.log(`Tamil Eluthu is running on port ${PORT}`));
