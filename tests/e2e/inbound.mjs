// E2E for /api/inbound against the Resend mock (8790). Start the dev server with:
//   RESEND_BASE_URL=http://127.0.0.1:8790 RESEND_WEBHOOK_SECRET=<TEST_SECRET below>
//   INBOUND_ADDRESSES=finance@royalfinance.bg INBOUND_FORWARD_TO=office@example.com
//   EMAIL_FROM="Royal Finance <noreply@royalfinance.bg>"
// Usage: node tests/e2e/inbound.mjs [base]
import { Webhook } from 'standardwebhooks';

export const TEST_SECRET = 'whsec_' + Buffer.from('royal-finance-inbound-test-secret').toString('base64');
const BASE = process.argv[2] || 'http://localhost:4321';
const MOCK = 'http://127.0.0.1:8790';
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` ${info}`}`); };

const event = (over = {}) => ({
  type: 'email.received',
  created_at: '2026-10-24T09:30:00Z',
  data: { email_id: `in-${Date.now()}-${Math.random()}`, created_at: '2026-10-24T09:30:00Z', from: 'Иван Петров <ivan@example.com>', to: ['finance@royalfinance.bg'], bcc: [], cc: [], received_for: ['finance@royalfinance.bg'], message_id: '<m1@example.com>', subject: 'Въпрос', attachments: [], ...over },
});
const post = (body, { secret = TEST_SECRET, raw } = {}) => {
  const payload = raw ?? JSON.stringify(body);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const ts = new Date();
  const signature = new Webhook(secret).sign(id, ts, payload);
  return fetch(`${BASE}/api/inbound`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': String(Math.floor(ts / 1000)), 'svix-signature': signature },
    body: payload,
  });
};
const forwards = async () => (await (await fetch(`${MOCK}/__sent`)).json()).filter((e) => e.kind === 'forward');
await fetch(`${MOCK}/__reset`, { method: 'POST' });

// Signature
let r = await fetch(`${BASE}/api/inbound`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event()) });
ok('unsigned request → 401', r.status === 401, r.status);
r = await post(event(), { secret: 'whsec_' + Buffer.from('wrong-secret-wrong-secret').toString('base64') });
ok('wrong secret → 401', r.status === 401, r.status);
r = await fetch(`${BASE}/api/inbound`);
ok('GET → 405', r.status === 405, r.status);
r = await post(null, { raw: 'x'.repeat(70 * 1024) });
ok('body over 64 KB → 413', r.status === 413, r.status);
ok('nothing forwarded so far', (await forwards()).length === 0);

// Skips
r = await post({ type: 'email.delivered', created_at: '2026-10-24T09:30:00Z', data: {} });
ok('other event type → 200, ignored', r.status === 200, r.status);
r = await post(event({ to: ['random@royalfinance.bg'], received_for: ['random@royalfinance.bg'] }));
ok('other address on the domain → 200, not forwarded', r.status === 200 && (await forwards()).length === 0, r.status);
r = await post(event({ from: 'Royal Finance <noreply@royalfinance.bg>' }));
ok('mail from our own sender → 200, not forwarded (no loop)', r.status === 200 && (await forwards()).length === 0, r.status);

// Forward
const e = event();
r = await post(e);
ok('mail to finance@ → 200', r.status === 200, r.status);
const [f] = await forwards();
ok('forwarded once', (await forwards()).length === 1);
if (f) {
  ok('to the office mailbox (env)', JSON.stringify(f.to) === JSON.stringify(['office@example.com']), JSON.stringify(f.to));
  ok('from our verified sender', f.from === 'Royal Finance <noreply@royalfinance.bg>', f.from);
  ok('reply goes to the sender', JSON.stringify(f.reply_to) === JSON.stringify(['Иван Петров <ivan@example.com>']), JSON.stringify(f.reply_to));
  ok('sender named on top', f.html.includes('Иван Петров &lt;ivan@example.com&gt;') && f.text.includes('ivan@example.com'));
  ok('original body kept', f.html.includes('<b>въпрос</b>'));
  ok('subject on one line (no header injection)', !/[\r\n]/.test(f.subject) && f.subject.startsWith('Въпрос за кредит'), JSON.stringify(f.subject));
  ok('attachment kept', f.attachments?.[0]?.filename === 'lichna-karta.pdf' && f.attachments[0].path === 'https://example.com/att-1', JSON.stringify(f.attachments));
  ok('idempotency key per received email', f.idempotencyKey === `inbound-forward/${e.data.email_id}`, f.idempotencyKey);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
