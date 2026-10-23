// Email templates: table layout + inline styles so Gmail and Outlook render them.
// No remote images (logo is a text wordmark) and no tracking pixels.
import { site } from '../config/site';
import { agentStatement } from '../data/company';
import { subjectSafe } from './security';
import { HOUSING, PURPOSES, formatEur, formatMonths, type Application } from './application';

const C = {
  bg: '#0a0a0a',
  card: '#141414',
  border: '#3a3120',
  gold: '#c9a24a',
  goldLight: '#e8c97a',
  text: '#f2ede3',
  muted: '#a8a197',
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Arial, Helvetica, sans-serif";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const sofiaTime = (d: Date) =>
  new Intl.DateTimeFormat('bg-BG', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Sofia' }).format(d);

function layout(title: string, inner: string) {
  return `<!doctype html>
<html lang="bg" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
    <tr><td align="center" style="padding:0 0 24px 0;font-family:${SERIF};font-size:24px;letter-spacing:3px;color:${C.gold};">
      ROYAL&nbsp;FINANCE
    </td></tr>
    <tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.border};border-top:3px solid ${C.gold};padding:32px 28px;">
      ${inner}
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0 8px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.muted};">
      ${esc(agentStatement)}
    </td></tr>
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
  <td style="padding:10px 12px 10px 0;border-bottom:1px solid ${C.border};font-family:${SANS};font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top;">${esc(k)}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${SANS};font-size:15px;color:${C.text};vertical-align:top;">${esc(v)}</td>
</tr>`,
    )
    .join('');
  const html = layout(
    subject,
    `<h1 style="margin:0 0 20px 0;font-family:${SERIF};font-size:22px;font-weight:normal;color:${C.goldLight};">Нова заявка за кредит</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${htmlRows}</table>
<p style="margin:20px 0 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">Отговорът на този имейл отива директно до кандидата.</p>`,
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
    `<h1 style="margin:0 0 16px 0;font-family:${SERIF};font-size:22px;font-weight:normal;color:${C.goldLight};">Благодарим Ви!</h1>
<p style="margin:0 0 16px 0;font-family:${SANS};font-size:15px;line-height:24px;color:${C.text};">Получихме кандидатурата Ви. Наш консултант ще се свърже с Вас скоро.</p>
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:22px;color:${C.muted};">Ако имате въпроси, обадете ни се на <a href="${site.phone.href}" style="color:${C.gold};text-decoration:none;">${esc(site.phone.display)}</a> (${esc(site.hours)}).</p>`,
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
