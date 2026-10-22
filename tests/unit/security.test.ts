import { describe, expect, it } from 'vitest';
import {
  MAX_BODY_BYTES,
  allowedHostnames,
  allowedOrigins,
  checkRequest,
  hashKey,
  readLimitedBody,
  subjectSafe,
} from '../../src/lib/security';
import { isValidVerification } from '../../src/lib/turnstile';

const ORIGINS = allowedOrigins(undefined, false);
const req = (init: { method?: string; type?: string; origin?: string | null; body?: string } = {}) => {
  const headers = new Headers();
  if (init.type !== undefined) headers.set('content-type', init.type);
  else headers.set('content-type', 'application/json');
  if (init.origin !== null) headers.set('origin', init.origin ?? 'https://royalfinance.bg');
  return new Request('https://royalfinance.bg/api/apply', {
    method: init.method ?? 'POST',
    headers,
    body: (init.method ?? 'POST') === 'POST' ? (init.body ?? '{}') : undefined,
  });
};

describe('allowed origins', () => {
  it('always contains the production domains', () => {
    expect(ORIGINS).toEqual(['https://royalfinance.bg', 'https://www.royalfinance.bg']);
  });
  it('adds localhost only in dev', () => {
    expect(allowedOrigins(undefined, true)).toContain('http://localhost:4321');
    expect(ORIGINS).not.toContain('http://localhost:4321');
  });
  it('adds valid extra origins and ignores junk', () => {
    expect(allowedOrigins(' https://rf.vercel.app/ , javascript:alert(1), https://a.b/c', false)).toEqual([
      ...ORIGINS,
      'https://rf.vercel.app',
    ]);
  });
  it('derives hostnames for Turnstile', () => {
    expect(allowedHostnames(ORIGINS)).toEqual(['royalfinance.bg', 'www.royalfinance.bg']);
  });
});

describe('checkRequest', () => {
  it('passes a same-origin JSON POST', () => {
    expect(checkRequest(req(), ORIGINS)).toBeNull();
    expect(checkRequest(req({ type: 'application/json; charset=utf-8', origin: 'https://www.royalfinance.bg' }), ORIGINS)).toBeNull();
  });
  it.each([
    ['method', req({ method: 'GET' })],
    ['method', req({ method: 'PUT' })],
    ['content_type', req({ type: 'text/plain' })],
    ['content_type', req({ type: 'application/x-www-form-urlencoded' })],
    ['origin', req({ origin: null })],
    ['origin', req({ origin: 'https://evil.example' })],
    ['origin', req({ origin: 'https://royalfinance.bg.evil.example' })],
    ['origin', req({ origin: 'http://royalfinance.bg' })],
  ])('rejects: %s', (reason, request) => {
    expect(checkRequest(request, ORIGINS)).toBe(reason);
  });
});

describe('readLimitedBody', () => {
  it('reads a body under the limit', async () => {
    expect(await readLimitedBody(req({ body: '{"a":1}' }))).toBe('{"a":1}');
  });
  it('accepts exactly the limit', async () => {
    expect(await readLimitedBody(req({ body: 'x'.repeat(MAX_BODY_BYTES) }))).toHaveLength(MAX_BODY_BYTES);
  });
  it('rejects a body over the limit (counted in bytes, not characters)', async () => {
    expect(await readLimitedBody(req({ body: 'x'.repeat(MAX_BODY_BYTES + 1) }))).toBeNull();
    expect(await readLimitedBody(req({ body: 'Ж'.repeat(MAX_BODY_BYTES / 2 + 1) }))).toBeNull();
  });
  it('rejects early on a large Content-Length', async () => {
    const r = new Request('https://royalfinance.bg/api/apply', {
      method: 'POST',
      headers: { 'content-length': '999999' },
      body: '{}',
    });
    expect(await readLimitedBody(r)).toBeNull();
  });
});

describe('hashKey', () => {
  it('is deterministic, salted and never contains the raw value', async () => {
    const a = await hashKey('ivan@mail.bg', 'salt');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(await hashKey('ivan@mail.bg', 'salt'));
    expect(a).not.toBe(await hashKey('ivan@mail.bg', 'other'));
    expect(a).not.toContain('ivan');
  });
});

describe('subjectSafe', () => {
  it('strips CR/LF', () => {
    expect(subjectSafe('Иван\r\nBcc: x@y.z', 80)).toBe('Иван Bcc: x@y.z');
  });
  it('truncates to the limit', () => {
    const s = subjectSafe('А'.repeat(81), 40);
    expect(s).toHaveLength(40);
    expect(s.endsWith('…')).toBe(true);
  });
});

describe('Turnstile verification', () => {
  const hosts = ['royalfinance.bg', 'www.royalfinance.bg'];
  const ok = { success: true, hostname: 'royalfinance.bg', action: 'apply' };
  it('accepts success + allowed hostname + action "apply"', () => {
    expect(isValidVerification(ok, hosts, false)).toBe(true);
  });
  it.each([
    ['failure', { ...ok, success: false }],
    ['wrong hostname', { ...ok, hostname: 'evil.example' }],
    ['missing hostname', { ...ok, hostname: undefined }],
    ['wrong action', { ...ok, action: 'login' }],
    ['missing action', { ...ok, action: undefined }],
  ])('rejects: %s', (_, data) => {
    expect(isValidVerification(data, hosts, false)).toBe(false);
  });
  it('accepts Cloudflare test-key answers only in dev', () => {
    const test = { success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } };
    expect(isValidVerification(test, hosts, true)).toBe(true);
    expect(isValidVerification(test, hosts, false)).toBe(false);
  });
});
