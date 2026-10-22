// Local stand-in for the Upstash Redis REST API, enough for @upstash/ratelimit's fixed window.
// EVALSHA always answers NOSCRIPT, so the library falls back to EVAL with the script text;
// the fixed-window script is emulated (INCRBY + PEXPIRE on first hit).
// Test helpers: POST /__reset clears all keys, GET /__keys lists them (to check they are hashed).
// Usage: node tests/e2e/mock-upstash.mjs [port=8791]
import http from 'node:http';

const PORT = Number(process.argv[2] ?? 8791);
const store = new Map(); // key -> { value, expiresAt }

const get = (key) => {
  const e = store.get(key);
  if (e && e.expiresAt && e.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return e;
};

function run(cmd) {
  const [name, ...rest] = cmd;
  switch (String(name).toLowerCase()) {
    case 'evalsha':
      return { error: 'NOSCRIPT No matching script. Please use EVAL.' };
    case 'eval': {
      const [script, numKeys, ...tail] = rest;
      const keys = tail.slice(0, Number(numKeys));
      const args = tail.slice(Number(numKeys));
      if (!String(script).includes('INCRBY')) return { error: 'mock: unsupported script' };
      const [tokens, windowMs, incrementBy] = args.map(Number);
      const e = get(keys[0]);
      const value = (e?.value ?? 0) + incrementBy;
      store.set(keys[0], { value, expiresAt: e ? e.expiresAt : Date.now() + windowMs });
      return { result: [value, tokens] };
    }
    case 'get':
      return { result: get(rest[0])?.value ?? null };
    default:
      return { error: `mock: unsupported command ${name}` };
  }
}

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/__reset') {
        store.clear();
        return res.end('{"ok":true}');
      }
      if (req.url === '/__keys') return res.end(JSON.stringify([...store.keys()]));
      if (req.headers.authorization !== 'Bearer test') {
        res.statusCode = 401;
        return res.end('{"error":"Unauthorized"}');
      }
      const parsed = JSON.parse(body || '[]');
      if (req.url.startsWith('/pipeline') || req.url.startsWith('/multi-exec')) {
        return res.end(JSON.stringify(parsed.map(run)));
      }
      const out = run(parsed);
      if (out.error) res.statusCode = 400;
      res.end(JSON.stringify(out));
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`mock upstash on ${PORT}`));
