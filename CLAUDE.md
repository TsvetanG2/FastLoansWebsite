# CLAUDE.md — Royal Finance website

Marketing site for a Bulgarian fast-loan company. One page, one feature: the loan application form.
All visible site copy is in **Bulgarian**, formal „Вие“ everywhere (client decision 2026-10-23). Code, comments and commits in English.

## Scope

**Build:**
- Single landing page (desktop + mobile), sections in this order:
  1. Header — logo, nav (Начало, Защо ние → `#about` on „Как бързото финансиране Ви помага“, Контакти — home-page sections only), phone (no working hours). Локация (/location) and Въпроси (/faq) are in the footer nav. Same-page links glide without "#" in the URL; the section/page in view is marked (gold bar, aria-current)
  2. Hero — background photo with dark overlay, logo, H1 „Бързи кредити и бързо финансиране в София“, home title „Бързи кредити в София, Младост | Royal Finance“ (client, 2026-10-28; replaced „Бързо финансиране“). `/location` H1 stays „Бързо финансиране“, tagline, subline, application form on the right (below on mobile). No CTA button: the form is already visible. Logo/copy start level with the top of the form card
  3. „Как бързото финансиране Ви помага“ (`UseCases.astro`, client copy 2026-10-23; replaced the 4-icon benefits strip) — intro + 3 cases one under another, no icons: Непредвидени разходи, Важно събитие, Необходимост от допълнителни средства
  4. "Защо да избереш Royal Finance?" — short text + checklist
  5. „Как да кандидатствате?“ — 3 steps, no numbers (client 2026-10-23): Кандидатствайте онлайн → Получете отговор → Вземете желаната сума
  6. Contact block — phone, hours, email
  7. Footer — logo, nav, row of legal links (Политика за поверителност · Общи условия · Решаване на спорове · Информация за кредитора), row with legal name, ЕИК, БНБ reg. №, © year
- Content pages (spec: `seo.md`; formal "Вие"; layout `ContentPage.astro`):
  - `/faq` — 8–12 real questions, facts only from company.ts / approved claims; FAQPage JSON-LD. No lender in the FAQ or landing copy (no „Кой отпуска кредита?“, no „кредиторът …“) — customers are pointed only to Royal Finance
  - `/location` — office in Младост 1: address + maps link, „Виж ни в Google Maps“ → the Google Business Profile, static map (`OfficeMap.astro`, generated from OpenStreetMap by `scripts/make-office-map.mjs`, shown only when `company.office.geo` is set); interactive map: MapLibre GL + OpenFreeMap „Liberty“ vector style (light, Google-like, labels in Bulgarian; free for commercial use, no key, no cookies → no banner). No Google Maps embed (cookies → consent banner; decided again 2026-10-28) — the Google link is the profile button. MapLibre (~430 KB gz) loads only when the map is on screen and the visitor has interacted (scroll/touch/mouse/key); until then — and without JS — the static image (light OSM, same pin) stands in. Keep it that way or mobile Lighthouse drops to ~65. The image also stays if OpenFreeMap fails or does not load within 10 s (no broken/empty map); /privacy names OpenFreeMap (IP passed to the provider, no cookies), hours, what to bring (only an ID card), contacts, CTA to the form. No invented transport lines
  - `/404` (custom, noindex) and `/maintenance` (noindex; shown for every URL with 503 when `MAINTENANCE_MODE=1` at build — see `scripts/vercel-output.mjs`)
