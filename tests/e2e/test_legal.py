import sys
from playwright.sync_api import sync_playwright
import os
BASE = 'http://localhost:4321'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'test-results'
os.makedirs(OUT, exist_ok=True)
PAGES = {
    '/privacy': 'Политика за поверителност',
    '/about': 'Информация за кредитора',
    '/disputes': 'Решаване на спорове',
    '/terms': 'Общи условия за ползване на сайта',
}
results = []
def ok(name, cond, detail=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    for label, (w, h) in {'375': (375, 812), '1440': (1440, 900)}.items():
        ctx = b.new_context(viewport={'width': w, 'height': h})
        pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        for path, title in PAGES.items():
            r = pg.goto(BASE + path); pg.wait_for_load_state('networkidle')
            pg.evaluate("document.querySelector('astro-dev-toolbar')?.remove()")
            ok(f'[{label}] {path} 200', r.status == 200, str(r.status))
            ok(f'[{label}] {path} h1', pg.text_content('h1').strip() == title, pg.text_content('h1'))
            body = pg.text_content('main')
            ok(f'[{label}] {path} no {{{{ placeholders', '{{' not in pg.content())
            ok(f'[{label}] {path} effective date', 'В сила от: 23.10.2026 г.' in body)
            hrefs = pg.eval_on_selector_all('.toc a', 'as => as.map(a => a.getAttribute("href"))')
            ok(f'[{label}] {path} TOC targets exist', hrefs and all(pg.locator(hh).count() == 1 for hh in hrefs), str(hrefs))
            ok(f'[{label}] {path} no horizontal scroll', pg.evaluate('document.documentElement.scrollWidth') <= w)
            ok(f'[{label}] {path} no ODR link', 'ec.europa.eu/odr' not in pg.content())
            ok(f'[{label}] {path} no visible TODO', 'TODO' not in body)
            ok(f'[{label}] {path} no old address (бл. 79)', 'бл. 79' not in body)
            ok(f'[{label}] {path} formal Вие', ' ти ' not in body and ' твоя' not in body)
            width = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.prose p')).fontSize)")
            mw = pg.evaluate("document.querySelector('.prose').getBoundingClientRect().width")
            ok(f'[{label}] {path} measure ~72ch', mw <= 72 * width * 0.62 + 2 * 32 + 40 or w < 700, f'{mw}px')
            low = pg.text_content('body').lower()
            ok(f'[{label}] {path} no lender-style wording', not any(x in low for x in ['отпускаме', 'нашите кредити', 'ние одобряваме', 'рег. № в бнб [todo']))
            pg.screenshot(path=f'{OUT}/legal{path.replace("/", "-")}-{label}.png', full_page=True)
        # company data + specific content
        pg.goto(BASE + '/about')
        t = pg.text_content('main')
        ok(f'[{label}] about agent data', all(x in t for x in ['„Глобъл Профинанс“ ЕООД', '208274496', 'бул. „Андрей Сахаров“ № 11', '+359 888 807 152', 'royalfinance@abv.bg', 'не отпуска кредити от свое име']))
        ok(f'[{label}] about lender data', all(x in t for x in ['„Тием Финанси“ ООД', '202786529', 'гр. Перник 2300, ул. „Кракра“, бл. 39', 'BGR00464', 'БНБ-119213/10.11.2022', '10.11.2022', 'финансов лизинг', 'чл. 3а от Закона за кредитните институции']))
        ok(f'[{label}] about: no TODO rows for missing lender contacts', 'null' not in t and pg.locator('#kreditor ~ dl dt', has_text='Телефон').count() == 0)
        ok(f'[{label}] about: agent before lender', t.index('1. Royal Finance') < t.index('2. Кредитор'))
        ok(f'[{label}] about: no visible TODO', '[TODO' not in t)
        ok(f'[{label}] about: questions go only to Royal Finance', 'се обръщайте към Royal Finance' in t and 'писмено до „Тием Финанси“' not in t)
        ok(f'[{label}] about BNB register link', pg.locator('a[href*="bnb.bg/RegistersAndServices"]').count() == 1)
        pg.goto(BASE + '/privacy'); t = pg.text_content('main')
        ok(f'[{label}] privacy lists all form fields', all(x in t for x in ['причина за финансиране', 'адрес по лична карта', 'настоящ адрес', 'собствено жилище', 'какво работите', 'желана сума']))
        ok(f'[{label}] privacy: lender is a recipient', '„Тием Финанси“ ООД, ЕИК 202786529, на когото заявката се предава' in t)
        ok(f'[{label}] privacy KZLD + processors', all(x in t for x in ['бул. „Проф. Цветан Лазаров“ № 2', 'Resend', 'Vercel', 'Cloudflare', '1 месец']))
        ok(f'[{label}] privacy table', pg.locator('table tbody tr').count() == 3)
        pg.goto(BASE + '/disputes'); t = pg.text_content('main')
        ok(f'[{label}] disputes: complaints only to Royal Finance', 'се подават до Royal Finance' in t and 'Тием' not in t and 'Перник' not in t)
        ok(f'[{label}] disputes KZP + 30 days', 'ул. „Врабча“ № 1' in t and '30 дни' in t and 'Общата помирителна комисия' in t)
        pg.goto(BASE + '/terms'); t = pg.text_content('main')
        ok(f'[{label}] terms: agent of lender', 'действа като агент на „Тием Финанси“ ООД' in t)
        ok(f'[{label}] terms: not a contract, чл. 16 ЗПК', 'не гарантира одобрение' in t and 'чл. 16 от Закона за потребителския кредит' in t)
        # footer on home
        pg.goto(BASE + '/'); pg.wait_for_load_state('networkidle')
        links = pg.eval_on_selector_all('footer nav[aria-labelledby="f-legal"] a', 'as => as.map(a => [a.textContent.trim(), a.getAttribute("href")])')
        ok(f'[{label}] footer legal links', links == [['Политика за поверителност', '/privacy'], ['Общи условия', '/terms'], ['Решаване на спорове', '/disputes'], ['Информация за кредитора', '/about']], str(links))
        ft = pg.text_content('footer')
        ok(f'[{label}] footer agent statement', 'Royal Finance е търговска марка на „Глобъл Профинанс“ ЕООД, която действа като агент на „Тием Финанси“ ООД, ЕИК 202786529, вписано в регистъра на финансовите институции към БНБ под № BGR00464.' in ft, ft)
        for _, href in links:
            pg.goto(BASE + '/'); pg.click(f'footer nav[aria-labelledby="f-legal"] a[href="{href}"]'); pg.wait_for_load_state('networkidle')
            ok(f'[{label}] footer click {href}', pg.url.endswith(href) or pg.url.endswith(href + '/'), pg.url)
        ct = pg.goto(BASE + '/') and pg.text_content('#contact')
        low = pg.text_content('body').lower()
        ok(f'[{label}] home: no lender-style wording', not any(x in low for x in ['отпускаме', 'нашите кредити', 'ние одобряваме']))
        ok(f'[{label}] home: agent statement under form', 'Royal Finance е търговска марка на „Глобъл Профинанс“ ЕООД, която действа като агент на „Тием Финанси“ ООД, ЕИК 202786529, вписано в регистъра на финансовите институции към БНБ под № BGR00464.' in pg.text_content('#apply-form'))
        ok(f'[{label}] contact block real data', '+359 888 807 152' in ct and 'royalfinance@abv.bg' in ct and 'Понеделник – петък' in ct)
        ok(f'[{label}] contact office address', 'бул. „Андрей Сахаров“ № 11' in ct and '1784 София' in ct and 'бл. 79' not in ct and 'Отвори в карти' in ct)
        ok(f'[{label}] maps links (contact + footer)', pg.locator('a[data-maps-query]').count() == 2 and all('google.com/maps' in h for h in pg.eval_on_selector_all('a[data-maps-query]', 'as => as.map(a => a.href)')))
        ok(f'[{label}] header has phone but no working hours', '+359 888 807 152' in pg.text_content('header') and '10:00' not in pg.text_content('header'))
        pg.goto(BASE + '/'); pg.wait_for_load_state('networkidle')
        menu = pg.eval_on_selector_all('header .nav-list > li:not(.nav-phone-mobile) > a', 'as => as.map(a => a.textContent.trim())')
        ok(f'[{label}] header menu: Начало, Защо ние, Контакти', menu == ['Начало', 'Защо ние', 'Контакти'], str(menu))
        fnav = pg.eval_on_selector_all('footer nav[aria-labelledby="f-nav"] a', 'as => as.map(a => [a.textContent.trim(), a.getAttribute("href")])')
        ok(f'[{label}] footer nav has Локация and Въпроси after Контакти', fnav[-2:] == [['Локация', '/location'], ['Въпроси', '/faq']] and fnav[2][0] == 'Контакти', str(fnav))
        pg.goto(BASE + '/location'); pg.wait_for_load_state('networkidle')
        pg.locator('.office-map').scroll_into_view_if_needed()
        pg.wait_for_selector('.office-map canvas.maplibregl-canvas', timeout=30000); pg.wait_for_timeout(3000)
        res = pg.evaluate("performance.getEntriesByType('resource').map(e => e.name)")
        ok(f'[{label}] /location: interactive map (MapLibre + OpenFreeMap)', pg.locator('.office-map canvas.maplibregl-canvas').count() == 1 and any('tiles.openfreemap.org' in r for r in res))
        ok(f'[{label}] /location: gold pin + zoom + fullscreen', pg.locator('.office-map .rf-pin').count() == 1 and pg.locator('.office-map .maplibregl-ctrl-zoom-in').count() == 1 and pg.locator('.office-map .maplibregl-ctrl-fullscreen').count() == 1)
        ok(f'[{label}] /location: OpenStreetMap credit', 'OpenStreetMap' in (pg.text_content('.office-map .maplibregl-ctrl-attrib') or ''))
        ok(f'[{label}] /location: no Google, no cookie banner', not [r for r in res if 'google.' in r] and pg.locator('#cookie-banner').count() == 0)
        pg.click('.office-map .maplibregl-ctrl-zoom-in'); pg.wait_for_timeout(800)
        ok(f'[{label}] /location: live map shown, placeholder removed', pg.locator('.office-map .live.is-ready').count() == 1 and pg.locator('.office-map .ph').count() == 0)
        # OpenFreeMap down/blocked → the static image with the pin stays, no empty or broken map
        c3 = b.new_context(viewport={'width': w, 'height': h}); p3 = c3.new_page()
        p3.route('**/tiles.openfreemap.org/**', lambda route: route.abort())
        p3.goto(BASE + '/location'); p3.wait_for_load_state('networkidle')
        p3.mouse.wheel(0, 400); p3.wait_for_timeout(12000)
        ok(f'[{label}] /location: map provider down → static map stays', p3.locator('.office-map .ph').count() == 1 and p3.locator('.office-map .live').count() == 0 and p3.evaluate("document.querySelector('.office-map .ph').naturalWidth") == 1200)
        c3.close()
        ok(f'[{label}] /location: map has no console errors', not [e for e in errs if 'maplibre' in e.lower() or 'worker' in e.lower()], str(errs[:2]))
        ok(f'[{label}] /location: new address, not the seat', 'бул. „Андрей Сахаров“ № 11' in pg.text_content('main') and 'бл. 79' not in pg.text_content('main'))
        # Scroll-spy: the menu marks the section in view
        pg.goto(BASE + '/'); pg.wait_for_load_state('networkidle')
        spy = lambda: pg.evaluate("[...document.querySelectorAll('.nav-list a[aria-current]')].map(a => a.textContent).join(',')")
        seen = []
        for js in ['0', "document.getElementById('about').offsetTop", 'document.body.scrollHeight']:
            pg.evaluate(f"scrollTo({{top: {js}, behavior: 'instant'}})"); pg.wait_for_timeout(200); seen.append(spy())
        ok(f'[{label}] menu marks Начало → Защо ние → Контакти while scrolling', seen == ['Начало', 'Защо ние', 'Контакти'], str(seen))
        pg.goto(BASE + '/privacy'); pg.wait_for_load_state('networkidle')
        ok(f'[{label}] no menu item marked on other pages', spy() == '')
        # Menu: smooth scroll to the section, address bar stays clean (no "#")
        def open_menu():
            if pg.locator('.nav-toggle').is_visible(): pg.click('.nav-toggle')
        pg.goto(BASE + '/'); pg.wait_for_load_state('networkidle')
        open_menu(); pg.click('header .nav-list a[href="/#contact"]'); pg.wait_for_timeout(1200)
        top = pg.evaluate("document.getElementById('contact').getBoundingClientRect().top")
        ok(f'[{label}] menu → Контакти scrolls there, URL without #', pg.url.rstrip('/') == BASE and 0 <= top < 200, f'{pg.url} top={top}')
        open_menu(); pg.click('header .nav-list a[href="/"]'); pg.wait_for_timeout(1200)
        ok(f'[{label}] menu → Начало goes to top', pg.evaluate('scrollY') < 5 and '#' not in pg.url, f"{pg.url} {pg.evaluate('scrollY')}")
        pg.goto(BASE + '/privacy'); pg.wait_for_load_state('networkidle')
        open_menu(); pg.click('header .nav-list a[href="/#about"]'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(800)
        top = pg.evaluate("document.getElementById('about').getBoundingClientRect().top")
        ok(f'[{label}] from another page → За нас lands on the section, URL cleaned', '#' not in pg.url and 0 <= top < 200, f'{pg.url} top={top}')
        for old, new in [('/za-nas', '/about'), ('/poveritelnost', '/privacy'), ('/obshti-usloviya', '/terms'), ('/sporove', '/disputes')]:
            pg.goto(BASE + old); pg.wait_for_load_state('networkidle')
            ok(f'[{label}] {old} redirects to {new}', new in pg.url, pg.url)
        ok(f'[{label}] no console errors', not errs, '; '.join(errs))
        ctx.close()
    b.close()
print(f'\n{sum(results)}/{len(results)} passed')
