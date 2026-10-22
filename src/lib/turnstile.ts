const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const TURNSTILE_ACTION = 'apply';

interface SiteverifyResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
  metadata?: { result_with_testing_key?: boolean };
}

/**
 * Pure check of a siteverify response (unit-tested). Requires success, an allowed hostname and
 * action "apply". Cloudflare's test keys answer with hostname "example.com" and no action;
 * such answers are accepted only when `allowTestKeys` (local dev).
 */
export function isValidVerification(data: SiteverifyResponse, hostnames: string[], allowTestKeys: boolean): boolean {
  if (data.success !== true) return false;
  if (data.metadata?.result_with_testing_key) return allowTestKeys;
  return !!data.hostname && hostnames.includes(data.hostname) && data.action === TURNSTILE_ACTION;
}

/** Tokens are single-use: every call goes to Cloudflare, nothing is cached. */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
  hostnames: string[],
  allowTestKeys: boolean,
): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    return isValidVerification((await res.json()) as SiteverifyResponse, hostnames, allowTestKeys);
  } catch {
    return false;
  }
}