- Legal pages (spec: `legal-pages.md`; all texts are a DRAFT for the client's lawyer; formal "Вие"; TOC at the top, "В сила от" at the bottom; shared layout `LegalPage.astro`):
  - `/privacy` Политика за поверителност — must list every field the form actually collects
  - `/about` Информация за кредитора — two parts: Royal Finance (agent), then the lender (БНБ register link)
  - `/disputes` Решаване на спорове — never link the EU ODR platform (closed after 19.07.2025)
  - `/terms` Общи условия за ползване на сайта
  - URLs and anchors are English (decided 2026-10-23): pages `/about`, `/privacy`, `/terms`, `/disputes`; anchors `#home`, `#about`, `#contact`, form `#apply`. The Bulgarian slugs from `legal-pages.md` (`/za-nas`, `/poveritelnost`, `/obshti-usloviya`, `/sporove`) 301-redirect to them. No accessibility statement page (micro-enterprise exemption); the site still meets WCAG 2.1 AA.
- Company data: `src/data/company.ts` is the single source for legal pages, footer, contact block and emails (`src/config/site.ts` only adapts it for display). Never hardcode it. **Never show `[TODO …]` on the site** (client decision 2026-10-23): leave missing parts out or hide the row, and list them in `LEGAL_TODO.md` — never invent data. Complaints and questions go only to Royal Finance („Глобъл Профинанс“ ЕООД), never to the lender.

**Do NOT build:**
- Loan calculator or any monthly-installment / interest / cost figure
- Testimonials or star ratings
- Customer accounts, login, dashboards, payments
- Chat widgets, popups, newsletter
- TODO: add the items the client excluded

If something is not listed under "Build", ask before adding it.

## Stack

- **Astro** (static output), TypeScript, plain CSS with custom properties (no UI framework)
- Serverless routes (adapter `@astrojs/vercel`): `/api/apply` (form submission) and `/api/inbound` (Resend Receiving webhook: mail to our public address, e.g. finance@royalfinance.bg, is forwarded to the office mailbox — added 2026-10-24 at the client's request). `/api/inbound` accepts only requests with a valid Resend webhook signature, forwards only mail to `INBOUND_ADDRESSES`, never mail from `EMAIL_FROM` (no loops), keeps the sender as reply-to and names them on top (Resend's own `receiving.forward()` drops the sender — do not use it), keeps attachments, idempotency key per received email, logs outcome codes only
- Hosting: Vercel **Hobby** (decided; not Pro — note Hobby is for non-commercial use), functions в fra1. `vercel.json` holds regions + security headers; `scripts/vercel-output.mjs` (run by `npm run build`) copies them into `.vercel/output`, because the adapter does not
- Domain: **https://www.royalfinance.bg is primary** (client, 2026-10-24); royalfinance.bg 308-redirects to it (Vercel → Domains). `site` in astro.config and `SITE` in seo.ts use www. Webhooks must use the www URL (a redirect breaks POST)
- **Security: `security.md` is the spec and wins over this file on security topics.** Dashboard steps are tracked in `SECURITY_TODO.md`.
- Email: Resend (official `resend` SDK, server-side only)
- Package manager: npm; Node 24 (Astro 7 needs Node ≥ 22.23.4)

## The form

Four steps, in this order (form copy uses formal "Вие"). The card takes the height of the current step and eases between heights; steps fade and slide (with reduced motion: fade + height only, no slide). Each step's progress bar fills with the share of its fields that are valid.

| Step | Field | Type | Rules |
|---|---|---|---|
| 1 Сума и срок | Желана сума | slider only (value shown, not typeable) | 500–5 000 €, step 50 — TODO confirm range with client |
| 1 | Срок | slider | 3–60 months, step 1 |
| 2 Лични данни | Вашето име | text | required, 2–40 chars |
| 2 | Вашата фамилия | text | required, 2–40 chars |
| 2 | Телефон за връзка | tel | required; fixed "+359" prefix shown, stored as +359XXXXXXXXX |
| 2 | Имейл | email | required |
| 3 Адрес и работа | Причина за финансиране | select | Покупка на вещи / Плащане на сметки / Рефинансиране на други задължения / Друго |
| 3 | Настоящ адрес | text | required, 5–200 chars |
| 3 | Адрес по лична карта | text | required, 5–200 chars |
| 3 | Град | select | all 257 towns in Bulgaria (`src/lib/cities.ts`) |
| 3 | В собствено жилище ли живеете? | select | Да / При роднини / Под наем / Друго |
| 3 | Какво работите | text | required, free text, 2–100 chars |
| 4 Потвърждение | Съгласие | checkbox | required, unchecked by default, links to /terms and /privacy |

Amount and term come first (easy, engaging start). Consent, submit and the disclaimers have their own last step so no step is taller than the hero (a taller hero used to zoom the cover photo; the photo is now pinned to a fixed height anyway). The submit button looks inactive (dark, gold outline, `aria-disabled`) until consent is ticked but stays clickable, so a click explains what is missing. Every form control is ≥16px font size, or iOS Safari zooms the page on focus. On a step change the page scrolls with the card (desktop: centred; mobile: step label right under the header). On touch screens focus goes to the step itself, not its first field — focusing a field opens the keyboard and the browser then scrolls to it, breaking the scroll (regression found 2026-10-24).

Requirements:
- Enter in a field = "Продължете" (steps 1–2) / submit (step 3); selects keep their own Enter
- Validate client-side AND server-side (same schema, e.g. zod shared between both)
- `/api/apply` checks, cheapest first (see `security.md`): method/content type/Origin → 403; body > 4 KB → 413; strict zod schema (unknown keys → 400, field errors → 422); honeypot `company_website` → fake 200; Turnstile (`action: "apply"`, allowed hostname, `remoteip`; test keys accepted only in dev) → 403; rate limits → 429; then emails
- Rate limits: Upstash Redis (`@upstash/ratelimit`, eu-central-1) — per IP 5/10 min + 20/day, per email 3/day, per phone 3/day; global 200/hour → keep leads, skip confirmations. Keys are `sha256(value + RATE_LIMIT_SALT)`. Redis down → continue with a warning. Never in-memory counters (they do not work on serverless)
- Allowed origins: royalfinance.bg + www (+ `ALLOWED_ORIGINS` env, + localhost:4321 in dev)
- Do not collect ЕГН (TODO: pending client decision), ID card number or income. "Адрес по лична карта" was requested on 2026-10-22 — its legal basis must be in the Privacy Policy

Submission flow (`/api/apply`, emails via Resend, never called from the browser):
1. Email to the company (`LEADS_EMAIL_TO`) with every form field
   - subject: "Нова заявка: <сума> € / <срок> мес. — <име>"
   - `reply_to` = the applicant's email
   - if this email fails → error to the user with a retry option
2. Confirmation to the applicant, in Bulgarian:
   - "Получихме кандидатурата Ви. Наш консултант ще се свърже с Вас скоро."
   - never repeat the amount, term or any other personal data
   - never say "одобрена" or "приета" — only "получена"
   - if only this email fails → still show success
- Templates: HTML + plain-text version, table layout with inline styles (Gmail + Outlook), light neutral surround. Applicant email: dark black-and-gold card; office email: light card (easier to read). Logo mark (crown + R) in the header of both, embedded as a CID attachment (`src/lib/email-logo.ts`, generated by `scripts/make-email-logo.mjs`) — no remote images. Agent disclosure only in the applicant email (the office email is internal)
- Logs: one JSON line per event with only a submission id, timestamp and outcome code. No names, emails, phones, IPs — ever
- Test with Resend test addresses (`delivered@resend.dev`) before sending real emails
- Clear states: idle, submitting, success ("Ще се свържем с Вас…"), error with retry
- Fully keyboard-accessible, labels on every input, errors announced with `aria-live`

## Compliance rules (Bulgaria) — non-negotiable

- **Currency is EUR only.** Bulgaria uses the euro since 01.01.2026. Never show "лв.".
- **No cost figures** — no interest rate, installment, fees or ГПР anywhere. Any such figure legally requires a representative example with ГПР (Закон за потребителския кредит). If the client asks for one, stop and flag it.
- **Client-approved claims** (use exactly these, nowhere stronger):
  - "Бързо одобрение до 10 минути"
  - "Получете отговор до 10 минути"
  - "Срок от 3 до 60 месеца"
  Never turn them into "гарантирано", "мигновено" or "100% одобрение".
- **No other unverifiable claims.** Avoid "без такси", "без скрити разходи", "100% одобрение" unless the client confirms in writing. Mark such copy with `TODO-CLAIM`.
- GDPR: **Vercel Web Analytics** is enabled (cookieless, no IP stored, daily-rotating hash; named in `/privacy`) — no consent banner needed for it (decided 2026-10-23; lawyer to confirm, see `LEGAL_TODO.md`). Any tool that sets cookies, uses advertising or tracks across sites requires a consent banner first.
- Resend е обработващ данни в САЩ — трябва да е посочен в Политиката за поверителност. TODO: клиентът подписва DPA с Resend.
- **Agent model.** „Глобъл Профинанс“ ЕООД (brand Royal Finance) is an *agent* of the lender „Тием Финанси“ ООД (`lender` in `company.ts`, БНБ № BGR00464). It does not lend in its own name.
  - In practice Royal Finance is a separate office that runs everything with the customer, using Тием Финанси's system and licence (legally) under its own brand. The credit contract and the БНБ licence are Тием Финанси's, so the public disclosures below stay.
  - Never write „отпускаме кредити“, „нашите кредити“, „ние одобряваме“. Use „Кредитите се отпускат от …“, „ще получите отговор“, „помагаме Ви да кандидатствате“.
  - The site is the agent's: Royal Finance brand, design, contacts. Mention the lender only where required (under the form, footer, emails, `/about`, privacy recipients, `/disputes`). Never use the lender's logo or brand.
  - `agentStatement` (company.ts) goes in the footer (so it is on every page, including the one with the form), in the applicant email footer, on `/about` and the legal pages. Not under the submit button (removed at the client's request 2026-10-24; the footer on the same page still shows it).
  - **Customers contact only Royal Finance** for any question about the credit, the application or the contract — never direct them to the lender (its data is shown only as the legal disclosure). Lender contacts/website are hidden while missing; no visible TODO rows on `/about`.
- Under the submit button: „Подаването на заявка не е договор за кредит. Договор се сключва след одобрение и предоставяне на преддоговорна информация.“

## Design

Dark luxury style: black background, gold accents, serif headings.

```css
:root {
  --bg: #0a0a0a;
  --bg-elevated: #141414;
  --border-gold: rgba(201, 162, 74, 0.35);
  --gold-1: #c9a24a;
  --gold-2: #e8c97a;
  --gold-gradient: linear-gradient(135deg, var(--gold-1), var(--gold-2));
  --text: #f2ede3;
  --text-muted: #a8a197;
}
```

- Headings: Playfair Display (has Cyrillic). Body: Manrope (has Cyrillic). Self-host fonts, `font-display: swap`.
- Gold used for accents, borders, buttons and icons only — never long body text.
- Icons: thin-line gold, one consistent set (Lucide).
- Hero background: `assets/background.webp` (supplied 2026-10-22 from a free stock site; TODO record the source URL and its licence — free licences usually do not cover trademarks such as the visible car badge), rendered with `<Picture>` as responsive WebP, under a dark overlay so copy keeps WCAG AA contrast (checked ≥ 4.5:1 at the brightest pixel).
- Logo: `public/logo.svg` (full) and `public/logo-mark.svg` (crown + R), vectorised from `assets/logo-source.png` and approved. Do not redraw or modify them.
- Header is sticky and semi-transparent (blur); the hero slides under it (`--header-h`). Sections below the hero fade in on scroll (`data-reveal`, opacity only with reduced motion).
- Mobile first. Breakpoints: 640 / 1024 px. No horizontal scroll at 360 px.
- Use the `frontend-design` skill for any UI work.

## Quality bar

- Lighthouse ≥ 95 in Performance, Accessibility, Best Practices, SEO
- `<html lang="bg">`, meta title/description in Bulgarian, Open Graph image (`public/og.png`, 1200×630). `og:image`/`og:url` use `VERCEL_PROJECT_PRODUCTION_URL` only while it is a `*.vercel.app` address, otherwise `site` (www); canonical is always www
- SEO (spec: `seo.md`; manual steps in `SEO_TODO.md`): local target „бързи кредити Младост/София“. Unique title (≤ 60) + description per page; one H1; canonical `https://www.royalfinance.bg/...` without trailing slash (`trailingSlash: 'never'`, `/x/` → 308); JSON-LD from `src/lib/seo.ts` (FinancialService on every page, with `priceRange` = the form's amount range and `sameAs`/`hasMap` = `company.gbpUrl`, BreadcrumbList on subpages, no ratings); visible breadcrumbs (`Breadcrumbs.astro`, above the H1 of every subpage) built from the same `crumbs` the page passes to Base, so they always match the JSON-LD; sitemap via `@astrojs/sitemap` (no 404/maintenance); `robots.txt` disallows `/api/`. NAP identical everywhere: office бул. „Андрей Сахаров“ № 11, ж.к. Младост 1, 1784 София (`company.officeAddress`). Google Business Profile: `company.gbpUrl` (cid link); every address/maps link (`MapLink.astro`) opens it, and `company.office.geo` is its pin. The registered seat is the same address (client, 2026-10-23)
- Never use: „без проверка в ЦКР“, „с лошо ЦКР“, „гарантирано одобрение“, „без доходи“, „100% одобрение“. Not until the client confirms: „кредит в брой“, „пари в брой“, „до заплата“
- Images in WebP/AVIF with width/height set
- Use the `webapp-testing` skill to check the form after every change: valid submit, each validation error, mobile 375 px, desktop 1440 px

## Commands

```bash
npm run dev       # local dev
npm run build     # production build
npm run preview   # preview build
npm run check     # astro check + type check
npm test          # unit tests (vitest): schema, request guards, Turnstile check, email safety
```

## Env vars

```
RESEND_API_KEY=        # server only; Full access (a sending-only key gets restricted_api_key when /api/inbound reads received mail)
EMAIL_FROM=            # verified sender, e.g. "Royal Finance <noreply@domain.bg>"
LEADS_EMAIL_TO=        # where new applications go
PUBLIC_TURNSTILE_SITE_KEY=  # the only browser-visible value, inlined at build time
TURNSTILE_SECRET_KEY=
UPSTASH_REDIS_REST_URL=     # rate limiting (or KV_REST_API_URL from the Vercel integration)
UPSTASH_REDIS_REST_TOKEN=   # (or KV_REST_API_TOKEN)
RATE_LIMIT_SALT=            # random secret for hashed rate-limit keys
ALLOWED_ORIGINS=            # optional, extra origins for /api/apply (e.g. *.vercel.app before the domain is live)
RESEND_WEBHOOK_SECRET=      # /api/inbound: signing secret of the webhook (Resend → Webhooks, event email.received)
INBOUND_ADDRESSES=          # /api/inbound: our public address(es), comma-separated, e.g. finance@royalfinance.bg
INBOUND_FORWARD_TO=         # /api/inbound: where they are forwarded, e.g. royalfinance@abv.bg
```
Production values live in Vercel → Settings → Environment Variables. Locally use `.env`.
Never commit `.env`. Keep `.env.example` up to date.

## Status (2026-10-24)

- Live on Vercel: https://www.royalfinance.bg (apex 308 → www), DNS at Vercel (nameservers set at SuperHosting). Real Turnstile keys, Web Analytics on, `/api/health` 200
- Resend domain `royalfinance.bg` (eu-west-1) is `partially_verified`: DKIM, `send`, MX verified; `rsend` CNAME → rsend-euw1.forge.rmta.net resolves correctly everywhere but Resend still shows it pending (support: wait up to 72 h). Until then Resend refuses to send (403 "domain is not verified") → the live form returns 502 and finance@ forwarding fails. Do not delete/re-add the records. When verified: test-send to `delivered@resend.dev`, then test the form and finance@ → royalfinance@abv.bg on the live site
- Vercel env: `EMAIL_FROM=Royal Finance <noreply@royalfinance.bg>`, `LEADS_EMAIL_TO` and `INBOUND_FORWARD_TO` = royalfinance@abv.bg, `INBOUND_ADDRESSES=finance@royalfinance.bg`, webhook https://www.royalfinance.bg/api/inbound (`email.received`). `ALLOWED_ORIGINS` no longer needed
- Search Console reported „Sitemap не можа да бъде прочетена“ for `sitemap-index.xml`; the sitemap is valid (200, application/xml, 7 URLs, all 200) — re-submit in a www/Domain property and wait
- Open items (client, lawyer, dashboards, SEO): `LEGAL_TODO.md`, `SECURITY_TODO.md`, `SEO_TODO.md`. Main client decisions: amount range, the three TODO-CLAIM points in Why.astro, holiday hours, ЕГН, documents („само лична карта“)

## Testing

- Unit tests: `npm test` (`tests/unit/`).
- E2E tests are Playwright (Python, `webapp-testing` skill) in `tests/e2e/` — see README for the exact commands. Run them against local stand-ins, never real services: `tests/e2e/mock-resend.mjs` (8790) and `tests/e2e/mock-upstash.mjs` (8791), with the dev server started as `RESEND_BASE_URL=http://127.0.0.1:8790 UPSTASH_REDIS_REST_URL=http://127.0.0.1:8791 UPSTASH_REDIS_REST_TOKEN=test`. Check the server log shows `mock-…` ids before trusting a run.
- The rate limiter caches blocked identifiers in server memory: e2e tests use per-run unique IPs/emails/phones.
- `/api/inbound`: `node tests/e2e/inbound.mjs` with the dev server started as in the header of that file (test webhook secret, mock Resend) — real signed webhooks, checks signature, skips and the forwarded copy.
- CSP: `npm run build && node tests/e2e/serve-output.mjs` serves the build with production headers; `tests/e2e/test_csp.py` checks nothing is blocked (Turnstile, fonts, scripts). Keep scripts external (`vite.build.assetsInlineLimit: 0`) — no inline scripts.
- Before starting a dev server, make sure nothing else listens on 4321 — a stale server with the real key will silently take the traffic.
- Real Resend checks only with test addresses (`delivered@resend.dev`, `delivered+applicant@resend.dev`).

## Workflow

- Small commits, one concern each
- Before marking a task done: `npm run build` passes, `npm run check` passes, form tested with webapp-testing
- Ask instead of guessing on: copy, amounts/ranges, legal text, anything in "Do NOT build"
