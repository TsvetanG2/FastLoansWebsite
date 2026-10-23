import json, sys, urllib.request
from playwright.sync_api import sync_playwright, expect

# Run against `astro dev` started with RESEND_BASE_URL=http://127.0.0.1:8790 and
# UPSTASH_REDIS_REST_URL=http://127.0.0.1:8791 UPSTASH_REDIS_REST_TOKEN=test (see README).
import os
BASE = 'http://localhost:4321'
MOCK = 'http://127.0.0.1:8790'
UPSTASH = 'http://127.0.0.1:8791'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'test-results'
os.makedirs(OUT, exist_ok=True)
API_HEADERS = {'origin': BASE}
results = []
ip_counter = [0]

STEP_FIELDS = [
    ['amount', 'term'],
    ['firstName', 'lastName', 'phone', 'email'],
    ['purpose', 'currentAddress', 'idAddress', 'city', 'housing', 'occupation'],
    ['consent'],
]
VALID_API = {
    'firstName': 'Иван', 'lastName': 'Петров', 'phone': '0888123456', 'email': 'a@b.bg',
    'purpose': 'bills', 'currentAddress': 'ул. Шипка 10', 'idAddress': 'ул. Витоша 5',
    'housing': 'rent', 'occupation': 'Счетоводител', 'amount': 1000, 'term': 12, 'city': 'София', 'consent': True,
}


def ok(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))


def mock(path, data=None):
    req = urllib.request.Request(MOCK + path, data=json.dumps(data).encode() if data is not None else None, method='POST' if data is not None else 'GET')
    return urllib.request.urlopen(req).read().decode()


def sent():
    return json.loads(mock('/__sent'))


def reset_limits():
    urllib.request.urlopen(urllib.request.Request(UPSTASH + '/__reset', data=b'{}', method='POST')).read()


def upstash_keys():
    return json.loads(urllib.request.urlopen(UPSTASH + '/__keys').read())


def new_page(browser, width, height):
    reset_limits()
    ip_counter[0] += 1
    ctx = browser.new_context(viewport={'width': width, 'height': height}, locale='bg-BG')
    ctx.set_extra_http_headers({'x-real-ip': f'10.0.0.{ip_counter[0]}'})
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_load_state('networkidle')
    return ctx, page, errors


def step(page):
    return page.get_attribute('#apply-form', 'data-step')


def settle(page):
    page.wait_for_function("document.getAnimations().filter(a => a.playState === 'running').length === 0")


def next_btn(page):
    page.locator('fieldset:not([disabled]) [data-action="next"]').click()
    settle(page)


def back_btn(page):
    page.locator('fieldset:not([disabled]) [data-action="back"]').click()
    settle(page)


def bar(page, i):
    return float(page.evaluate(f"getComputedStyle(document.querySelectorAll('.progress-bar li')[{i}]).getPropertyValue('--p') || '0'"))


def fill_personal(page, email='delivered+applicant@resend.dev'):
    page.fill('#firstName', 'Иван')
    page.fill('#lastName', 'Петров')
    page.fill('#phone', '0888 123 456')
    page.fill('#email', email)


def fill_address(page):
    page.select_option('#purpose', 'refinance')
    page.fill('#currentAddress', 'ж.к. Младост 1, бл. 79')  # no "ул." needed
    page.fill('#idAddress', 'ул. Витоша 5')
    page.select_option('#city', 'Бяла (обл. Русе)')
    page.select_option('#housing', 'relatives')
    page.fill('#occupation', 'Шофьор')


def fill_all(page, **kw):
    next_btn(page)  # step 1: amount and term keep their defaults
    fill_personal(page, **kw); next_btn(page)
    fill_address(page); next_btn(page)
    page.check('#consent')


