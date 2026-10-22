// Cheap request guards for /api/apply (see security.md). Pure functions so they can be unit-tested.

export const MAX_BODY_BYTES = 4096;

export const PROD_ORIGINS = ['https://royalfinance.bg', 'https://www.royalfinance.bg'];
export const DEV_ORIGINS = ['http://localhost:4321'];

/**
 * Allowed `Origin` values. `extra` is the optional ALLOWED_ORIGINS env var (comma-separated),
 * e.g. the *.vercel.app URL while the real domain is not connected yet.
 */
export function allowedOrigins(extra: string | undefined, dev: boolean): string[] {
  const added = (extra ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter((s) => /^https?:\/\/[^/\s]+$/.test(s));
  return [...PROD_ORIGINS, ...added, ...(dev ? DEV_ORIGINS : [])];
}

/** Hostnames Turnstile may report for a valid token (same list as the origins). */
export const allowedHostnames = (origins: string[]) => origins.map((o) => new URL(o).hostname);

export type GuardFailure = 'method' | 'content_type' | 'origin';

/** Method, content type and origin — all answered with 403. */
export function checkRequest(request: Request, origins: string[]): GuardFailure | null {
  if (request.method !== 'POST') return 'method';
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return 'content_type';
  const origin = request.headers.get('origin');
  if (!origin || !origins.includes(origin)) return 'origin';
  return null;
}

/**
 * Read the body as text, giving up as soon as it exceeds `max` bytes (so a huge body is
 * never buffered). Returns null when the body is too large.
 */
export async function readLimitedBody(request: Request, max = MAX_BODY_BYTES): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** sha256(value + salt) as hex — rate-limit keys never contain raw IPs, emails or phones. */
export async function hashKey(value: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(value + salt);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Subject-safe text: no CR/LF, at most `max` characters. */
export function subjectSafe(value: string, max: number): string {
  const flat = value.replace(/[\r\n]+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
