// Resend Receiving webhook: mail sent to our public address (e.g. finance@royalfinance.bg) is
// forwarded to the office mailbox. Server-to-server only — no Origin/Turnstile checks here; instead
// every request must carry a valid Resend (Standard Webhooks) signature.
// Env (Vercel → Environment Variables, changeable without code):
//   RESEND_WEBHOOK_SECRET  signing secret of the webhook in Resend → Webhooks
//   INBOUND_ADDRESSES      our addresses to accept, comma-separated (e.g. finance@royalfinance.bg)
//   INBOUND_FORWARD_TO     where to forward them (e.g. royalfinance@abv.bg), comma-separated allowed
import type { APIRoute } from 'astro';
import { EMAIL_FROM, INBOUND_ADDRESSES, INBOUND_FORWARD_TO, RESEND_API_KEY, RESEND_WEBHOOK_SECRET } from 'astro:env/server';
import { Resend } from 'resend';
import { bareAddress, buildForward, forwardDecision, parseAddressList } from '../../lib/inbound';
import { readLimitedBody } from '../../lib/security';

export const prerender = false;

const MAX_WEBHOOK_BYTES = 64 * 1024; // the event carries metadata only, not the message body

// Logs: an id, a timestamp and an outcome code — never addresses, subjects or content.
const log = (outcome: string, level: 'log' | 'warn' = 'log') =>
  console[level](JSON.stringify({ ts: new Date().toISOString(), route: 'inbound', outcome }));

const reply = (status: number) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });

export const ALL: APIRoute = () => reply(405);

export const POST: APIRoute = async ({ request }) => {
  const inboxes = parseAddressList(INBOUND_ADDRESSES);
  const forwardTo = parseAddressList(INBOUND_FORWARD_TO);
  if (!RESEND_WEBHOOK_SECRET || !inboxes.length || !forwardTo.length) {
    log('not_configured', 'warn');
    return reply(503);
  }

  const payload = await readLimitedBody(request, MAX_WEBHOOK_BYTES);
  if (payload === null) {
    log('too_large', 'warn');
    return reply(413);
  }

  const resend = new Resend(RESEND_API_KEY);
  let event;
  try {
    // Resend sends svix-* headers; the Standard Webhooks names (webhook-*) are accepted too
    const h = (name: string) => request.headers.get(`svix-${name}`) ?? request.headers.get(`webhook-${name}`) ?? '';
    event = resend.webhooks.verify({
      payload,
      headers: { id: h('id'), timestamp: h('timestamp'), signature: h('signature') },
      webhookSecret: RESEND_WEBHOOK_SECRET,
    });
  } catch {
    log('bad_signature', 'warn');
    return reply(401);
  }

  // Other event types (if the webhook is ever subscribed to more) are acknowledged and ignored
  if (event.type !== 'email.received') {
    log('ignored_event');
    return reply(200);
  }

  const decision = forwardDecision(event.data, inboxes, EMAIL_FROM);
  if (decision !== 'forward') {
    log(`skipped_${decision}`);
    return reply(200);
  }

  const id = event.data.email_id;
  // The inbox it was sent to (shown in the note on top of the forwarded copy)
  const inbox = [...event.data.received_for, ...event.data.to].map(bareAddress).find((r) => inboxes.includes(r)) ?? inboxes[0];
  try {
    const { data: email, error: getError } = await resend.emails.receiving.get(id);
    const { data: files, error: filesError } = await resend.emails.receiving.attachments.list({ emailId: id });
    if (getError || !email || filesError) {
      log('fetch_failed', 'warn');
      return reply(502); // non-2xx → Resend retries later
    }
    const copy = buildForward(email, files?.data ?? [], inbox);
    const { error } = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to: forwardTo,
        replyTo: copy.replyTo,
        subject: copy.subject,
        html: copy.html,
        text: copy.text,
        attachments: copy.attachments,
      },
      // Resend retries webhooks: the same email is forwarded at most once
      { idempotencyKey: `inbound-forward/${id}` },
    );
    if (error) {
      log('forward_failed', 'warn');
      return reply(502);
    }
    log('forwarded');
    return reply(200);
  } catch {
    log('forward_failed', 'warn');
    return reply(502);
  }
};