def submit(page):
    # aria-disabled (no consent yet) still lets people click to see what is missing; Playwright treats
    # aria-disabled as not clickable, so force the click in that case
    inactive = page.get_attribute('[data-submit]', 'aria-disabled') == 'true'
    page.locator('[data-submit]').click(force=inactive)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    for label, (w, h) in {'mobile-375': (375, 812), 'desktop-1440': (1440, 900)}.items():
        mock('/__reset', {})
        ctx, page, errors = new_page(browser, w, h)
        page.screenshot(path=f'{OUT}/{label}-full.png', full_page=True)
        sw = page.evaluate('document.documentElement.scrollWidth')
        ok(f'[{label}] no horizontal scroll', sw <= w, f'scrollWidth={sw}')
        ok(f'[{label}] starts on step 1', step(page) == '1')
        ok(f'[{label}] no ЕГН field', page.locator('text=ЕГН').count() == 0)
        ok(f'[{label}] hero has no CTA button', page.locator('.hero-copy a.btn').count() == 0)
        ok(f'[{label}] phone shows +359 prefix', page.text_content('.phone-prefix').strip() == '+359')
        h1 = page.locator('#apply-form').bounding_box()['height']
        hero_h = page.evaluate("document.querySelector('.hero').offsetHeight")
        ok(f'[{label}] city list has 257 towns', page.locator('#city option:not([value=""])').count() == 257)

        # Step 1: amount and term (sliders only)
        ok(f'[{label}] bars start empty', bar(page, 0) == 0 and bar(page, 1) == 0 and bar(page, 2) == 0)
        page.locator('#apply').screenshot(path=f'{OUT}/{label}-step1.png')
        ok(f'[{label}] amount: slider only, no typing', page.get_attribute('#amount', 'type') == 'range' and page.locator('#apply-form input[type=number]').count() == 0 and page.evaluate("document.getElementById('amount-output').tagName") == 'OUTPUT')
        page.locator('#amount').focus(); page.keyboard.press('ArrowRight')
        ok(f'[{label}] amount: arrow key moves by 50 €', page.input_value('#amount') == '1550' and '1 550 €' in page.text_content('#amount-output'), page.text_content('#amount-output'))
        ok(f'[{label}] bar 1 = 1/2 after moving the amount', abs(bar(page, 0) - 0.5) < 0.01, str(bar(page, 0)))
        page.locator('#amount').fill('5000')
        ok(f'[{label}] amount: slider sets the shown value', '5 000 €' in page.text_content('#amount-output') and page.get_attribute('#amount', 'aria-valuetext') == '5 000 €')
        page.locator('#term').fill('24')
        ok(f'[{label}] term output updates', '24 месеца' in page.text_content('#term-output'))
        ok(f'[{label}] bar 1 full after both sliders', abs(bar(page, 0) - 1) < 0.01)
        next_btn(page)
        ok(f'[{label}] step 1 -> step 2', step(page) == '2')
        page.wait_for_timeout(500)
        h2 = page.locator('#apply-form').bounding_box()['height']

        # Step 2: personal details
        ok(f'[{label}] focus on firstName', page.evaluate('document.activeElement.id') == 'firstName')
        page.fill('#firstName', 'Иван'); page.locator('#lastName').click()
        ok(f'[{label}] bar 2 = 1/4 after first name', abs(bar(page, 1) - 0.25) < 0.01, str(bar(page, 1)))
        page.fill('#firstName', '')
        ok(f'[{label}] bar 2 back to 0 when cleared', bar(page, 1) == 0)
        next_btn(page)
        ok(f'[{label}] step 2 blocked when empty', step(page) == '2')
        for f in STEP_FIELDS[1]:
            msg = (page.text_content(f'#{f}-error') or '').strip()
            ok(f'[{label}] empty {f} shows error', msg != '', msg)
            ok(f'[{label}] {f} has aria-invalid', page.get_attribute(f'#{f}', 'aria-invalid') == 'true')
        ok(f'[{label}] focus on first invalid (firstName)', page.evaluate('document.activeElement.id') == 'firstName')
        page.locator('#apply').screenshot(path=f'{OUT}/{label}-step2-errors.png')
        fill_personal(page)
        for f, bad, expected in [('firstName', 'И', 'Въведете името си'), ('phone', '12345', 'Въведете телефон след +359'), ('email', 'ivan@', 'Въведете валиден имейл')]:
            good = page.input_value(f'#{f}')
            page.fill(f'#{f}', bad)
            next_btn(page)
            msg = page.text_content(f'#{f}-error') or ''
            ok(f'[{label}] invalid {f} -> "{expected}"', expected in msg and step(page) == '2', msg)
            page.fill(f'#{f}', good)
            ok(f'[{label}] {f} error clears when fixed', (page.text_content(f'#{f}-error') or '') == '')
        ok(f'[{label}] bar 2 full when step valid', abs(bar(page, 1) - 1) < 0.01)
        back_btn(page)
        ok(f'[{label}] back to step 1 keeps the amount', step(page) == '1' and page.input_value('#amount') == '5000')
        next_btn(page); next_btn(page)
        ok(f'[{label}] step 2 -> step 3', step(page) == '3')
        page.wait_for_timeout(500)
        h3 = page.locator('#apply-form').bounding_box()['height']
        ok(f'[{label}] form height follows the step', h3 > h2 and h3 > h1, f'{h1} {h2} {h3}')
        ok(f'[{label}] inactive steps not rendered', page.evaluate("[...document.querySelectorAll('.step:disabled')].every(s => getComputedStyle(s).display === 'none')"))
        ok(f'[{label}] city is right after idAddress', page.evaluate("document.getElementById('idAddress').closest('.field').nextElementSibling.querySelector('#city') !== null"))

        # Step 3: address and work
        next_btn(page)
        ok(f'[{label}] step 3 blocked when empty', step(page) == '3' and len(sent()) == 0)
        for f in STEP_FIELDS[2]:
            msg = (page.text_content(f'#{f}-error') or '').strip()
            ok(f'[{label}] empty {f} shows error', msg != '', msg)
        ok(f'[{label}] focus on purpose', page.evaluate('document.activeElement.id') == 'purpose')
        opts = page.locator('#purpose option:not([value=""])').all_text_contents()
        ok(f'[{label}] purpose options', opts == ['Покупка на вещи', 'Плащане на сметки', 'Рефинансиране на други задължения', 'Друго'], str(opts))
        opts = page.locator('#housing option:not([value=""])').all_text_contents()
        ok(f'[{label}] housing options', opts == ['Да', 'При роднини', 'Под наем', 'Друго'], str(opts))
        fill_address(page)
        ok(f'[{label}] select error clears on change', (page.text_content('#purpose-error') or '') == '')
        next_btn(page)
        ok(f'[{label}] step 3 -> step 4', step(page) == '4')
        page.wait_for_timeout(500)
        h4 = page.locator('#apply-form').bounding_box()['height']
        ok(f'[{label}] last step is short (no taller than step 3)', h4 < h3, f'{h3} {h4}')
        ok(f'[{label}] hero keeps its height on the last step', page.evaluate("document.querySelector('.hero').offsetHeight") == hero_h or w < 1024)

        # Step 4: consent and submit
        ok(f'[{label}] submit inactive without consent', page.get_attribute('[data-submit]', 'aria-disabled') == 'true' and 'is-inactive' in (page.get_attribute('[data-submit]', 'class') or ''))
        submit(page)
        ok(f'[{label}] consent error', 'Общите условия' in (page.text_content('#consent-error') or ''))
        ok(f'[{label}] focus goes to the consent box', page.evaluate('document.activeElement.id') == 'consent')
        ok(f'[{label}] consent links terms + privacy', page.locator('label[for=consent] a[href="/terms"]').count() == 1 and page.locator('label[for=consent] a[href="/privacy"]').count() == 1)
        ok(f'[{label}] disclaimer under submit', 'не е договор за кредит' in (page.text_content('.disclaimer') or ''))
        ok(f'[{label}] no email on invalid submit', len(sent()) == 0)
        page.check('#consent')
        ok(f'[{label}] submit active after consent', page.get_attribute('[data-submit]', 'aria-disabled') == 'false' and 'is-inactive' not in (page.get_attribute('[data-submit]', 'class') or ''))
        page.locator('#apply').screenshot(path=f'{OUT}/{label}-step3.png')

        submit(page)
        expect(page.locator('#apply-success')).to_be_visible(timeout=20000)
        ok(f'[{label}] success state shown', 'Ще се свържем с Вас' in page.text_content('#apply-success'))
        ok(f'[{label}] success has focus', page.evaluate('document.activeElement.id') == 'apply-success')
        s = sent()
        ok(f'[{label}] two emails sent', len(s) == 2, str(len(s)))
        if len(s) == 2:
            lead = next(e for e in s if e['kind'] == 'lead')
            conf = next(e for e in s if e['kind'] == 'confirm')
            ok(f'[{label}] lead subject', lead['subject'] == 'Нова заявка: 5 000 € / 24 мес. — Иван Петров', lead['subject'])
            ok(f'[{label}] lead reply_to = applicant', lead.get('reply_to') in ('delivered+applicant@resend.dev', ['delivered+applicant@resend.dev']))
            ok(f'[{label}] confirmation reply_to = finance@royalfinance.bg', conf.get('reply_to') in ('finance@royalfinance.bg', ['finance@royalfinance.bg']), str(conf.get('reply_to')))
            ok(f'[{label}] lead has html + text', bool(lead.get('html')) and bool(lead.get('text')))
            want = ['5 000 €', '24 месеца', 'Име: Иван', 'Фамилия: Петров', '+359888123456', 'delivered+applicant@resend.dev',
                    'Рефинансиране на други задължения', 'Град: Бяла (обл. Русе)', 'ж.к. Младост 1, бл. 79', 'ул. Витоша 5',
                    'При роднини', 'Какво работи: Шофьор', 'Съгласие: Да']
            missing = [x for x in want if x not in lead['text']]
            ok(f'[{label}] lead has all fields', not missing, str(missing))
            ok(f'[{label}] lead html has fields', 'Бяла (обл. Русе)' in lead['html'] and 'Шофьор' in lead['html'])
            body = conf['html'] + conf['text'] + conf['subject']
            ok(f'[{label}] confirmation text', 'Получихме кандидатурата Ви. Наш консултант ще се свърже с Вас скоро.' in conf['text'])
            ok(f'[{label}] confirmation has no personal data', not any(x in body for x in ['5 000', '24 мес', 'Иван', 'Петров', '888123456', 'Шипка', 'Витоша', 'Шофьор', 'Бяла']))
            ok(f'[{label}] emails carry agent statement', 'Royal Finance е търговска марка на „Глобъл Профинанс“ ЕООД, която действа като агент на „Тием Финанси“ ООД, ЕИК 202786529, вписано в регистъра на финансовите институции към БНБ под № BGR00464.' in conf['text'] and 'агент на „Тием Финанси“ ООД' in conf['html'])
            ok(f'[{label}] office email has no agent disclosure (internal)', 'агент на' not in lead['html'])
            for e in (lead, conf):
                att = e.get('attachments') or []
                ok(f"[{label}] {e['kind']}: logo embedded (cid), not loaded from a server", 'cid:rf-logo' in e['html'] and any(a.get('content_id') == 'rf-logo' or a.get('contentId') == 'rf-logo' for a in att) and 'src="http' not in e['html'], str([{k: v for k, v in a.items() if k != 'content'} for a in att]))
            ok(f'[{label}] confirmation never says одобрена/приета', not any(x in body.lower() for x in ['одобрен', 'приет']))
        ok(f'[{label}] no console errors', not errors, '; '.join(errors))
        ctx.close()

    # Keyboard only: Enter moves through the steps and submits
    mock('/__reset', {})
    ctx, page, errors = new_page(browser, 1440, 900)
    page.locator('#amount').press('Enter')
    page.wait_for_function("document.getElementById('apply-form').dataset.step === '2'")
    ok('Enter on a slider in step 1 → step 2', True)
    page.wait_for_function("document.getAnimations().filter(a => a.playState === 'running').length === 0")
    ok('focus moves to the first field of step 2', page.evaluate('document.activeElement.id') == 'firstName')
    fill_personal(page)
    page.locator('#email').press('Enter')
    page.wait_for_function("document.getElementById('apply-form').dataset.step === '3'")
    ok('Enter in step 2 → step 3', True)
    page.wait_for_function("document.getAnimations().filter(a => a.playState === 'running').length === 0")
    ok('focus moves to the first field of step 3', page.evaluate('document.activeElement.id') == 'purpose')
    page.locator('#purpose').press('Enter')  # a select keeps its own Enter: no submit
    ok('Enter on a select does not submit', len(sent()) == 0)
    fill_address(page)
    page.locator('#occupation').press('Enter')
    page.wait_for_function("document.getElementById('apply-form').dataset.step === '4'")
    ok('Enter in step 3 → step 4', True)
    page.wait_for_function("document.getAnimations().filter(a => a.playState === 'running').length === 0")
    page.locator('#consent').press('Enter')
    ok('Enter in step 4 without consent shows the consent error', 'Общите условия' in (page.text_content('#consent-error') or ''))
    page.check('#consent')
    page.locator('#consent').press('Enter')
    expect(page.locator('#apply-success')).to_be_visible(timeout=20000)
    ok('Enter in step 4 submits', len(sent()) == 2, str(len(sent())))
    page.goto(BASE); page.wait_for_load_state('networkidle')
    page.locator('#term').press('Enter'); settle(page)
    page.fill('#firstName', 'И'); page.locator('#firstName').press('Enter')
    ok('Enter with an invalid field stays and shows the error', page.get_attribute('#apply-form', 'data-step') == '2' and (page.text_content('#firstName-error') or '') != '')
    ctx.close()

    # Lead email fails -> error with retry -> retry succeeds
    mock('/__reset', {}); mock('/__mode', {'lead': 'fail'})
    ctx, page, errors = new_page(browser, 375, 812)
    fill_all(page); submit(page)
    expect(page.locator('#form-alert')).to_be_visible(timeout=20000)
    ok('lead failure -> error message', 'технически проблем' in page.text_content('#form-alert-text'))
    ok('lead failure -> retry button visible', page.locator('[data-action="retry"]').is_visible())
    ok('lead failure -> no confirmation sent', all(e['kind'] == 'lead' for e in sent()))
    page.screenshot(path=f'{OUT}/error-retry.png')
    mock('/__mode', {'lead': 'ok'})
    page.click('[data-action="retry"]')
    expect(page.locator('#apply-success')).to_be_visible(timeout=20000)
    ok('retry after failure -> success', True)
    ctx.close()

    # Only confirmation fails -> still success
    mock('/__reset', {}); mock('/__mode', {'confirm': 'fail'})
    ctx, page, errors = new_page(browser, 1440, 900)
    fill_all(page); submit(page)
    expect(page.locator('#apply-success')).to_be_visible(timeout=20000)
    ok('confirmation failure -> user still sees success', True)
    ctx.close()
    mock('/__mode', {'confirm': 'ok'})

    # Honeypot -> fake success, nothing sent
    mock('/__reset', {})
    ctx, page, errors = new_page(browser, 1440, 900)
    fill_all(page)
    page.evaluate("document.getElementById('company_website').value = 'http://spam.example'")
    submit(page)
    expect(page.locator('#apply-success')).to_be_visible(timeout=20000)
    ok('honeypot -> no emails sent', len(sent()) == 0)
    ctx.close()

    # Server-side checks, independent of the browser
    reset_limits()
    ctx = browser.new_context(extra_http_headers={'x-real-ip': '10.0.1.1'})
    post = lambda data=None, headers=None, **kw: ctx.request.post(f'{BASE}/api/apply', headers={**API_HEADERS, **(headers or {})}, data=data, **kw)
    r = post({'amount': 100, 'term': 2, 'purpose': 'x', 'housing': 'x', 'city': 'Атлантида', 'consent': False, 'turnstileToken': ''})
    body = r.json()
    all_fields = {f for s in STEP_FIELDS for f in s}
    ok('server rejects invalid data with 422 (all fields)', r.status == 422 and set(body['errors']) == all_fields, f'{r.status} {sorted(set(all_fields) - set(body.get("errors", {})))}')
    r = post({**VALID_API, 'turnstileToken': ''})
    ok('missing Turnstile token -> 403', r.status == 403, str(r.status))
    r = post({**VALID_API, 'egn': '8001011234', 'turnstileToken': 'x'})
    ok('unknown key (strict schema) -> 400', r.status == 400, str(r.status))
    r = post({**VALID_API, 'website': 'x', 'turnstileToken': 'x'})
    ok('old honeypot name is an unknown key -> 400', r.status == 400, str(r.status))
    r = post('hi', headers={'content-type': 'text/plain'})
    ok('non-JSON -> 403', r.status == 403, str(r.status))
    r = post({**VALID_API, 'turnstileToken': 'x'}, headers={'origin': 'https://evil.example'})
    ok('foreign Origin -> 403', r.status == 403, str(r.status))
    r = ctx.request.post(f'{BASE}/api/apply', data={**VALID_API, 'turnstileToken': 'x'})
    ok('missing Origin -> 403', r.status == 403, str(r.status))
    r = ctx.request.get(f'{BASE}/api/apply')
    ok('GET /api/apply -> 403', r.status == 403, str(r.status))
    r = post(b'{"x":"' + b'x' * 5000 + b'"}', headers={'content-type': 'application/json'})
    ok('oversized body (> 4 KB) -> 413', r.status == 413, str(r.status))
    r = post(b'{"a":', headers={'content-type': 'application/json'})
    ok('broken JSON -> 400', r.status == 400, str(r.status))
    for raw, want in [('888 123 456', 403), ('0888 123 456', 403), ('+359 888 123 456', 403), ('00359888123456', 403), ('2 980 1234', 403), ('12345', 422), ('', 422)]:
        r = post({**VALID_API, 'phone': raw, 'turnstileToken': ''})
        ok(f'server phone "{raw}" -> {want}', r.status == want, str(r.status))
    r = ctx.request.get(f'{BASE}/api/health')
    ok('GET /api/health -> 200 "ok"', r.status == 200 and r.text() == 'ok', f'{r.status} {r.text()!r}')
    ctx.close()

    # Rate limits (Upstash mock). Valid payloads with the Turnstile test token reach the limiter.
    DUMMY = 'XXXX.DUMMY.TOKEN.XXXX'
    # Unique per run: the server keeps blocked identifiers in memory (ephemeral cache) until the window ends
    RUN = __import__('random').randint(1000, 9999)
    def submit_api(ctx, n, email=None, phone=None):
        return ctx.request.post(f'{BASE}/api/apply', headers=API_HEADERS, data={
            **VALID_API, 'turnstileToken': DUMMY,
            'email': email or f'delivered+rl{RUN}-{n}@resend.dev', 'phone': phone or f'08{RUN}{n:04d}'})
    reset_limits(); mock('/__reset', {})
    rl_ip = f'10.3.{RUN % 250}.{RUN % 7 + 1}'
    ctx = browser.new_context(extra_http_headers={'x-real-ip': rl_ip})
    codes = [submit_api(ctx, n).status for n in range(7)]
    ok('per IP: 5 / 10 min, then 429', codes == [200] * 5 + [429, 429], str(codes))
    r = submit_api(ctx, 99)
    ok('429 message has the phone and no retry', r.status == 429 and '+359 888 807 152' in r.json()['message'] and not r.json().get('retry'), r.text())
    keys = upstash_keys()
    ok('rate-limit keys are hashed (no IP/email/phone)', keys and not any(x in k for k in keys for x in [rl_ip, 'resend.dev', f'08{RUN}', '+359']), str(keys[:3]))
    ctx.close()
    reset_limits()
    codes = [submit_api(browser.new_context(extra_http_headers={'x-real-ip': f'10.4.{RUN % 250}.{n + 1}'}), 100 + n, email=f'delivered+same{RUN}@resend.dev').status for n in range(4)]
    ok('per email: 3 / day, then 429', codes == [200, 200, 200, 429], str(codes))
    reset_limits()
    codes = [submit_api(browser.new_context(extra_http_headers={'x-real-ip': f'10.5.{RUN % 250}.{n + 1}'}), 200 + n, phone=f'08 9{RUN} 555').status for n in range(4)]
    ok('per phone: 3 / day, then 429', codes == [200, 200, 200, 429], str(codes))
    reset_limits()

    # Global: above 200 leads/hour the lead still goes out, the confirmation does not
    mock('/__reset', {})
    gctx = browser.new_context()
    for n in range(201):
        gctx.request.post(f'{BASE}/api/apply', headers={**API_HEADERS, 'x-real-ip': f'11.{RUN % 250}.{n % 250}.{n // 250 + 1}'}, data={
            **VALID_API, 'turnstileToken': DUMMY, 'email': f'delivered+g{RUN}-{n}@resend.dev', 'phone': f'07{RUN}{n:04d}'})
    s_all = sent()
    leads = sum(1 for e in s_all if e['kind'] == 'lead'); confs = sum(1 for e in s_all if e['kind'] == 'confirm')
    ok('global 200/h: 201 leads delivered, 200 confirmations', leads == 201 and confs == 200, f'{leads} leads, {confs} confirmations')
    gctx.close()
    reset_limits()

    # Touch screen: each step starts right under the header, and no field is auto-focused
    # (that would open the keyboard, which scrolls the page to the field by itself)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page(); page.goto(BASE); page.wait_for_load_state('networkidle')
    label_top = "Math.round(document.querySelector('#apply-form .progress').getBoundingClientRect().top - document.querySelector('header').getBoundingClientRect().height)"
    page.locator('fieldset:not([disabled]) [data-action="next"]').tap(); settle(page); page.wait_for_timeout(300)
    ok('touch: step 2 starts under the header', 8 <= page.evaluate(label_top) <= 24, str(page.evaluate(label_top)))
    ok('touch: focus on the step, not a field (no keyboard)', page.evaluate("document.activeElement.matches('fieldset.step')"))
    fill_personal(page)
    page.evaluate('scrollBy(0, 300)')
    page.locator('fieldset:not([disabled]) [data-action="next"]').tap(); settle(page); page.wait_for_timeout(300)
    ok('touch: step 3 starts under the header', step(page) == '3' and 8 <= page.evaluate(label_top) <= 24, str(page.evaluate(label_top)))
    ctx.close()

    browser.close()

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} passed')
