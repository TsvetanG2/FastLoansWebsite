// Local stand-in for the Resend API: records sent emails, can be told to fail.
// Test helpers: POST /__mode {"lead":"fail"}, GET /__sent, POST /__reset.
// Usage: node tests/e2e/mock-resend.mjs [log.json]   (listens on 8790)
import http from 'http'; import fs from 'fs';
const LOG = process.argv[2];
let mode = { lead: 'ok', confirm: 'ok' }; let n = 0; const sent = [];
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    if (req.url === '/__mode') { mode = { ...mode, ...JSON.parse(body) }; res.end('ok'); return; }
    if (req.url === '/__sent') { res.setHeader('content-type','application/json'); res.end(JSON.stringify(sent)); return; }
    if (req.url === '/__reset') { sent.length = 0; mode = { lead: 'ok', confirm: 'ok' }; res.end('ok'); return; }
    if (req.method === 'POST' && req.url.startsWith('/emails')) {
      const e = JSON.parse(body); const kind = e.to === 'delivered@resend.dev' || (Array.isArray(e.to) && e.to[0] === 'delivered@resend.dev') ? 'lead' : 'confirm';
      sent.push({ kind, ...e, auth: req.headers.authorization ? 'present' : 'missing' });
      if (LOG) fs.writeFileSync(LOG, JSON.stringify(sent, null, 2));
      res.setHeader('content-type', 'application/json');
      if (mode[kind] === 'fail') { res.statusCode = 500; res.end(JSON.stringify({ statusCode: 500, name: 'application_error', message: 'mock failure' })); return; }
      res.end(JSON.stringify({ id: `mock-${kind}-${++n}` })); return;
    }
    res.statusCode = 404; res.end();
  });
}).listen(8790, () => console.log('mock resend on 8790'));
