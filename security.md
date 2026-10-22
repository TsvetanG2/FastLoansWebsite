# Security — Royal Finance website

Instructions for Claude Code: harden the site as described below. Where this file conflicts with CLAUDE.md, this file wins for security topics.
Sections marked **MANUAL** are done by a human in dashboards. Do not try to do them; list them in `SECURITY_TODO.md` with a checkbox each.

## Threat model

- All pages are static (Astro) and served from Vercel's CDN. Vercel mitigates DDoS at the edge on every plan, and firewall-blocked traffic is not billed. Static pages are very hard to take down.
- **The only dynamic surface is `POST /api/apply`.** It costs a function run + up to 2 emails per call. Abuse goals: (1) run up the bill, (2) burn the Resend quota, (3) use the confirmation email to spam third parties ("email bombing" — attacker submits someone else's address), (4) flood the client's inbox with fake leads, (5) inject content into emails.
- Everything below targets those five.

## `/api/apply` hardening

Order of checks (cheapest first, stop at first failure):

1. **Method & headers:** only `POST`; `Content-Type: application/json` (or form-urlencoded — pick one); `Origin` must be `https://royalfinance.bg` or `https://www.royalfinance.bg` (+ `http://localhost:4321` in dev only). Otherwise `403`.
2. **Body size:** reject bodies > 4 KB before parsing (`413`).
3. **Schema:** zod, `.strict()` (unknown keys → reject). Limits: name 2–80 chars, letters/spaces/hyphens (Cyrillic + Latin); phone Bulgarian format; email ≤ 254 chars; amount and term integers inside the allowed ranges; consent must be `true`.
4. **Honeypot:** hidden field (`company_website`), off-screen, `tabindex="-1"`, `autocomplete="off"`. If filled → return a fake `200` success and send nothing.
5. **Turnstile:** verify the token server-side with `TURNSTILE_SECRET_KEY`, pass `remoteip`. Require `success === true`, `hostname` in the allowed list and `action === "apply"`. Tokens are single-use; never cache a verification.
6. **Rate limits** (Upstash Redis via `@upstash/ratelimit`, region **eu-central-1**, connected through the Vercel Marketplace; in-memory counters do NOT work on serverless):
   - per IP: 5 submissions / 10 min, 20 / day
   - per applicant email: 3 / day
   - per applicant phone: 3 / day
   - global: 200 / hour → above that, keep accepting leads but **stop sending confirmation emails** and log an alert
   - Store keys as `sha256(value + RATE_LIMIT_SALT)`, never raw IP/email/phone. TTL = the window length.
   - If Redis is unreachable: continue (Turnstile still protects), log a warning.
   - Over limit → `429` with a Bulgarian message: „Твърде много опити. Моля, опитайте отново по-късно или ни се обадете на {{ТЕЛЕФОН}}.“
7. **Send emails** (only now).

Response rules:
- Generic error messages to the browser; no stack traces, no provider error text.
- Function config: region `fra1`, `maxDuration` 10 s.
- Log only: submission id, timestamp, outcome code. No names, emails, phones, IPs.

## Email safety (Resend)

- **Confirmation email to the applicant has fixed text only.** No name, no amount, nothing the user typed. This makes the form useless for spamming third parties.
- Notification to the client: escape all user values for HTML; strip `\r` and `\n` from anything used in the subject; truncate the name in the subject to 40 chars.
- `reply_to` = applicant email only after zod has validated it.
- Resend API key: create a **sending-only** key restricted to the `royalfinance.bg` domain.

## Security headers (`vercel.json`)

Apply to all routes:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'
```

- Avoid inline `<script>`; if Astro emits one, use a hash in the CSP rather than `'unsafe-inline'` for scripts.
- After deploy, check headers with securityheaders.com and the CSP in the browser console (Turnstile must still render).
- Do **not** add `preload` to HSTS yet.

## Cookies

- The site itself sets **no cookies** and uses no pixels or third-party embeds besides Turnstile. Analytics: **Vercel Web Analytics** only (cookieless, same-origin `/_vercel/insights`, no IP stored) — added 2026-10-23 by client decision.
- Turnstile may store a technical identifier used only for bot detection. This is strictly necessary for security → no consent banner needed, but it must be named in `/poveritelnost` (section „Бисквитки“).
- Update `/poveritelnost` (section „Получатели“): add **Upstash** (rate limiting, EU region, stores only hashed identifiers for up to 24 h) as a processor.
- Adding any analytics or marketing tool that sets cookies or tracks across sites requires a consent banner first. Cookieless Vercel Web Analytics is the exception (named in `/privacy`).

## Dependencies & secrets

- Keep dependencies minimal; commit `package-lock.json`; run `npm audit --omit=dev` in CI and before each release; enable Dependabot.
- Secrets only in Vercel env vars. Only the Turnstile **site** key may be exposed to the browser (`PUBLIC_TURNSTILE_SITE_KEY`). New env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_SALT`. Update `.env.example`.
- Add `GET /api/health` returning `200 ok` (no data) for uptime monitoring.

## Tests

- Unit tests for the zod schema and each rejection path.
- A script that fires 10 requests in a row and asserts the 6th gets `429`.
- webapp-testing: normal submit, honeypot submit (fake success, no email), missing Turnstile token, oversized body.

## MANUAL — done in dashboards (copy to `SECURITY_TODO.md`)

- [ ] **Vercel:** Pro plan; **Spend Management** with a hard cap and email alerts (so an attack cannot create a large bill)
- [ ] **Vercel Firewall:** custom rule — `/api/apply`, more than 10 requests / minute from one IP → deny. Know where the **Attack Mode** toggle is, for emergencies.
- [ ] **Vercel:** Deployment Protection on preview deployments; 2FA on the account
- [ ] **Cloudflare Turnstile:** widget restricted to `royalfinance.bg`, `www.royalfinance.bg` (+ a separate widget or test keys for localhost)
- [ ] **Resend:** 2FA; sending-only API key; usage alerts
- [ ] **Upstash:** database in eu-central-1; 2FA
- [ ] **SuperHosting:** 2FA, strong unique password, registrar/transfer lock on the domain
- [ ] **GitHub:** private repo, 2FA
- [ ] **Uptime monitor** (UptimeRobot or Better Stack, free tier) on `/` and `/api/health`, alerts to email/phone
- [ ] Mailbox that receives leads: 2FA (abv.bg or the future domain mailbox)
