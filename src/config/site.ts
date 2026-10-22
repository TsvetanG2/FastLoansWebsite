// Company details shown on the site and in emails.
// TODO: all values below are placeholders until the client supplies them.
export const site = {
  name: 'Royal Finance',
  legalName: 'TODO Роял Файненс ЕООД',
  eik: 'TODO',
  bnbRegistration: 'TODO',
  phone: { display: '+359 000 000 000', href: 'tel:+359000000000' },
  hours: 'Пон – Нед: 08:00 – 20:00',
  email: 'info@example.com',
} as const;

export const nav = [
  { label: 'Начало', href: '/#nachalo' },
  { label: 'За нас', href: '/#za-nas' },
  { label: 'Контакти', href: '/#kontakti' },
] as const;
