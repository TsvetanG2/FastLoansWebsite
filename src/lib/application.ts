// Application schema shared by the browser form and /api/apply.
import * as z from 'zod/mini';

// TODO: confirm amount range with client
export const AMOUNT = { min: 500, max: 5000, step: 50, initial: 1500 } as const;
export const TERM = { min: 3, max: 60, step: 1, initial: 12 } as const;

const PHONE_RE = /^(?:\+359|00359|0)[2-9]\d{7,8}$/;

export const normalizePhone = (v: string) => v.replace(/[\s\-().]/g, '');

/** 5000 -> "5 000 €" (non-breaking spaces, Bulgarian style) */
export function formatEur(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

/** 12 -> "12 месеца"; 1 -> "1 месец" */
export function formatMonths(n: number) {
  return `${n} ${n === 1 ? 'месец' : 'месеца'}`;
}

export const applicationSchema = z.object({
  amount: z.coerce.number().check(
    z.gte(AMOUNT.min, `Сумата трябва да е поне ${formatEur(AMOUNT.min)}.`),
    z.lte(AMOUNT.max, `Сумата може да е най-много ${formatEur(AMOUNT.max)}.`),
    z.multipleOf(AMOUNT.step, `Сумата трябва да е кратна на ${AMOUNT.step} €.`),
  ),
  term: z.coerce.number().check(
    z.int('Избери срок в цели месеци.'),
    z.gte(TERM.min, `Срокът трябва да е поне ${TERM.min} месеца.`),
    z.lte(TERM.max, `Срокът може да е най-много ${TERM.max} месеца.`),
  ),
  name: z.string().check(
    z.trim(),
    z.minLength(2, 'Въведи име и фамилия.'),
    z.maxLength(80, 'Името може да е най-много 80 символа.'),
  ),
  phone: z.string().check(
    z.overwrite(normalizePhone),
    z.regex(PHONE_RE, 'Въведи български телефон, например 0888 123 456 или +359 888 123 456.'),
  ),
  email: z.string().check(
    z.trim(),
    z.maxLength(254, 'Имейлът е твърде дълъг.'),
    z.email('Въведи валиден имейл, например ivan@mail.bg.'),
  ),
  consent: z.literal(true, 'Нужно е съгласието ти, за да обработим заявката.'),
});

export type Application = z.infer<typeof applicationSchema>;
export type Field = keyof Application;
export type FieldErrors = Partial<Record<Field, string>>;

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
