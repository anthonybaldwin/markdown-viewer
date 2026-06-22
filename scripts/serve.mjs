// serve.mjs — tiny static file server for the dev preview (Bun).
import { file } from 'bun';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8137);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown',
  '.map': 'application/json',
};

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/preview/preview.html';
    const abs = path.join(root, p);
    if (!abs.startsWith(root)) return new Response('no', { status: 403 });
    const f = file(abs);
    if (!(await f.exists())) return new Response('not found', { status: 404 });
    const ext = path.extname(abs).toLowerCase();
    return new Response(f, { headers: { 'content-type': TYPES[ext] || 'application/octet-stream' } });
  },
});

console.log(`serving ${root} at http://localhost:${port}`);
