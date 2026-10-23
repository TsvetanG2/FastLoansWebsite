// Runs after `astro build`. The Astro Vercel adapter writes .vercel/output (Build Output API) and
// does not copy `headers` or `regions` from vercel.json. To make sure they reach production, this
// script copies them into the output: headers as `continue` routes at the top of config.json,
// regions into every function's .vc-config.json. vercel.json stays the single source of truth.
import fs from 'node:fs';
import path from 'node:path';

const OUT = '.vercel/output';
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const configPath = path.join(OUT, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// vercel.json `source` uses path-to-regexp; only the catch-all form is used in this project.
const toRegex = (source) => {
  if (source === '/(.*)') return '^/.*$';
  throw new Error(`vercel-output: unsupported header source "${source}" — extend toRegex()`);
};

const headerRoutes = (vercel.headers ?? []).map(({ source, headers }) => ({
  src: toRegex(source),
  headers: Object.fromEntries(headers.map(({ key, value }) => [key, value])),
  continue: true,
}));
// Maintenance mode: MAINTENANCE_MODE=1 (Vercel env var) + Redeploy shows /maintenance for every URL
// with 503 + Retry-After (temporary for search engines). Assets it needs and /api/health stay reachable.
const maintenanceOn = ['1', 'true', 'on'].includes(String(process.env.MAINTENANCE_MODE ?? '').toLowerCase());
const maintenanceFile = ['maintenance/index.html', 'maintenance.html'].find((f) => fs.existsSync(path.join(OUT, 'static', f)));
if (maintenanceOn && !maintenanceFile) throw new Error('vercel-output: MAINTENANCE_MODE is on but the maintenance page was not built');
const maintenanceRoutes = maintenanceOn
  ? [{
      src: '^/(?!_astro/|favicon\\.|logo\\.svg|logo-mark\\.svg|apple-touch-icon\\.png|maintenance|api/health).*$',
      dest: `/${maintenanceFile}`,
      status: 503,
      headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    }]
  : [];

// Drop routes a previous run of this script added, then put ours first
// (ours: the CSP header route, and the 503 maintenance route — no custom keys, Vercel validates config.json)
const marker = (r) => (r.headers && 'Content-Security-Policy' in r.headers && r.continue) || (r.status === 503 && r.headers?.['Retry-After']);
config.routes = [...headerRoutes, ...maintenanceRoutes, ...(config.routes ?? []).filter((r) => !marker(r))];
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

let functions = 0;
if (vercel.regions?.length) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name.endsWith('.func')) {
        const vc = path.join(p, '.vc-config.json');
        const cfg = JSON.parse(fs.readFileSync(vc, 'utf8'));
        cfg.regions = vercel.regions;
        fs.writeFileSync(vc, JSON.stringify(cfg, null, '\t'));
        functions++;
      } else if (entry.isDirectory()) walk(p);
    }
  };
  walk(path.join(OUT, 'functions'));
}

console.log(`vercel-output: ${headerRoutes.length} header route(s), regions ${JSON.stringify(vercel.regions)} → ${functions} function(s), maintenance ${maintenanceOn ? 'ON' : 'off'}`);
