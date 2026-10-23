// Serves the production build (.vercel/output/static) with the response headers from
// .vercel/output/config.json, to test the CSP in a real browser. No API routes;
// /_vercel/insights (Web Analytics) is stubbed.
// Usage: npm run build && node tests/e2e/serve-output.mjs [port=4500]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const PORT = Number(process.argv[2] ?? 4500);
const ROOT = path.resolve('.vercel/output/static');
const config = JSON.parse(fs.readFileSync('.vercel/output/config.json', 'utf8'));
const headerRoutes = config.routes.filter((r) => r.headers && r.continue);
// Maintenance mode (MAINTENANCE_MODE=1 at build): a 503 rewrite to the maintenance page
const maintenance = config.routes.find((r) => r.status === 503 && r.dest);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    for (const r of headerRoutes) if (new RegExp(r.src).test(url.pathname)) for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    if (maintenance && new RegExp(maintenance.src).test(url.pathname)) {
      for (const [k, v] of Object.entries(maintenance.headers ?? {})) res.setHeader(k, v);
      res.statusCode = 503;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return fs.createReadStream(path.join(ROOT, maintenance.dest)).pipe(res);
    }
    // Vercel serves Web Analytics at /_vercel/insights; stand in for it locally
    if (url.pathname.startsWith('/_vercel/insights')) {
      res.statusCode = url.pathname.endsWith('.js') ? 200 : 204;
      res.setHeader('content-type', 'text/javascript');
      return res.end(url.pathname.endsWith('.js') ? '/* local stand-in for Vercel Web Analytics */' : '');
    }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.statusCode = 404;
      return res.end('not found');
    }
    res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`serving build with production headers on ${PORT}`));
