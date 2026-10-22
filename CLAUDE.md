# CLAUDE.md — Royal Finance website

Marketing site for a Bulgarian fast-loan company. One page, one feature: the loan application form.
All visible site copy is in **Bulgarian**. Code, comments and commits in English.

## Scope

**Build:**
- Single landing page (desktop + mobile), sections in this order:
  1. Header — logo, anchor nav (Начало, За нас, Контакти), phone + working hours
  2. Hero — background photo with dark overlay, logo, headline, subline, application form on the right (below on mobile). No CTA button: the form is already visible. Logo/copy start level with the top of the form card
  3. Benefits strip — 4 items with icons; first item: "Бързо одобрение — до 10 минути", third: "Гъвкави срокове — от 3 до 60 месеца"
  4. "Защо да избереш Royal Finance?" — short text + checklist
  5. "Как да кандидатстваш?" — 3 steps: Попълни формата → Получете отговор до 10 минути → Вземи своя кредит
  6. Contact block — phone, hours, email
  7. Footer — logo, nav, row of legal links (Политика за поверителност · Общи условия · Решаване на спорове · Информация за кредитора), row with legal name, ЕИК, БНБ reg. №, © year
- Legal pages (spec: `legal-pages.md`; all texts are a DRAFT for the client's lawyer; formal "Вие"; TOC at the top, "В сила от" at the bottom; shared layout `LegalPage.astro`):
  - `/privacy` Политика за поверителност — must list every field the form actually collects
  - `/about` За нас и информация за кредитора — two parts: agent, then lender (БНБ register link)
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
- One serverless function for form submission (`/api/apply`), adapter `@astrojs/vercel`
- Hosting: Vercel **Hobby** (decided; not Pro — note Hobby is for non-commercial use), functions в fra1. `vercel.json` holds regions + security headers; `scripts/vercel-output.mjs` (run by `npm run build`) copies them into `.vercel/output`, because the adapter does not
- Domain: https://royalfinance.bg (+ www)
- **Security: `security.md` is the spec and wins over this file on security topics.** Dashboard steps are tracked in `SECURITY_TODO.md`.
- Email: Resend (official `resend` SDK, server-side only)
- Package manager: npm; Node 24 (Astro 7 needs Node ≥ 22.23.4)

## The form

Three steps, in this order (form copy uses formal "Вие"). The card takes the height of the current step and eases between heights; steps fade and slide (with reduced motion: fade + height only, no slide). Each step's progress bar fills with the share of its fields that are valid.

| Step | Field | Type | Rules |
|---|---|---|---|
| 1 Лични данни | Вашето име | text | required, 2–40 chars |
| 1 | Вашата фамилия | text | required, 2–40 chars |
| 1 | Телефон за връзка | tel | required; fixed "+359" prefix shown, stored as +359XXXXXXXXX |
| 1 | Имейл | email | required |
| 2 Адрес и работа | Причина за финансиране | select | Покупка на вещи / Плащане на сметки / Рефинансиране на други задължения / Друго |
| 2 | Настоящ адрес | text | required, 5–200 chars |
| 2 | Адрес по лична карта | text | required, 5–200 chars |
| 2 | Град | select | all 257 towns in Bulgaria (`src/lib/cities.ts`) |
| 2 | В собствено жилище ли живеете? | select | Да / При роднини / Под наем / Друго |
| 2 | Какво работите | text | required, free text, 2–100 chars |
| 3 Сума и срок | Желана сума | slider + number | 500–5 000 €, step 50 — TODO confirm range with client |
| 3 | Срок | slider | 3–60 months, step 1 |
| 3 | Съгласие | checkbox | required, unchecked by default, links to /terms and /privacy |

Requirements:
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
   - "Получихме кандидатурата ти. Наш консултант ще се свърже с теб скоро."
   - never repeat the amount, term or any other personal data
   - never say "одобрена" or "приета" — only "получена"
   - if only this email fails → still show success
- Templates: HTML + plain-text version, black-and-gold brand, table layout with inline styles (Gmail + Outlook), no remote images
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
  - `agentStatement` (company.ts) goes under the form, in the footer and in the email footer.
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
- `<html lang="bg">`, meta title/description in Bulgarian, Open Graph image
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
RESEND_API_KEY=        # server only
EMAIL_FROM=            # verified sender, e.g. "Royal Finance <noreply@domain.bg>"
LEADS_EMAIL_TO=        # where new applications go
PUBLIC_TURNSTILE_SITE_KEY=  # the only browser-visible value, inlined at build time
TURNSTILE_SECRET_KEY=
UPSTASH_REDIS_REST_URL=     # rate limiting (or KV_REST_API_URL from the Vercel integration)
UPSTASH_REDIS_REST_TOKEN=   # (or KV_REST_API_TOKEN)
RATE_LIMIT_SALT=            # random secret for hashed rate-limit keys
ALLOWED_ORIGINS=            # optional, extra origins for /api/apply (e.g. *.vercel.app before the domain is live)
```
Production values live in Vercel → Settings → Environment Variables. Locally use `.env`.
Never commit `.env`. Keep `.env.example` up to date.

## Testing

- Unit tests: `npm test` (`tests/unit/`).
- E2E tests are Playwright (Python, `webapp-testing` skill) in `tests/e2e/` — see README for the exact commands. Run them against local stand-ins, never real services: `tests/e2e/mock-resend.mjs` (8790) and `tests/e2e/mock-upstash.mjs` (8791), with the dev server started as `RESEND_BASE_URL=http://127.0.0.1:8790 UPSTASH_REDIS_REST_URL=http://127.0.0.1:8791 UPSTASH_REDIS_REST_TOKEN=test`. Check the server log shows `mock-…` ids before trusting a run.
- The rate limiter caches blocked identifiers in server memory: e2e tests use per-run unique IPs/emails/phones.
- CSP: `npm run build && node tests/e2e/serve-output.mjs` serves the build with production headers; `tests/e2e/test_csp.py` checks nothing is blocked (Turnstile, fonts, scripts). Keep scripts external (`vite.build.assetsInlineLimit: 0`) — no inline scripts.
- Before starting a dev server, make sure nothing else listens on 4321 — a stale server with the real key will silently take the traffic.
- Real Resend checks only with test addresses (`delivered@resend.dev`, `delivered+applicant@resend.dev`).

## Workflow

- Small commits, one concern each
- Before marking a task done: `npm run build` passes, `npm run check` passes, form tested with webapp-testing
- Ask instead of guessing on: copy, amounts/ranges, legal text, anything in "Do NOT build"
