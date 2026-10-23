// Generates the static office map for /location from OpenStreetMap tiles, styled dark/gold with
// a pin at the exact office position. Run once (not part of the build) whenever the position changes:
//
//   node scripts/make-office-map.mjs <lat> <lon> [out=public/images/office-map.webp] [--dark]
//
// Default: normal OpenStreetMap colours (placeholder until the interactive map loads, and the no-JS
// fallback). --dark: the black/gold variant.
//
// Why a static image: no third-party requests or cookies for visitors (no consent banner needed),
// the CSP stays as is (img-src 'self'), and it is fast. The page credits "© OpenStreetMap".
// OSM tile usage policy: a handful of tiles fetched once with a real User-Agent is fine.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DARK = process.argv.includes('--dark');
const [lat, lon] = args.slice(0, 2).map(Number);
const out = args[2] ?? 'public/images/office-map.webp';
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error('usage: node scripts/make-office-map.mjs <lat> <lon> [out]');
  process.exit(1);
}

const Z = 17; // street level: blocks and streets readable
const W = 1200; // output 1200×600 (shown at 600×300, sharp on retina)
const H = 600;
const TILE = 256;
const SCALE = 2; // tiles are upscaled ×2 → 600×300 of map area, i.e. the street-level view

// Web Mercator: world pixel coordinates of the office at zoom Z
const n = 2 ** Z;
const px = ((lon + 180) / 360) * n * TILE;
const rad = (lat * Math.PI) / 180;
const py = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * TILE;

const viewW = W / SCALE;
const viewH = H / SCALE;
const left = px - viewW / 2;
const top = py - viewH / 2;
const tx0 = Math.floor(left / TILE);
const ty0 = Math.floor(top / TILE);
const tx1 = Math.floor((left + viewW) / TILE);
const ty1 = Math.floor((top + viewH) / TILE);

const tiles = [];
for (let tx = tx0; tx <= tx1; tx++) {
  for (let ty = ty0; ty <= ty1; ty++) {
    const url = `https://tile.openstreetmap.org/${Z}/${tx}/${ty}.png`;
    const res = await fetch(url, { headers: { 'User-Agent': 'RoyalFinanceSite/1.0 (finance@royalfinance.bg) one-off static map' } });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    tiles.push({ input: Buffer.from(await res.arrayBuffer()), left: (tx - tx0) * TILE, top: (ty - ty0) * TILE });
  }
}

const mosaic = await sharp({
  create: { width: (tx1 - tx0 + 1) * TILE, height: (ty1 - ty0 + 1) * TILE, channels: 3, background: '#000' },
})
  .composite(tiles)
  .png()
  .toBuffer();

// Crop to the view and upscale. Then style in separate passes (sharp applies the operations of one
// pipeline in its own fixed order, not in call order): monochrome → inverted (dark map, light
// streets) → dimmed → warm gold tint (brand colours).
const crop = await sharp(mosaic)
  .extract({ left: Math.round(left - tx0 * TILE), top: Math.round(top - ty0 * TILE), width: viewW, height: viewH })
  .resize(W, H, { kernel: 'lanczos3' })
  .removeAlpha()
  .toBuffer();
let base = crop;
if (DARK) {
  const mono = await sharp(crop).grayscale().negate({ alpha: false }).toBuffer();
  const dim = await sharp(mono).linear(0.5, 6).toBuffer();
  base = await sharp(dim).tint({ r: 214, g: 178, b: 98 }).toBuffer();
}
if (process.env.MAP_DEBUG) await sharp(crop).png().toFile(out.replace(/\.\w+$/, '-raw.png'));

// Gold pin, tip exactly on the office
const pin = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c9a24a"/><stop offset="1" stop-color="#e8c97a"/>
    </linearGradient>
    <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
  ${DARK ? `<circle cx="${W / 2}" cy="${H / 2}" r="34" fill="#e8c97a" fill-opacity="0.18"/>` : ''}
  <g filter="url(#s)" transform="translate(${W / 2} ${H / 2})">
    <path d="M0 0 C -6 -18 -30 -34 -30 -58 A 30 30 0 1 1 30 -58 C 30 -34 6 -18 0 0 Z" fill="${DARK ? 'url(#g)' : '#c9a24a'}" stroke="#14100a" stroke-width="3"/>
    <circle cx="0" cy="-58" r="11" fill="#14100a"/>
  </g>
</svg>`);

fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(base).composite([{ input: pin }]).webp({ quality: 72 }).toFile(out);
console.log(`office map → ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB) for ${lat}, ${lon}`);
