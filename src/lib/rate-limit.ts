// Rate limits for /api/apply (security.md): Upstash Redis via @upstash/ratelimit.
// In-memory counters do not work on serverless (every instance has its own memory).
// Keys are sha256(value + RATE_LIMIT_SALT), never raw IP/email/phone; TTL = window.
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { hashKey } from './security';

export interface LimitConfig {
  url?: string;
  token?: string;
  salt?: string;
}

export type LimitResult =
  /** Redis not configured or unreachable — request continues (Turnstile still protects). */
  | { status: 'unavailable' }
  | { status: 'limited'; by: 'ip' | 'email' | 'phone' }
  /** `globalExceeded`: over 200 leads/hour → keep the lead, skip the confirmation email. */
  | { status: 'ok'; globalExceeded: boolean };

const RULES: Record<string, [number, Duration]> = {
  ip10m: [5, '10 m'],
  ipDay: [20, '1 d'],
  email: [3, '1 d'],
  phone: [3, '1 d'],
  global: [200, '1 h'],
};

let cache: { key: string; limiters: Record<string, Ratelimit> } | undefined;

function limiters(url: string, token: string) {
  const key = `${url}|${token}`;
  if (cache?.key !== key) {
    const redis = new Redis({ url, token, retry: false });
    cache = {
      key,
      limiters: Object.fromEntries(
        Object.entries(RULES).map(([name, [tokens, window]]) => [
          name,
          new Ratelimit({
            redis,
            limiter: Ratelimit.fixedWindow(tokens, window),
            prefix: `rf:${name}`,
            analytics: false,
            timeout: 1500,
            // Blocked identifiers are cached per instance to spare Redis calls — but not the
            // global counter: it only decides whether to send confirmations, and a cached block
            // would silence them on that instance until the hour ends.
            ephemeralCache: name === 'global' ? false : undefined,
          }),
        ]),
      ),
    };
  }
  return cache.limiters;
}

export async function checkLimits(
  ids: { ip: string; email: string; phone: string },
  config: LimitConfig,
): Promise<LimitResult> {
  if (!config.url || !config.token) return { status: 'unavailable' };
  try {
    const l = limiters(config.url, config.token);
    const salt = config.salt ?? '';
    const [ip, email, phone] = await Promise.all([
      hashKey(ids.ip, salt),
      hashKey(ids.email.toLowerCase(), salt),
      hashKey(ids.phone, salt),
    ]);
    const [ip10m, ipDay, byEmail, byPhone] = await Promise.all([
      l.ip10m.limit(ip),
      l.ipDay.limit(ip),
      l.email.limit(email),
      l.phone.limit(phone),
    ]);
    // A timed-out check is let through by the library; report it as unavailable.
    if ([ip10m, ipDay, byEmail, byPhone].some((r) => r.reason === 'timeout')) return { status: 'unavailable' };
    if (!ip10m.success || !ipDay.success) return { status: 'limited', by: 'ip' };
    if (!byEmail.success) return { status: 'limited', by: 'email' };
    if (!byPhone.success) return { status: 'limited', by: 'phone' };
    const global = await l.global.limit('all');
    return { status: 'ok', globalExceeded: !global.success };
  } catch {
    return { status: 'unavailable' };
  }
}
