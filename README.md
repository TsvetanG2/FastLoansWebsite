# Royal Finance — сайт за бързи кредити

Едностраничен сайт (Astro, статичен) с форма за кандидатстване в 4 стъпки.
Заявките се изпращат по имейл през Resend от една serverless функция (`/api/apply`) във Vercel.

Пълните правила за проекта (обхват, дизайн, compliance) са в [CLAUDE.md](CLAUDE.md).

## Локално

Нужен е **Node 24** (Astro 7 изисква поне 22.23.4).

```bash
npm install
cp .env.example .env   # попълни стойностите
npm run dev            # http://localhost:4321
npm run check          # проверка на типовете
npm test               # unit тестове (vitest)
npm run build          # production build → .vercel/output (+ headers и регион от vercel.json)
```

Ако системният Node е по-стар, може временно:
`npx -y -p node@24 -- node ./node_modules/astro/bin/astro.mjs dev`

## Env променливи

| Име | За какво |
|---|---|
| `RESEND_API_KEY` | ключ за Resend (само на сървъра) |
| `EMAIL_FROM` | подател от потвърден в Resend домейн, напр. `Royal Finance <noreply@domain.bg>` |
| `LEADS_EMAIL_TO` | къде отиват заявките |
| `PUBLIC_TURNSTILE_SITE_KEY` | публичен ключ на Turnstile, вгражда се **при build** (единственото, което браузърът вижда) |
| `TURNSTILE_SECRET_KEY` | таен ключ за Turnstile |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis за rate limiting (или `KV_REST_API_URL` / `KV_REST_API_TOKEN` от интеграцията) |
| `RATE_LIMIT_SALT` | случаен таен низ за хешираните ключове на лимитите |
| `ALLOWED_ORIGINS` | по желание: допълнителни origins за формата, напр. адресът `*.vercel.app` преди домейна |

Локално: `.env` (не се commit-ва). Продукция: Vercel → Settings → Environment Variables.

## Deploy във Vercel и сигурност

Правилата за сигурност са в [security.md](security.md). Всичко, което се прави ръчно в таблата
(Vercel, Upstash, Turnstile, Resend, домейн, мониторинг), е чеклист в [SECURITY_TODO.md](SECURITY_TODO.md).
Първо тествай с `LEADS_EMAIL_TO=delivered@resend.dev`, после смени с истинския адрес.

## Maintenance режим

Vercel → Settings → Environment Variables → `MAINTENANCE_MODE` = `1` (само Production) → Redeploy.
Всички адреси показват страницата „Сайтът се обновява“ със статус 503 (Google го приема за временно).
Изключване: изтрий променливата → Redeploy. Локално: `MAINTENANCE_MODE=1 npm run build && node tests/e2e/serve-output.mjs`.

SEO ръчните стъпки са в [SEO_TODO.md](SEO_TODO.md).

## Тестове

Unit: `npm test`.

E2E (Python Playwright, `pip install playwright && playwright install chromium`) — винаги срещу локални
заместители, никога срещу истински Resend/Upstash. Три терминала:

```bash
node tests/e2e/mock-resend.mjs                      # Resend на :8790
node tests/e2e/mock-upstash.mjs                     # Upstash на :8791
RESEND_BASE_URL=http://127.0.0.1:8790 UPSTASH_REDIS_REST_URL=http://127.0.0.1:8791   UPSTASH_REDIS_REST_TOKEN=test RATE_LIMIT_SALT=test npm run dev
```

После (`.env` трябва да е с тестовите ключове на Turnstile):

```bash
python tests/e2e/test_form.py      # формата, грешките, API проверките, лимитите
python tests/e2e/test_legal.py     # правните страници, футъра, контактите
node tests/e2e/rate-limit.mjs      # 10 заявки подред → 6-тата трябва да е 429
```

SEO (статични проверки на build-а — title, H1, canonical, JSON-LD, sitemap, robots):

```bash
npm run build && python tests/e2e/test_seo.py
```

CSP (production build с production headers):

```bash
npm run build && node tests/e2e/serve-output.mjs    # :4500
python tests/e2e/test_csp.py
```

## Структура

```
src/
  components/   Header, Hero, ApplyForm, UseCases, Why, Steps, Contact, Footer, LegalPage
  data/company.ts данни за фирмата — единственият източник за правните страници, футъра, контактите и имейлите
  config/site.ts  съкратен изглед на company.ts за header-а и имейлите + менюто
  lib/
    application.ts  общата схема (zod) за браузъра и сървъра, стъпки, опции
    cities.ts       257-те града в България
    emails.ts       шаблони на имейлите (HTML + текст)
    rate-limit.ts   лимити през Upstash Redis (хеширани ключове)
    security.ts     проверки на заявката: метод, Origin, размер; хеширане
    turnstile.ts    проверка на Turnstile (hostname + action)
  pages/
    index.astro
    about.astro, privacy.astro, terms.astro, disputes.astro   правни страници (чернова)
    faq.astro, location.astro   въпроси и офис в Младост
    404.astro, maintenance.astro
    api/apply.ts    приема заявката и праща имейлите
    api/health.ts   GET → 200 ok (за мониторинг)
assets/           логото (източник) и снимката за hero
public/           logo.svg, logo-mark.svg, favicons, og.png
scripts/vercel-output.mjs   след build: headers и регион от vercel.json → .vercel/output
tests/unit/       vitest
tests/e2e/        Playwright тестове, заместители на Resend и Upstash, скрипт за лимита
.github/          CI (audit, check, test, build) и Dependabot
```

## Отворени въпроси (от клиента)

- Правните страници са чернова за юрист; липсващите данни и въпросите са в [LEGAL_TODO.md](LEGAL_TODO.md)
  (рег. № в БНБ, адрес за кореспонденция, правно основание за адреса по лична карта, ЕГН, DPA с Resend и др.)
- Потвърждение на диапазона 500–5 000 €
- `TODO-CLAIM`: „Дискретност“, „Поверителност на личните данни“, „Индивидуален подход“
- Текстове, които вече не отговарят на дългата форма: „Кандидатстваш онлайн за минута“, „Онлайн, с няколко полета“, „Избери сума и срок и остави данни за контакт“
- Целият сайт на „Вие“ ли да мине (формата вече е на „Вие“)
- Източник и лиценз на снимката в hero (на колата се вижда логото на Mercedes)
