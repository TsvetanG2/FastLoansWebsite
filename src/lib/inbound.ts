// Incoming mail for the domain (Resend Receiving): decides which received emails are forwarded.
// Pure functions, unit-tested; the route is src/pages/api/inbound.ts.
import { subjectSafe } from './security';

/** "Name <a@b.bg>" or "a@b.bg" → "a@b.bg" (lower case). */
export function bareAddress(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim().toLowerCase();
}

/** Comma-separated env value → list of bare, lower-case addresses. */
export function parseAddressList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => bareAddress(v))
    .filter((v) => v.includes('@'));
}

export interface ReceivedEmail {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  received_for?: string[];
}

export type ForwardDecision = 'forward' | 'not_our_address' | 'own_sender';

/**
 * Forward only mail sent to one of our public addresses (INBOUND_ADDRESSES), and never mail sent by
 * our own sender (EMAIL_FROM) — that would loop when an auto-reply or bounce comes back.
 */
export function forwardDecision(email: ReceivedEmail, inboxes: string[], ownSender: string): ForwardDecision {
  if (bareAddress(email.from) === bareAddress(ownSender)) return 'own_sender';
  const recipients = [...(email.received_for ?? []), ...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].map(bareAddress);
  return recipients.some((r) => inboxes.includes(r)) ? 'forward' : 'not_our_address';
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface FullReceivedEmail {
  from: string;
  to: string[];
  subject: string | null;
  reply_to: string[] | null;
  html: string | null;
  text: string | null;
  created_at: string;
}
export interface ReceivedAttachment {
  filename?: string;
  content_type: string;
  content_disposition: 'inline' | 'attachment';
  content_id?: string;
  download_url: string;
}

/**
 * The forwarded copy. Resend's own forward() drops the sender (no reply-to, no "from" shown), so
 * the office could neither see who wrote nor reply. Here: a short note on top names the sender and
 * our address, "Reply" goes straight to the sender, and attachments are kept (Resend fetches them
 * from their temporary download URLs; inline images are already data: URIs in `html`).
 */
export function buildForward(email: FullReceivedEmail, attachments: ReceivedAttachment[], inbox: string) {
  const sender = email.from;
  const when = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Sofia' }).format(new Date(email.created_at));
  const note = `Писмо до ${inbox} от ${sender}, ${when}. „Отговори“ изпраща отговора директно на подателя.`;
  const htmlNote = `<div style="margin:0 0 16px 0;padding:10px 12px;border-left:3px solid #c9a24a;background:#f7f4ec;font:13px/1.5 Arial,Helvetica,sans-serif;color:#4a463f;">${esc(note)}</div>`;
  const body = email.html ?? (email.text ? `<pre style="white-space:pre-wrap;font:14px/1.5 Arial,Helvetica,sans-serif;">${esc(email.text)}</pre>` : '');
  return {
    subject: subjectSafe(email.subject ?? '', 200) || '(без тема)', // single line: no header injection
    replyTo: email.reply_to?.length ? email.reply_to : [sender],
    html: htmlNote + body,
    text: `${note}\n\n${email.text ?? ''}`,
    attachments: attachments
      .filter((a) => a.content_disposition !== 'inline' || !email.html) // inline images live in the HTML
      .map((a) => ({ path: a.download_url, filename: a.filename || 'attachment', content_type: a.content_type })),
  };
}
