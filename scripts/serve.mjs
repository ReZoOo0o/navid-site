// Tiny static server for dist/ — used by pdf + screenshot scripts. No deps.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf' };
export async function serveDist(root = 'dist') {
  // Astro writes files to dist/ ROOT regardless of `base` — base only prefixes
  // the URLs in the built HTML. A GitHub project page serves under /<repo>/, so
  // when astro.config carries a base, requests arrive as /<base>/... and must
  // be stripped back before hitting the filesystem, or every asset 404s and
  // pages render unstyled (the PDF and e2e then measure default UA styling).
  let base = '';
  try {
    const m = (await readFile('astro.config.mjs', 'utf8')).match(/\bbase:\s*'([^']+)'/);
    if (m) base = m[1].replace(/\/+$/, '');
  } catch {}
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (base && (p === base || p.startsWith(base + '/'))) p = p.slice(base.length) || '/';
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(root, p));
      if (!file.startsWith(normalize(root))) throw new Error('traversal');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}
