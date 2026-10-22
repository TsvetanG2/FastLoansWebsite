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
// Drop routes a previous run of this script added, then put ours first
const marker = (r) => r.headers && 'Content-Security-Policy' in r.headers && r.continue;
config.routes = [...headerRoutes, ...(config.routes ?? []).filter((r) => !marker(r))];
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

console.log(`vercel-output: ${headerRoutes.length} header route(s), regions ${JSON.stringify(vercel.regions)} → ${functions} function(s)`);
