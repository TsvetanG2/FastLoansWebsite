import { describe, expect, it } from 'vitest';
import { applicationSchema, requestSchema, validate } from '../../src/lib/application';

const valid = {
  firstName: 'Иван',
  lastName: 'Петров-Иванов',
  phone: '0888 123 456',
  email: 'ivan@mail.bg',
  purpose: 'bills',
  currentAddress: 'ул. Шипка 10',
  idAddress: 'ул. Витоша 5',
  city: 'София',
  housing: 'rent',
  occupation: 'Счетоводител',
  amount: 1500,
  term: 12,
  consent: true,
};
const request = { ...valid, company_website: '', turnstileToken: 'token' };

const errorsFor = (input: Record<string, unknown>) => {
  const r = validate(input);
  return r.ok ? {} : r.errors;
};

describe('application schema', () => {
  it('accepts a valid application and normalises the phone', () => {
    const r = validate(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.phone).toBe('+359888123456');
  });

  it.each([
    ['firstName', 'И', 'Въведете името си.'],
    ['firstName', 'И'.repeat(41), 'Името може да е най-много 40 символа.'],
    ['firstName', 'Ivan3', 'Използвайте само букви, интервал или тире.'],
    ['lastName', '<script>', 'Използвайте само букви, интервал или тире.'],
    ['lastName', 'Петров--Иванов', 'Използвайте само букви, интервал или тире.'],
    ['phone', '12345', 'Въведете телефон след +359, например 888 123 456.'],
    ['phone', '+1 555 123 4567', 'Въведете телефон след +359, например 888 123 456.'],
    ['email', 'ivan@', 'Въведете валиден имейл, например ivan@mail.bg.'],
    ['email', `${'a'.repeat(250)}@b.bg`, 'Имейлът е твърде дълъг.'],
    ['purpose', 'x', 'Изберете причина за финансиране.'],
    ['currentAddress', '', 'Въведете настоящия си адрес.'],
    ['currentAddress', 'бл', 'Адресът е твърде кратък.'],
    ['idAddress', '  ', 'Въведете адреса си по лична карта.'],
    ['idAddress', 'а'.repeat(201), 'Адресът може да е най-много 200 символа.'],
    ['city', 'Атлантида', 'Изберете град от списъка.'],
    ['housing', '', 'Изберете къде живеете.'],
    ['occupation', 'x', 'Напишете какво работите.'],
    ['amount', 499, 'Сумата трябва да е поне 500 €.'],
    ['amount', 5001, 'Сумата може да е най-много 5 000 €.'],
    ['amount', 1525, 'Сумата трябва да е кратна на 50 €.'],
    ['term', 2, 'Срокът трябва да е поне 3 месеца.'],
    ['term', 61, 'Срокът може да е най-много 60 месеца.'],
    ['term', 12.5, 'Изберете срок в цели месеци.'],
    ['consent', false, 'Необходимо е да приемете Общите условия и Политиката за поверителност.'],
  ])('rejects %s = %j', (field, value, message) => {
    expect(errorsFor({ ...valid, [field]: value })[field as keyof typeof valid]).toBe(message);
  });

  it.each(['Младост 1, бл. 79', 'бл.4', 'с. Лозен', 'Изгрев', 'Шипка 10', 'кв. Изток 5'])('accepts address without "ул.": %s', (a) => {
    expect(validate({ ...valid, currentAddress: a, idAddress: a }).ok).toBe(true);
  });

  it('accepts Latin names and single hyphens/spaces', () => {
    expect(validate({ ...valid, firstName: 'Anna Maria', lastName: "D-Smith" }).ok).toBe(true);
  });

  it('collapses line breaks in text fields', () => {
    const r = applicationSchema.safeParse({ ...valid, currentAddress: 'ул. Шипка\r\n10' });
    expect(r.success && r.data.currentAddress).toBe('ул. Шипка 10');
  });
});

describe('request schema (strict)', () => {
  it('accepts the fields the form sends', () => {
    expect(requestSchema.safeParse(request).success).toBe(true);
  });

  it('rejects unknown keys', () => {
    const r = requestSchema.safeParse({ ...request, egn: '8001011234' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
  });

  it('requires the Turnstile token and caps its length', () => {
    const { turnstileToken: _, ...noToken } = request;
    expect(requestSchema.safeParse(noToken).success).toBe(false);
    expect(requestSchema.safeParse({ ...request, turnstileToken: 'x'.repeat(2049) }).success).toBe(false);
  });

  it('caps the honeypot length', () => {
    expect(requestSchema.safeParse({ ...request, company_website: 'x'.repeat(201) }).success).toBe(false);
  });
});
