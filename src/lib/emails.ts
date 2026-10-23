// Email templates: table layout + inline styles so Gmail and Outlook render them.
// No remote images and no tracking pixels: the logo is embedded in the message itself
// (CID attachment, see emailLogoAttachment) and referenced as cid:rf-logo.
import { site } from '../config/site';
import { agentStatement } from '../data/company';
import { subjectSafe } from './security';
import { HOUSING, PURPOSES, formatEur, formatMonths, type Application } from './application';
import { EMAIL_LOGO } from './email-logo';

const C = {
  page: '#ececec', // light, neutral surround around the card
  footer: '#8f8a82', // fine print: present but quiet
  gold: '#c9a24a',
};
// Applicant email: the dark brand card. Office email: light, for reading many rows at a glance.
type Theme = { head: string; card: string; border: string; brand: string; title: string; text: string; muted: string; link: string };
const DARK: Theme = { head: '#0a0a0a', card: '#141414', border: '#3a3120', brand: '#c9a24a', title: '#e8c97a', text: '#f2ede3', muted: '#a8a197', link: '#c9a24a' };
const LIGHT: Theme = { head: '#ffffff', card: '#ffffff', border: '#e4dccb', brand: '#9a7a2e', title: '#7d6222', text: '#1c1a17', muted: '#6b6760', link: '#7d6222' };
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Arial, Helvetica, sans-serif";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const sofiaTime = (d: Date) =>
  new Intl.DateTimeFormat('bg-BG', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Sofia' }).format(d);

/** Inline logo for Resend: sent with the message, shown via cid:, never fetched from a server. */
export const emailLogoAttachment = {
  filename: EMAIL_LOGO.filename,
  content: EMAIL_LOGO.base64,
  contentId: EMAIL_LOGO.contentId,
  contentType: 'image/png',
};

/** `footer`: the agent disclosure for the applicant; the internal office email has none. */
function layout(title: string, inner: string, t: Theme, footer?: string) {
  return `<!doctype html>
<html lang="bg" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background-color:${C.page};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
    <tr><td bgcolor="${t.head}" style="background-color:${t.head};border:1px solid ${t.border};border-bottom:0;padding:24px 28px 20px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding:0 14px 0 0;vertical-align:middle;"><img src="cid:${EMAIL_LOGO.contentId}" width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}" alt="" style="display:block;border:0;outline:none;text-decoration:none;"></td>
        <td style="vertical-align:middle;font-family:${SERIF};font-size:22px;letter-spacing:3px;color:${t.brand};">ROYAL&nbsp;FINANCE</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="${t.card}" style="background-color:${t.card};border:1px solid ${t.border};border-top:3px solid ${C.gold};padding:32px 28px;">
      ${inner}
    </td></tr>
    ${footer ? `<tr><td align="center" style="padding:14px 24px 0 24px;font-family:${SANS};font-size:10px;line-height:14px;color:${C.footer};">
      ${esc(footer)}
    </td></tr>` : ''}
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Email to the company with every field of the application. */
export function leadEmail(a: Application, submittedAt: Date) {
  const name = `${a.firstName} ${a.lastName}`;
  // Subject: no CR/LF (header injection) and the name cut to 40 chars
  const subject = `Нова заявка: ${formatEur(a.amount)} / ${a.term} мес. — ${subjectSafe(name, 40)}`;
  const rows: [string, string][] = [
    ['Желана сума', formatEur(a.amount)],
    ['Срок', formatMonths(a.term)],
    ['Име', a.firstName],
    ['Фамилия', a.lastName],
    ['Телефон', a.phone],
    ['Имейл', a.email],
    ['Причина за финансиране', PURPOSES[a.purpose]],
    ['Град', a.city],
    ['Настоящ адрес', a.currentAddress],
    ['Адрес по лична карта', a.idAddress],
    ['В собствено жилище ли живее', HOUSING[a.housing]],
    ['Какво работи', a.occupation],
    ['Съгласие', `Да, приел Общите условия и Политиката за поверителност (${sofiaTime(submittedAt)})`],
    ['Подадена на', sofiaTime(submittedAt)],
  ];
  const htmlRows = rows
    .map(
      ([k, v]) => `<tr>
  <td style="padding:10px 12px 10px 0;border-bottom:1px solid ${LIGHT.border};font-family:${SANS};font-size:13px;color:${LIGHT.muted};white-space:nowrap;vertical-align:top;">${esc(k)}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${LIGHT.border};font-family:${SANS};font-size:15px;color:${LIGHT.text};vertical-align:top;">${esc(v)}</td>
</tr>`,
    )
    .join('');
  const html = layout(
    subject,
    `<h1 style="margin:0 0 20px 0;font-family:${SERIF};font-size:22px;font-weight:normal;color:${LIGHT.title};">Нова заявка за кредит</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${htmlRows}</table>
<p style="margin:20px 0 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${LIGHT.muted};">Отговорът на този имейл отива директно до кандидата.</p>`,
    LIGHT,
  );
  const text = [
    'Нова заявка за кредит',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Отговорът на този имейл отива директно до кандидата.',
  ].join('\n');
  return { subject, html, text };
}

/** Confirmation to the applicant. Deliberately contains no personal data. */
export function confirmationEmail() {
  const subject = 'Получихме кандидатурата Ви';
  const html = layout(
    subject,
    `<h1 style="margin:0 0 16px 0;font-family:${SERIF};font-size:22px;font-weight:normal;color:${DARK.title};">Благодарим Ви!</h1>
<p style="margin:0 0 16px 0;font-family:${SANS};font-size:15px;line-height:24px;color:${DARK.text};">Получихме кандидатурата Ви. Наш консултант ще се свърже с Вас скоро.</p>
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:22px;color:${DARK.muted};">Ако имате въпроси, обадете ни се на <a href="${site.phone.href}" style="color:${DARK.link};text-decoration:none;">${esc(site.phone.display)}</a> (${esc(site.hours)}).</p>`,
    DARK,
    agentStatement,
  );
  const text = [
    'Благодарим Ви!',
    '',
    'Получихме кандидатурата Ви. Наш консултант ще се свърже с Вас скоро.',
    '',
    `Ако имате въпроси, обадете ни се на ${site.phone.display} (${site.hours}).`,
    '',
    agentStatement,
  ].join('\n');
  return { subject, html, text };
}
