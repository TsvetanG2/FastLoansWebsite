import type { APIRoute } from 'astro';
import {
  ALLOWED_ORIGINS,
  EMAIL_FROM,
  KV_REST_API_TOKEN,
  KV_REST_API_URL,
  LEADS_EMAIL_TO,
  RATE_LIMIT_SALT,
  RESEND_API_KEY,
  TURNSTILE_SECRET_KEY,
  UPSTASH_REDIS_REST_TOKEN,
  UPSTASH_REDIS_REST_URL,
} from 'astro:env/server';
import { Resend } from 'resend';
import { FIELDS, requestSchema, type Field, type FieldErrors } from '../../lib/application';
import { company } from '../../data/company';
import { confirmationEmail, leadEmail } from '../../lib/emails';
import { checkLimits } from '../../lib/rate-limit';
import { allowedHostnames, allowedOrigins, checkRequest, readLimitedBody } from '../../lib/security';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const DEV = import.meta.env.DEV;
const ORIGINS = allowedOrigins(ALLOWED_ORIGINS, DEV);
const HOSTNAMES = allowedHostnames(ORIGINS);

// Generic messages only: never stack traces or provider error text.
const MSG = {
  forbidden: 'Заявката не е разрешена.',
  tooLarge: 'Заявката е твърде голяма.',
  invalid: 'Невалидна заявка. Презаредете страницата и опитайте отново.',
  fields: 'Проверете отбелязаните полета.',
  robot: 'Не успяхме да потвърдим, че не сте робот. Опитайте отново.',
  limited: `Твърде много опити. Моля, опитайте отново по-късно или ни се обадете на ${company.phone}.`,
  failed: 'Заявката не беше изпратена заради технически проблем. Опитайте отново.',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// Logs carry only a submission id, a timestamp and an outcome code — never names, emails, phones or IPs.
const logger = () => {
  const id = crypto.randomUUID();
  return (outcome: string, level: 'log' | 'warn' = 'log') =>
    console[level](JSON.stringify({ ts: new Date().toISOString(), id, outcome }));
};

/** Every other method on this route. */
export const ALL: APIRoute = () => {
  logger()('rejected_method');
  return json(403, { ok: false, message: MSG.forbidden });
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const log = logger();

  // 1. Method, content type, origin
  const guard = checkRequest(request, ORIGINS);
  if (guard) {
    log(`rejected_${guard}`);
    return json(403, { ok: false, message: MSG.forbidden });
  }

  // 2. Body size, before parsing
  const raw = await readLimitedBody(request);
  if (raw === null) {
    log('rejected_too_large');
    return json(413, { ok: false, message: MSG.tooLarge });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    log('rejected_bad_json');
    return json(400, { ok: false, message: MSG.invalid });
  }

  // 3. Schema (strict: unknown keys are rejected)
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    let foreign = false;
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as Field;
      if (issue.code === 'unrecognized_keys' || !FIELDS.includes(key)) foreign = true;
      else errors[key] ??= issue.message;
    }
    log(foreign ? 'rejected_unknown_keys' : 'rejected_invalid');
    return foreign
      ? json(400, { ok: false, message: MSG.invalid })
      : json(422, { ok: false, errors, message: MSG.fields });
  }
  const { company_website, turnstileToken, ...application } = parsed.data;

  // 4. Honeypot: real users never see this field. Pretend success so bots learn nothing.
  if (company_website && company_website.trim() !== '') {
    log('honeypot');
    return json(200, { ok: true });
  }

  // 5. Turnstile
  const ip = request.headers.get('x-real-ip') ?? clientAddress;
  if (!(await verifyTurnstile(turnstileToken, TURNSTILE_SECRET_KEY, ip, HOSTNAMES, DEV))) {
    log('rejected_turnstile');
    return json(403, { ok: false, retry: true, message: MSG.robot });
  }

  // 6. Rate limits
  if (!RATE_LIMIT_SALT && !DEV) log('rate_limit_salt_missing', 'warn');
  const limits = await checkLimits(
    { ip, email: application.email, phone: application.phone },
    {
      url: UPSTASH_REDIS_REST_URL ?? KV_REST_API_URL,
      token: UPSTASH_REDIS_REST_TOKEN ?? KV_REST_API_TOKEN,
      salt: RATE_LIMIT_SALT,
    },
  );
  if (limits.status === 'unavailable') log('rate_limit_unavailable', 'warn');
  if (limits.status === 'limited') {
    log(`rate_limited_${limits.by}`);
    return json(429, { ok: false, message: MSG.limited });
  }
  const skipConfirmation = limits.status === 'ok' && limits.globalExceeded;
  if (skipConfirmation) log('alert_global_limit', 'warn');

  // 7. Emails
  const resend = new Resend(RESEND_API_KEY);

  // 7a. Lead to the company. If this fails, the user must be able to retry.
  const lead = leadEmail(application, new Date());
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: LEADS_EMAIL_TO,
      replyTo: application.email, // validated by the schema above
      subject: lead.subject,
      html: lead.html,
      text: lead.text,
    });
    if (error || !data) {
      log('lead_failed');
      return json(502, { ok: false, retry: true, message: MSG.failed });
    }
    log('lead_sent');
  } catch {
    log('lead_failed');
    return json(502, { ok: false, retry: true, message: MSG.failed });
  }

  // 7b. Confirmation to the applicant (fixed text). A failure here does not affect the user.
  if (skipConfirmation) {
    log('confirmation_skipped');
  } else {
    const confirmation = confirmationEmail();
    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: application.email,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
      });
      log(error || !data ? 'confirmation_failed' : 'confirmation_sent');
    } catch {
      log('confirmation_failed');
    }
  }

  return json(200, { ok: true });
};
