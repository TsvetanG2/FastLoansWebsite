import { checkRateLimit } from '@vercel/firewall';

// Primary: Vercel Firewall rule with condition "@vercel/firewall" and ID "apply"
// (Vercel -> Firewall -> Rules). Fallback: per-instance in-memory window, used
// in dev and until that rule exists.
const RULE_ID = 'apply';
const WINDOW_MS = 60_000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

export async function isRateLimited(request: Request, clientAddress?: string): Promise<boolean> {
  if (import.meta.env.PROD) {
    try {
      const r = await checkRateLimit(RULE_ID, { request, timeout: 1500 });
      if (r.error !== 'not-found') return r.rateLimited;
    } catch {
      // Firewall unreachable: fall through to the in-memory limiter
    }
  }
  const key = request.headers.get('x-real-ip') ?? clientAddress ?? 'unknown';
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}
