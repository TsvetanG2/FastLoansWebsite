# Security — ръчни стъпки (в таблата за управление)

Код не може да ги направи. Отбелязвай с `[x]`, когато са готови. Пълните правила са в [security.md](security.md).

## От security.md

- [x] ~~Vercel Pro + Spend Management~~ — решено: **Hobby** (безплатен). Няма сметка за надвишаване; при изчерпване на
      лимитите Vercel спира функциите до края на месеца (формата не работи, но разход няма).
- [ ] **Vercel Hobby е само за некомерсиална употреба** (условия на Vercel) — да се реши дали сайтът на фирмата остава там
- [ ] **Vercel Firewall** (ако Hobby позволява custom rule): custom rule — `/api/apply`, повече от 10 заявки / минута от един IP → deny. Знай къде е бутонът **Attack Mode** за спешни случаи.
- [ ] **Vercel:** Deployment Protection за preview deployments; 2FA на акаунта
- [ ] **Cloudflare Turnstile:** widget, ограничен до `royalfinance.bg`, `www.royalfinance.bg` (+ отделен widget или тестовите ключове за localhost)
- [ ] **Resend:** 2FA; **sending-only** API ключ, ограничен до домейна `royalfinance.bg`; известия за използване
- [ ] **Upstash:** база в **eu-central-1**; 2FA
- [ ] **SuperHosting:** 2FA, силна уникална парола, registrar/transfer lock на домейна
- [ ] **GitHub:** private repo, 2FA
- [ ] **Uptime monitor** (UptimeRobot или Better Stack, безплатен план) на `/` и `/api/health`, известия по имейл/телефон
- [ ] Пощата, която получава заявките: 2FA (abv.bg или бъдещата поща на домейна)

## Добавени при изпълнението

- [ ] **Vercel → Analytics → Enable** (Web Analytics). Без това `/_vercel/insights/script.js` не съществува и няма статистика.

- [ ] **Vercel → Environment Variables:**
  - преименувай `TURNSTILE_SITE_KEY` → **`PUBLIC_TURNSTILE_SITE_KEY`** (иначе build-ът спира)
  - Upstash от Vercel Marketplace: `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN`
    (ако интеграцията ги създаде като `KV_REST_API_URL` / `KV_REST_API_TOKEN` — и те работят)
  - **`RATE_LIMIT_SALT`** — случаен низ, напр. `openssl rand -hex 32`. Не го сменяй след старта (лимитите се нулират).
  - докато домейнът не е свързан: **`ALLOWED_ORIGINS`** = адресът на `*.vercel.app` (иначе формата връща 403).
    Махни го, когато `royalfinance.bg` заработи.
- [ ] **Resend:** потвърди домейна `royalfinance.bg` и смени `EMAIL_FROM` на адрес от него
- [ ] **След deploy:**
  - провери headers на [securityheaders.com](https://securityheaders.com)
  - отвори сайта, стигни до стъпка 2 на формата и провери в конзолата на браузъра, че няма CSP грешки и Turnstile се зарежда
  - провери, че `x-vercel-id` на `/api/apply` съдържа `fra1`
  - `GET /api/health` → `200 ok`
- [ ] **GitHub:** включи Dependabot alerts/security updates (Settings → Code security); CI вече пуска `npm audit`
- [ ] **HSTS preload** — НЕ още (по security.md)
