# Runs against tests/e2e/serve-output.mjs (production build + production headers).
# Checks the CSP blocks nothing the site needs: scripts, styles, fonts, images, Turnstile.
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4500'
results = []


def ok(name, cond, detail=''):
    results.append(bool(cond))
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))


def wait_until(page, js, timeout=15):
    # page.wait_for_function polls via eval(), which this CSP blocks (no 'unsafe-eval') — poll from Python
    import time
    end = time.time() + timeout
    while time.time() < end:
        if page.evaluate(js):
            return True
        time.sleep(0.2)
    raise TimeoutError(js)


WATCH = """window.__csp = []; document.addEventListener('securitypolicyviolation',
  e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in [(375, 812), (1440, 900)]:
        ctx = b.new_context(viewport={'width': w, 'height': h})
        ctx.add_init_script(WATCH)
        page = ctx.new_page()
        console = []
        page.on('console', lambda m: console.append(m.text) if m.type == 'error' else None)
        r = page.goto(BASE)
        page.wait_for_load_state('networkidle')
        hdr = r.headers
        ok(f'[{w}] CSP header present', "frame-ancestors 'none'" in hdr.get('content-security-policy', ''))
        for k in ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options']:
            ok(f'[{w}] header {k}', k in hdr)
        ok(f'[{w}] fonts load (font-src self)', page.evaluate("document.fonts.check('16px \"Manrope Variable\"') && document.fonts.check('16px \"Playfair Display Variable\"')"))
        ok(f'[{w}] Vercel Analytics script requested same-origin', page.evaluate("performance.getEntriesByType('resource').some(e => e.name.endsWith('/_vercel/insights/script.js'))"))
        ok(f'[{w}] hero image loads', page.evaluate("document.querySelector('.hero-bg').naturalWidth > 0"))
        # Scripts run: the form moves to step 2, which loads Turnstile from challenges.cloudflare.com
        page.fill('#firstName', 'Иван'); page.fill('#lastName', 'Петров'); page.fill('#phone', '888123456'); page.fill('#email', 'a@b.bg')
        page.locator('fieldset:not([disabled]) [data-action="next"]').click()
        wait_until(page, "document.getElementById('apply-form').dataset.step === '2'")
        wait_until(page, '!!window.turnstile')
        # The widget iframe lives in a closed shadow root: check the frame and the issued token instead
        wait_until(page, "!!(document.querySelector('[name=cf-turnstile-response]') || {}).value")
        ok(f'[{w}] Turnstile iframe loads under CSP', any('challenges.cloudflare.com' in f.url for f in page.frames))
        ok(f'[{w}] Turnstile issues a token', bool(page.input_value('[name=cf-turnstile-response]')))
        # Reveal script works (external module)
        page.evaluate('window.scrollTo(0, document.body.scrollHeight)'); page.wait_for_timeout(1200)
        ok(f'[{w}] scroll reveal runs', page.evaluate("[...document.querySelectorAll('[data-reveal]')].some(e => e.classList.contains('is-visible'))"))
        for path in ['/privacy', '/about']:
            page.goto(BASE + path); page.wait_for_load_state('networkidle')
        violations = page.evaluate('window.__csp')
        ok(f'[{w}] no CSP violations', not violations, '; '.join(violations))
        ok(f'[{w}] no console errors', not [c for c in console if 'Content Security Policy' in c or 'Refused' in c], '; '.join(console))
        ctx.close()
    b.close()

print(f'\n{sum(results)}/{len(results)} passed')
sys.exit(0 if all(results) else 1)
