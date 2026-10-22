# Royal Finance — сайт за бързи кредити

Едностраничен сайт (Astro, статичен) с форма за кандидатстване в 3 стъпки.
Заявките се изпращат по имейл през Resend от една serverless функция (`/api/apply`) във Vercel.

Пълните правила за проекта (обхват, дизайн, compliance) са в [CLAUDE.md](CLAUDE.md).

## Локално

Нужен е **Node 24** (Astro 7 изисква поне 22.23.4).

```bash
npm install
cp .env.example .env   # попълни стойностите
npm run dev            # http://localhost:4321
npm run check          # проверка на типовете
npm run build          # production build → .vercel/output
```

Ако системният Node е по-стар, може временно:
`npx -y -p node@24 -- node ./node_modules/astro/bin/astro.mjs dev`

## Env променливи

| Име | За какво |
|---|---|
| `RESEND_API_KEY` | ключ за Resend (само на сървъра) |
| `EMAIL_FROM` | подател от потвърден в Resend домейн, напр. `Royal Finance <noreply@domain.bg>` |
| `LEADS_EMAIL_TO` | къде отиват заявките |
| `TURNSTILE_SITE_KEY` | публичен ключ, вгражда се **при build** |
| `TURNSTILE_SECRET_KEY` | таен ключ за Turnstile |

Локално: `.env` (не се commit-ва). Продукция: Vercel → Settings → Environment Variables.

## Deploy във Vercel — чеклист

1. Env променливите по-горе (`TURNSTILE_SITE_KEY` преди първия build).
2. Истински Turnstile ключове от Cloudflare, с домейна на сайта в списъка с hostnames.
3. Vercel → Firewall → Rules: правило с условие „@vercel/firewall“, ID `apply`, rate limit (напр. 5 заявки/мин).
   Докато го няма, работи резервен лимит в паметта (по-слаб).
4. Регион: `vercel.json` задава `fra1`. След deploy провери, че header-ът `x-vercel-id` от `/api/apply` съдържа `fra1`.
5. Resend: потвърди домейна на `EMAIL_FROM`. Първо тествай с `LEADS_EMAIL_TO=delivered@resend.dev`,
   после смени с истинския адрес.

## Структура

```
src/
  components/   Header, Hero, ApplyForm, Benefits, Why, Steps, Contact, Footer, LegalPage
  config/site.ts  телефон, имейл, работно време, фирма, ЕИК, БНБ № (TODO от клиента)
  lib/
    application.ts  общата схема (zod) за браузъра и сървъра, стъпки, опции
    cities.ts       257-те града в България
    emails.ts       шаблони на имейлите (HTML + текст)
    rate-limit.ts   Vercel Firewall + резервен лимит
    turnstile.ts    проверка на Turnstile
  pages/
    index.astro, privacy.astro, terms.astro
    api/apply.ts    приема заявката и праща имейлите
assets/           логото (източник) и снимката за hero
public/           logo.svg, logo-mark.svg, favicons, og.png
```

## Отворени въпроси (от клиента)

- Телефон, имейл, работно време, фирма, ЕИК, рег. № в БНБ → `src/config/site.ts`
- Домейн → `site` в `astro.config.mjs`
- Окончателни текстове на Политиката за поверителност и Общите условия
- Правно основание за адреса по лична карта; решение за ЕГН (засега не се събира)
- DPA с Resend (обработващ данни в САЩ)
- Потвърждение на диапазона 500–5 000 €
- `TODO-CLAIM`: „Дискретност“, „Поверителност на личните данни“, „Индивидуален подход“
- Текстове, които вече не отговарят на дългата форма: „Кандидатстваш онлайн за минута“, „Онлайн, с няколко полета“, „Избери сума и срок и остави данни за контакт“
- Целият сайт на „Вие“ ли да мине (формата вече е на „Вие“)
- Източник и лиценз на снимката в hero (на колата се вижда логото на Mercedes)
