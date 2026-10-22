// Fires 10 valid submissions in a row from one IP and asserts the 6th gets 429 (5 / 10 min per IP).
// Only meaningful locally: needs Turnstile TEST keys (accepted only by `astro dev`), the Resend mock
// and Redis (or the Upstash mock). Never point it at production.
// Usage: node tests/e2e/rate-limit.mjs [baseUrl=http://localhost:4321]
const BASE = process.argv[2] ?? 'http://localhost:4321';
const ip = `10.99.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

const payload = (n) => ({
  firstName: 'Тест',
  lastName: 'Тестов',
  phone: `0888${200000 + n}`,
  email: `delivered+rate${n}@resend.dev`,
  purpose: 'bills',
  currentAddress: 'ул. Шипка 10',
  idAddress: 'ул. Шипка 10',
  city: 'София',
  housing: 'rent',
  occupation: 'Тестер',
  amount: 1000,
  term: 12,
  consent: true,
  company_website: '',
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
});

const codes = [];
for (let n = 0; n < 10; n++) {
  const res = await fetch(`${BASE}/api/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, 'x-real-ip': ip },
    body: JSON.stringify(payload(n)),
  });
  codes.push(res.status);
}
console.log('status codes:', codes.join(' '));
const ok = codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429 && codes.slice(5).every((c) => c === 429);
console.log(ok ? 'PASS: the 6th request got 429' : 'FAIL: expected 5×200 then 429');
process.exit(ok ? 0 : 1);
