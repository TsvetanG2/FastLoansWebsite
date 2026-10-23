import { describe, expect, it } from 'vitest';
import { validate, type Application } from '../../src/lib/application';
import { confirmationEmail, leadEmail } from '../../src/lib/emails';

const app = (over: Partial<Record<string, unknown>> = {}): Application => {
  const r = validate({
    firstName: 'Иван',
    lastName: 'Петров',
    phone: '0888123456',
    email: 'ivan@mail.bg',
    purpose: 'bills',
    currentAddress: '<b>ул. Шипка</b> 10 & "ап. 3"',
    idAddress: 'ул. Витоша 5',
    city: 'София',
    housing: 'rent',
    occupation: 'Шофьор',
    amount: 1500,
    term: 12,
    consent: true,
    ...over,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.data;
};

describe('lead email', () => {
  it('has the agreed subject', () => {
    expect(leadEmail(app(), new Date()).subject).toBe('Нова заявка: 1 500 € / 12 мес. — Иван Петров');
  });
  it('cuts the name in the subject to 40 characters, single line', () => {
    const { subject } = leadEmail(app({ firstName: 'А'.repeat(40), lastName: 'Б'.repeat(40) }), new Date());
    const name = subject.split(' — ')[1];
    expect(name).toHaveLength(40);
    expect(subject).not.toMatch(/[\r\n]/);
  });
  it('escapes user values in HTML', () => {
    const { html, text } = leadEmail(app(), new Date());
    expect(html).toContain('&lt;b&gt;ул. Шипка&lt;/b&gt; 10 &amp; &quot;ап. 3&quot;');
    expect(html).not.toContain('<b>ул. Шипка</b>');
    expect(text).toContain('<b>ул. Шипка</b>'); // plain text needs no escaping
  });
});

describe('confirmation email', () => {
  it('is fixed text: nothing the applicant typed can appear in it', () => {
    const a = confirmationEmail();
    const b = confirmationEmail();
    expect(a).toEqual(b); // takes no input at all
    expect(a.text).toContain('Получихме кандидатурата Ви. Наш консултант ще се свърже с Вас скоро.');
    expect((a.html + a.text + a.subject).toLowerCase()).not.toMatch(/одобрен|приет/);
  });
});
