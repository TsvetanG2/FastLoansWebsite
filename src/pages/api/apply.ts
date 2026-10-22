import type { APIRoute } from 'astro';
import { EMAIL_FROM, LEADS_EMAIL_TO, RESEND_API_KEY, TURNSTILE_SECRET_KEY } from 'astro:env/server';
import { Resend } from 'resend';
import { validate } from '../../lib/application';
import { confirmationEmail, leadEmail } from '../../lib/emails';
import { isRateLimited } from '../../lib/rate-limit';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const MAX_BODY_BYTES = 10_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// Logs carry only an event name, status and Resend id — never personal data.
const log = (event: string, info: Record<string, string | number | undefined> = {}) =>
  console.log(JSON.stringify({ event, ...info }));

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json(415, { ok: false, message: 'Неподдържан формат на заявката.' });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { ok: false, message: 'Заявката е твърде голяма.' });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, message: 'Невалидна заявка. Презаредете страницата и опитайте отново.' });
  }

  // Honeypot: real users never see this field. Pretend success so bots learn nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    log('apply.honeypot');
    return json(200, { ok: true });
  }

  if (await isRateLimited(request, clientAddress)) {
    log('apply.rate_limited');
    return json(429, { ok: false, retry: true, message: 'Твърде много опити. Изчакайте минута и опитайте отново.' });
  }

  const result = validate(body);
  if (!result.ok) {
    return json(422, { ok: false, errors: result.errors, message: 'Проверете отбелязаните полета.' });
  }

  const ip = request.headers.get('x-real-ip') ?? clientAddress;
  const human = await verifyTurnstile(String(body.turnstileToken ?? ''), TURNSTILE_SECRET_KEY, ip);
  if (!human) {
    log('apply.turnstile_failed');
    return json(403, {
      ok: false,
      retry: true,
      message: 'Не успяхме да потвърдим, че не сте робот. Опитайте отново.',
    });
  }

  const resend = new Resend(RESEND_API_KEY);
  const application = result.data;

  // 1. Lead to the company. If this fails, the user must be able to retry.
  const lead = leadEmail(application, new Date());
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: LEADS_EMAIL_TO,
      replyTo: application.email,
      subject: lead.subject,
      html: lead.html,
      text: lead.text,
    });
    if (error || !data) {
      log('apply.lead_email', { status: 'failed', error: error?.name });
      return json(502, {
        ok: false,
        retry: true,
        message: 'Заявката не беше изпратена заради технически проблем. Опитайте отново.',
      });
    }
    log('apply.lead_email', { status: 'sent', id: data.id });
  } catch {
    log('apply.lead_email', { status: 'failed', error: 'exception' });
    return json(502, {
      ok: false,
      retry: true,
      message: 'Заявката не беше изпратена заради технически проблем. Опитайте отново.',
    });
  }

  // 2. Confirmation to the applicant. A failure here does not affect the user.
  const confirmation = confirmationEmail();
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: application.email,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });
    log('apply.confirmation_email', error || !data ? { status: 'failed', error: error?.name } : { status: 'sent', id: data.id });
  } catch {
    log('apply.confirmation_email', { status: 'failed', error: 'exception' });
  }

  return json(200, { ok: true });
};
