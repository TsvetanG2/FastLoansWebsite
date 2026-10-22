// Application schema shared by the browser form and /api/apply.
import * as z from 'zod/mini';
import { CITIES } from './cities';

// TODO: confirm amount range with client
export const AMOUNT = { min: 500, max: 5000, step: 50, initial: 1500 } as const;
export const TERM = { min: 3, max: 60, step: 1, initial: 12 } as const;

export const PURPOSES = {
  purchase: 'Покупка на вещи',
  bills: 'Плащане на сметки',
  refinance: 'Рефинансиране на други задължения',
  other: 'Друго',
} as const;

export const HOUSING = {
  own: 'Да',
  relatives: 'При роднини',
  rent: 'Под наем',
  other: 'Друго',
} as const;

const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const PHONE_RE = /^\+359[2-9]\d{7,8}$/;

/** The form shows a fixed "+359" prefix; accept "888…", "0888…", "+359…" or "00359…" and return "+359…". */
export function normalizePhone(v: string) {
  const d = v.replace(/[\s\-().]/g, '');
  if (d.startsWith('+359')) return d;
  if (d.startsWith('00359')) return `+${d.slice(2)}`;
  return `+359${d.replace(/^0/, '')}`;
}
/** Collapse whitespace and line breaks; keeps email headers and lead rows on one line. */
const oneLine = (v: string) => v.replace(/\s+/g, ' ').trim();

/** 5000 -> "5 000 €" (non-breaking spaces, Bulgarian style) */
export function formatEur(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

/** 12 -> "12 месеца"; 1 -> "1 месец" */
export function formatMonths(n: number) {
  return `${n} ${n === 1 ? 'месец' : 'месеца'}`;
}

const text = (min: number, max: number, required: string, tooLong: string) =>
  z.string().check(z.overwrite(oneLine), z.minLength(min, required), z.maxLength(max, tooLong));

/**
 * Free-form address: street, ж.к., квартал, village… — no fixed format ("ул." is not required).
 * Empty → "Въведете…"; 1–2 characters → too short.
 */
const address = (required: string) =>
  z.string().check(
    z.overwrite(oneLine),
    z.minLength(1, required),
    z.minLength(3, 'Адресът е твърде кратък.'),
    z.maxLength(200, 'Адресът може да е най-много 200 символа.'),
  );

/** Letters (Cyrillic or Latin) in words joined by single spaces or hyphens. */
const NAME_RE = /^[\p{Script=Cyrillic}\p{Script=Latin}]+(?:[ -][\p{Script=Cyrillic}\p{Script=Latin}]+)*$/u;
const NAME_CHARS = 'Използвайте само букви, интервал или тире.';
const name = (required: string, tooLong: string) =>
  z.string().check(z.overwrite(oneLine), z.minLength(2, required), z.maxLength(40, tooLong), z.regex(NAME_RE, NAME_CHARS));

export const applicationSchema = z.object({
  firstName: name('Въведете името си.', 'Името може да е най-много 40 символа.'),
  lastName: name('Въведете фамилията си.', 'Фамилията може да е най-много 40 символа.'),
  phone: z.string().check(
    z.overwrite(normalizePhone),
    z.regex(PHONE_RE, 'Въведете телефон след +359, например 888 123 456.'),
  ),
  email: z.string().check(
    z.trim(),
    z.maxLength(254, 'Имейлът е твърде дълъг.'),
    z.email('Въведете валиден имейл, например ivan@mail.bg.'),
  ),
  purpose: z.enum(keys(PURPOSES), 'Изберете причина за финансиране.'),
  currentAddress: address('Въведете настоящия си адрес.'),
  idAddress: address('Въведете адреса си по лична карта.'),
  housing: z.enum(keys(HOUSING), 'Изберете къде живеете.'),
  occupation: text(2, 100, 'Напишете какво работите.', 'Текстът може да е най-много 100 символа.'),
  amount: z.coerce.number().check(
    z.gte(AMOUNT.min, `Сумата трябва да е поне ${formatEur(AMOUNT.min)}.`),
    z.lte(AMOUNT.max, `Сумата може да е най-много ${formatEur(AMOUNT.max)}.`),
    z.multipleOf(AMOUNT.step, `Сумата трябва да е кратна на ${AMOUNT.step} €.`),
  ),
  term: z.coerce.number().check(
    z.int('Изберете срок в цели месеци.'),
    z.gte(TERM.min, `Срокът трябва да е поне ${TERM.min} месеца.`),
    z.lte(TERM.max, `Срокът може да е най-много ${TERM.max} месеца.`),
  ),
  city: z.enum(CITIES, 'Изберете град от списъка.'),
  consent: z.literal(true, 'Необходимо е да приемете Общите условия и Политиката за поверителност.'),
});

/**
 * Everything the browser may send to /api/apply. Strict: any unknown key rejects the request.
 * `company_website` is the honeypot, `turnstileToken` the Turnstile response (≤ 2048 chars per Cloudflare).
 */
export const requestSchema = z.strictObject({
  ...applicationSchema.shape,
  company_website: z.optional(z.string().check(z.maxLength(200))),
  turnstileToken: z.string().check(z.maxLength(2048)),
});

export type Application = z.infer<typeof applicationSchema>;
export type Field = keyof Application;
export type FieldErrors = Partial<Record<Field, string>>;

/** Fields shown on each step of the form, in order. */
export const STEPS: Field[][] = [
  ['firstName', 'lastName', 'phone', 'email'],
  ['purpose', 'currentAddress', 'idAddress', 'city', 'housing', 'occupation'],
  ['amount', 'term', 'consent'],
];
export const FIELDS: Field[] = STEPS.flat();

export function validate(input: Record<string, unknown>):
  | { ok: true; data: Application }
  | { ok: false; errors: FieldErrors } {
  const r = applicationSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path[0] as Field;
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
