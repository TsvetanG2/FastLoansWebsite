// Local stand-in for the Resend API: records sent emails, can be told to fail.
// Test helpers: POST /__mode {"lead":"fail"}, GET /__sent, POST /__reset.
// Receiving: GET /emails/receiving/<id> and /emails/receiving/<id>/attachments return a fixed
// received email (sender, reply-to, one attachment); forwards are recorded with kind "forward".
// Usage: node tests/e2e/mock-resend.mjs [log.json]   (listens on 8790)
import http from 'http'; import fs from 'fs';
const LOG = process.argv[2];
let mode = { lead: 'ok', confirm: 'ok' }; let n = 0; const sent = [];
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    if (req.url === '/__mode') { mode = { ...mode, ...JSON.parse(body) }; res.end('ok'); return; }
    if (req.url === '/__sent') { res.setHeader('content-type','application/json'); res.end(JSON.stringify(sent)); return; }
    if (req.url === '/__reset') { sent.length = 0; mode = { lead: 'ok', confirm: 'ok' }; res.end('ok'); return; }
    if (req.method === 'GET' && /^\/emails\/receiving\/[^/]+\/attachments/.test(req.url)) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ object: 'list', has_more: false, data: [
        { id: 'att-1', filename: 'lichna-karta.pdf', size: 1234, content_type: 'application/pdf', content_disposition: 'attachment', download_url: 'https://example.com/att-1', expires_at: '2099-01-01T00:00:00Z' },
      ] })); return;
    }
    if (req.method === 'GET' && req.url.startsWith('/emails/receiving/')) {
      const id = req.url.split('/')[3].split('?')[0];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ object: 'email', id, to: ['finance@royalfinance.bg'], from: 'Иван Петров <ivan@example.com>', created_at: '2026-10-24T09:30:00Z',
        subject: 'Въпрос за кредит\r\nBcc: evil@example.com', bcc: null, cc: null, reply_to: null, received_for: ['finance@royalfinance.bg'],
        html: '<p>Здравейте, <b>въпрос</b>.</p>', text: 'Здравейте, въпрос.', headers: null, message_id: '<m1@example.com>', attachments: [] })); return;
    }
    if (req.method === 'POST' && req.url.startsWith('/emails')) {
      const e = JSON.parse(body); const kind = String(req.headers['idempotency-key'] || '').startsWith('inbound-forward/') ? 'forward' : e.to === 'delivered@resend.dev' || (Array.isArray(e.to) && e.to[0] === 'delivered@resend.dev') ? 'lead' : 'confirm';
      sent.push({ kind, ...e, idempotencyKey: req.headers['idempotency-key'] || null, auth: req.headers.authorization ? 'present' : 'missing' });
      if (LOG) fs.writeFileSync(LOG, JSON.stringify(sent, null, 2));
      res.setHeader('content-type', 'application/json');
      if (mode[kind] === 'fail') { res.statusCode = 500; res.end(JSON.stringify({ statusCode: 500, name: 'application_error', message: 'mock failure' })); return; }
      res.end(JSON.stringify({ id: `mock-${kind}-${++n}` })); return;
    }
    res.statusCode = 404; res.end();
  });
}).listen(8790, () => console.log('mock resend on 8790'));
