# CLAUDE.md — Royal Finance website

Marketing site for a Bulgarian fast-loan company. One page, one feature: the loan application form.
All visible site copy is in **Bulgarian**. Code, comments and commits in English.

## Scope

**Build:**
- Single landing page (desktop + mobile), sections in this order:
  1. Header — logo, anchor nav (Начало, За нас, Контакти), phone + working hours
  2. Hero — headline, subline, CTA button scrolling to the form, application form on the right (below on mobile)
  3. Benefits strip — 4 items with icons; first item: "Бързо одобрение — до 10 минути", third: "Гъвкави срокове — от 3 до 60 месеца"
  4. "Защо да избереш Royal Finance?" — short text + checklist
  5. "Как да кандидатстваш?" — 3 steps: Попълни формата → Получете отговор до 10 минути → Вземи своя кредит
  6. Contact block — phone, hours, email
  7. Footer — logo, nav, © year, links to Политика за поверителност and Общи условия
- Legal pages: `/privacy` (Политика за поверителност), `/terms` (Общи условия) — placeholder text marked TODO, client supplies final copy.

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
- Hosting: Vercel (Pro), functions в fra1 (region set in `vercel.json`)
- Email: Resend (official `resend` SDK, server-side only)
- Package manager: npm; Node 24 (Astro 7 needs Node ≥ 22.23.4)

## The form

Fields:
| Field | Type | Rules |
|---|---|---|
| Желана сума | slider + number | 500–5 000 €, step 50 — TODO confirm range with client |
| Срок | slider | 3–60 months, step 1 |
| Име и фамилия | text | required, 2–80 chars |
| Телефон | tel | required, Bulgarian format (+359 / 08…) |
| Имейл | email | required |
| Съгласие | checkbox | required, unchecked by default, links to /privacy |

Requirements:
- Validate client-side AND server-side (same schema, e.g. zod shared between both)
- Cloudflare Turnstile on submit, verified server-side
- Rate-limit the endpoint with `@vercel/firewall` (Firewall rule ID `apply`, condition "@vercel/firewall"); in-memory fallback until the rule exists; honeypot field as extra fallback
- Do not collect ЕГН, ID card data or income at this stage

Submission flow (`/api/apply`, emails via Resend, never called from the browser):
1. Email to the company (`LEADS_EMAIL_TO`) with every form field
   - subject: "Нова заявка: <сума> € / <срок> мес. — <име>"
   - `reply_to` = the applicant's email
   - if this email fails → error to the user with a retry option
2. Confirmation to the applicant, in Bulgarian:
   - "Получихме кандидатурата ти. Наш консултант ще се свърже с теб скоро."
   - never repeat the amount, term or any other personal data
   - never say "одобрена" or "приета" — only "получена"
   - if only this email fails → still show success; log only the Resend id and status
- Templates: HTML + plain-text version, black-and-gold brand, table layout with inline styles (Gmail + Outlook), no remote images
- No personal data in logs, ever
- Test with Resend test addresses (`delivered@resend.dev`) before sending real emails
- Clear states: idle, submitting, success ("Ще се свържем с теб…"), error with retry
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
- GDPR: no third-party trackers by default. If analytics are added, add a cookie consent banner first.
- Resend е обработващ данни в САЩ — трябва да е посочен в Политиката за поверителност. TODO: клиентът подписва DPA с Resend.
- Footer must show company legal name, ЕИК and БНБ registration number — TODO from client.

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
- Hero background: `public/images/hero.webp` (TODO from client/licensed stock), with dark overlay so text keeps WCAG AA contrast.
- Logo: `public/logo.svg` (full) and `public/logo-mark.svg` (crown + R), vectorised from `assets/logo-source.png` and approved. Do not redraw or modify them.
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
```

## Env vars

```
RESEND_API_KEY=        # server only
EMAIL_FROM=            # verified sender, e.g. "Royal Finance <noreply@domain.bg>"
LEADS_EMAIL_TO=        # where new applications go
TURNSTILE_SITE_KEY=    # public, inlined at build time
TURNSTILE_SECRET_KEY=
```
Production values live in Vercel → Settings → Environment Variables. Locally use `.env`.
Never commit `.env`. Keep `.env.example` up to date.

## Workflow

- Small commits, one concern each
- Before marking a task done: `npm run build` passes, `npm run check` passes, form tested with webapp-testing
- Ask instead of guessing on: copy, amounts/ranges, legal text, anything in "Do NOT build"
