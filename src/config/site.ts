// Presentation-level view of the company data for the landing page, header and emails.
// The data itself lives in src/data/company.ts — change it there.
import { company } from '../data/company';

export const site = {
  name: company.brandName,
  legalName: company.legalName,
  eik: company.eik,
  phone: { display: company.phone, href: company.phoneHref },
  /** Short form for the header and emails; the full text is company.workingHours. */
  hours: 'Пон – Пет: 10:00 – 19:00, Съб: 10:00 – 16:00',
  email: company.email,
} as const;

/** Header menu: the sections of the home page. */
export const nav = [
  { label: 'Начало', href: '/' },
  { label: 'Защо ние', href: '/#about' },
  { label: 'Контакти', href: '/#contact' },
] as const;

/** Footer navigation: the menu plus the content pages. */
export const footerNav = [
  ...nav,
  { label: 'Локация', href: '/location' },
  { label: 'Въпроси', href: '/faq' },
] as const;
