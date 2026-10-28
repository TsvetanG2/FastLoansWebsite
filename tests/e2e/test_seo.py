# Static SEO checks on the production build (.vercel/output). Run after `npm run build`.
import json, re, sys, pathlib

OUT = pathlib.Path('.vercel/output')
STATIC = OUT / 'static'
SITE = 'https://www.royalfinance.bg'
results = []


def ok(name, cond, detail=''):
    results.append(bool(cond))
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))


pages = {('/' + str(p.relative_to(STATIC)).replace('\\', '/')).replace('/index.html', '').replace('.html', '') or '/': p
         for p in STATIC.rglob('*.html')}
indexable = {u: p for u, p in pages.items() if u not in ('/404', '/maintenance')}
titles = {}

for url, path in sorted(pages.items()):
    html = path.read_text(encoding='utf-8')
    title = re.search(r'<title>([^<]*)</title>', html).group(1)
    desc = re.search(r'<meta name="description" content="([^"]*)"', html)
    if url in indexable:
        titles[title] = url
        ok(f'{url}: title ≤ 60 chars', len(title) <= 60, f'{len(title)} {title}')
        ok(f'{url}: description 50–160 chars', desc and 50 <= len(desc.group(1)) <= 160, desc and str(len(desc.group(1))))
        canon = re.search(r'<link rel="canonical" href="([^"]*)"', html)
        expect = SITE + ('/' if url == '/' else url)
        ok(f'{url}: canonical {expect}', canon and canon.group(1) == expect, canon and canon.group(1))
        ok(f'{url}: exactly one <h1>', len(re.findall(r'<h1[\s>]', html)) == 1)
        ok(f'{url}: lang="bg"', '<html lang="bg"' in html)
        ok(f'{url}: Open Graph + Twitter', 'property="og:title"' in html and 'property="og:image"' in html and 'name="twitter:card"' in html)
        blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        try:
            data = [json.loads(b) for b in blocks]
            types = [d['@type'] for d in data]
        except Exception as e:
            data, types = [], [f'invalid JSON-LD: {e}']
        ok(f'{url}: FinancialService JSON-LD', 'FinancialService' in types, str(types))
        if url != '/':
            ok(f'{url}: BreadcrumbList JSON-LD', 'BreadcrumbList' in types, str(types))
            # Visible breadcrumbs show the same trail as the JSON-LD (names and links)
            bl = next((d for d in data if d.get('@type') == 'BreadcrumbList'), {})
            ld_names = [i['name'] for i in bl.get('itemListElement', [])]
            nav = re.search(r'<nav class="crumbs"[^>]*>(.*?)</nav>', html, re.S)
            shown = [re.sub(r'<[^>]+>', '', li).strip() for li in re.findall(r'<li[^>]*>(.*?)</li>', nav.group(1), re.S)] if nav else []
            ok(f'{url}: visible breadcrumbs match JSON-LD', shown == ld_names and len(shown) >= 2, f'{shown} vs {ld_names}')
            ok(f'{url}: breadcrumb "Начало" links home, current page not a link', bool(nav) and 'href="/"' in nav.group(1) and 'aria-current="page"' in nav.group(1) and nav.group(1).count('<a ') == len(shown) - 1)
        fs = next((d for d in data if d.get('@type') == 'FinancialService'), {})
        ok(f'{url}: NAP in JSON-LD', fs.get('name') == 'Royal Finance' and fs.get('telephone') == '+359888807152'
           and fs.get('address', {}).get('streetAddress') == 'бул. „Андрей Сахаров“ № 11'
           and fs.get('address', {}).get('postalCode') == '1784' and fs.get('geo', {}).get('latitude') == 42.6525113 and fs.get('sameAs') == [fs.get('hasMap')] and fs['hasMap'].startswith('https://maps.google.com/?cid=') and fs.get('priceRange') == '500 € – 5 000 €', json.dumps(fs.get('address'), ensure_ascii=False))
        ok(f'{url}: no rating/review markup', 'aggregateRating' not in html and '"Review"' not in html)
        imgs = re.findall(r'<img\b[^>]*>', html)
        has_alt = lambda i: re.search(r'\salt(=|\s|>)', i)  # bare `alt` == alt="" (decorative)
        ok(f'{url}: every <img> has alt', all(has_alt(i) for i in imgs), str([i[:80] for i in imgs if not has_alt(i)]))
    else:
        ok(f'{url}: noindex', '<meta name="robots" content="noindex"' in html)
        ok(f'{url}: no JSON-LD', 'application/ld+json' not in html)
    low = html.lower()
    ok(f'{url}: no forbidden promises', not any(x in low for x in ['без проверка в цкр', 'с лошо цкр', 'гарантирано одобрение', 'без доходи', '100% одобрение', 'кредит в брой', 'до заплата']))
    ok(f'{url}: no old address (бл. 79)', 'бл. 79' not in html)
    ok(f'{url}: no visible TODO', 'TODO' not in re.sub(r'<script.*?</script>|<!--.*?-->', '', html, flags=re.S))

ok('titles are unique', len(titles) == len(indexable), str(titles))
faq = (STATIC / 'faq' / 'index.html').read_text(encoding='utf-8')
faq_ld = [json.loads(b) for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', faq, re.S)]
fp = next((d for d in faq_ld if d['@type'] == 'FAQPage'), None)
ok('/faq: FAQPage with 8–12 questions', fp and 8 <= len(fp['mainEntity']) <= 12, fp and str(len(fp['mainEntity'])))
home = (STATIC / 'index.html').read_text(encoding='utf-8')
ok('home: title and H1 (client decision 2026-10-28)', re.search(r'<h1[^>]*>Бързи кредити и бързо финансиране в София</h1>', home) and re.search(r'<title>([^<]*)', home).group(1) == 'Бързи кредити в София, Младост | Royal Finance')
ok('home: intro text (client copy)', re.search(r'class="lead"[^>]*>\s*Бърз кредит, кандидатствайте онлайн', home))
ok('home: office address + hours visible', 'бул. „Андрей Сахаров“ № 11' in home and '10:00' in home)

robots = (STATIC / 'robots.txt').read_text()
ok('robots.txt disallows /api/ and links the sitemap', 'Disallow: /api/' in robots and f'Sitemap: {SITE}/sitemap-index.xml' in robots)
sitemap = (STATIC / 'sitemap-0.xml').read_text()
locs = set(re.findall(r'<loc>([^<]*)</loc>', sitemap))
want = {SITE + ('/' if u == '/' else u) for u in indexable}
ok('sitemap lists exactly the indexable pages', locs == want, f'extra {locs - want}, missing {want - locs}')
config = json.loads((OUT / 'config.json').read_text())
ok('trailing slash redirects to no slash (308)', any(r.get('src') == '^/(.*)/$' and r.get('status') == 308 for r in config['routes']))
ok('maintenance route is off in a normal build', not any(r.get('status') == 503 for r in config['routes']))

print(f'\n{sum(results)}/{len(results)} passed')
sys.exit(0 if all(results) else 1)
