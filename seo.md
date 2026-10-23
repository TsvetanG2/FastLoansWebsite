# SEO — Royal Finance website

Instructions for Claude Code: implement the technical and on-page SEO below.
Sections marked **MANUAL** are done by a human outside the codebase — list them in `SEO_TODO.md` as checkboxes, do not attempt them.
All copy rules from CLAUDE.md and legal-pages.md still apply (agent model, no cost figures, only approved claims). SEO never overrides them.

## Goal and target keywords

Primary target: **local** — Младост and Sofia. A new domain will not outrank the big national lenders for the head term „бързи кредити“ quickly; local and long-tail queries are where this site can win.

| Group | Keywords | Where |
|---|---|---|
| Local — main target | бързи кредити Младост, кредит Младост, кредитен офис Младост, бързи кредити Младост 1 | Home page title/H1/intro, `/location` |
| Local — Sofia | бързи кредити София, бърз кредит София, кредит в брой София, кредитен офис София | Home page, `/location` (mention nearby areas) |
| Head terms (long-term) | бързи кредити, бърз кредит, бърз кредит онлайн, кредит онлайн, заем | Home page naturally, FAQ |
| Intent | кредит до заплата, пари до заплата, бърз кредит до заплата | `/faq` and home copy — **only if the client/lender actually offers short-term loans; ask first** |

**Vocabulary mix:** „кредит“ / „бързи кредити“ stay the primary terms in titles, H1 and the first paragraph — that is what people search. Use „заем“, „бързо финансиране“, „пари в брой“ and „финансиране“ as natural synonyms in body copy, FAQ answers and image alt text (aim roughly 1 synonym per 2–3 uses of „кредит“). Never repeat keywords unnaturally.

**Never target or use:** „без проверка в ЦКР“, „с лошо ЦКР“, „гарантирано одобрение“, „без доходи“, „100% одобрение“. Creditworthiness assessment is mandatory, so these promises are misleading and may break consumer-credit advertising rules.

## Site structure

Keep the landing page, add:
- `/faq` — FAQ (8–12 real questions: how to apply, what documents, how fast is the answer, who is the lender, where is the office, working hours). Answers short, factual, no cost figures.
- `/location` — „Офис в Младост“: address, map embed (static image + link to Google Maps, not an iframe, to keep CSP and performance), how to get there (metro stations and bus lines nearby — TODO verify with client), working hours, phone, CTA to the form. 300–500 words of genuinely useful local content, no keyword stuffing.
- Legal pages from legal-pages.md.

Navigation and footer link to all of them.

## On-page

Home page:
- `<title>`: `Бързи кредити в Младост, София | Royal Finance` (≤ 60 chars)
- meta description (≤ 155 chars): office in Младост, answer within 10 minutes, apply online — approved claims only.
- One `<h1>` containing „бързи кредити“ and „Младост“/„София“ naturally, e.g. „Бързи кредити в Младост, София“. The emotional headline from the design can stay as a visual line above/below it.
- H2s per section; the office address and hours appear as visible text on the home page (not only in the footer).

Every page: unique title + description, canonical URL (`https://royalfinance.bg/...`, no `www`, trailing-slash policy consistent), Open Graph + Twitter tags, `lang="bg"`.

Redirect `www.royalfinance.bg` → `royalfinance.bg` (301) and http → https.

## Structured data (JSON-LD)

On every page (from `src/data/company.ts`, never hardcoded):

- `FinancialService` (subtype of `LocalBusiness`):
  - `name`: Royal Finance; `legalName`: „Глобъл Профинанс“ ЕООД; `url`; `logo`; `image` (office photo — TODO)
  - `telephone`: `+359888807152`
  - `address`: `PostalAddress` — streetAddress „ж.к. Младост 1, бл. 79, вх. 2, ет. 1“, addressLocality „София“, postalCode „1784“ — TODO verify postal code with client (1000 is the generic Sofia code from the registry), addressCountry „BG“
  - `geo`: latitude/longitude — TODO from the Google Business Profile pin
  - `openingHoursSpecification`: Mo–Fr 10:00–19:00, Sa 10:00–16:00
  - `areaServed`: Младост, София
  - `sameAs`: Google Business Profile URL, Facebook, etc. — TODO
  - Do NOT add `aggregateRating` or reviews markup.
- `FAQPage` on `/faq`.
- `BreadcrumbList` on subpages.

Validate with Google's Rich Results Test.

## Technical

- `@astrojs/sitemap` → `sitemap-index.xml`; `robots.txt` allowing everything except `/api/`, linking the sitemap.
- Performance budget: LCP < 2.0 s on mobile 4G, CLS < 0.05. Hero image ≤ 150 KB AVIF/WebP with `fetchpriority="high"`; fonts preloaded and subset to Latin + Cyrillic.
- Descriptive `alt` text in Bulgarian on all images.
- Custom 404 page in Bulgarian.
- No client-side-only rendering of content; all text present in the HTML.

## NAP consistency

Name, address, phone must be **identical** everywhere (site, Google Business Profile, Bing, Apple, directories):
`Royal Finance · ж.к. Младост 1, бл. 79, вх. 2, ет. 1, София · +359 888 807 152`

## MANUAL — local SEO (copy to `SEO_TODO.md`)

- [x] Office at Младост 1, бл. 79 is a real customer-facing office (confirmed by client) → show the address in Google Business Profile. Make sure there is visible signage at the entrance; Google may ask for it during video verification.
- [ ] **Google Business Profile:** name exactly „Royal Finance“ (no keywords in the name — Google suspends profiles for that); primary category „Кредитна агенция“ (Loan agency), secondary as appropriate; hours incl. Saturday and holiday hours; phone; website; description mentioning Младост, Sofia, quick loans and that loans are granted by „Тием Финанси“ ООД; real photos of the office front, sign, interior; verify (video/postcard).
- [ ] **Reviews:** ask real customers after their visit (QR code at the desk / link in an SMS). Answer every review. Never buy, write or incentivise reviews.
- [ ] **Bing Places**, **Apple Business Connect**, **Waze** — same NAP.
- [ ] 2–4 relevant Bulgarian directories (e.g. goldenpages.bg) — same NAP. Quality over quantity.
- [ ] **Google Search Console** + **Bing Webmaster Tools**: verify domain via DNS, submit sitemap.
- [ ] Facebook page with the same NAP, linked from the site (`sameAs`).
- [ ] Monthly: check Search Console queries, update FAQ with real customer questions, add photos and posts to the Business Profile.
- [ ] Get real keyword volumes from **Google Keyword Planner** (free with a Google Ads account, location: Sofia / Bulgaria) and adjust the keyword table above.
