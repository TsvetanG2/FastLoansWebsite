// Single source of company data for the legal pages, footer, contact block, emails and JSON-LD.
// Never hardcode these values in pages. Missing values are left out of the site (no visible TODO)
// and are listed in LEGAL_TODO.md / SEO_TODO.md.
export const company = {
  legalName: '„Глобъл Профинанс“ ЕООД',
  legalNameLatin: 'GLOBAL PROFINANCE EOOD',
  brandName: 'Royal Finance',
  eik: '208274496',
  /** Seat and management address (legal pages). Same as the office — client, 2026-10-23. */
  registeredAddress: 'гр. София 1784, ж.к. Младост 1, бул. „Андрей Сахаров“ № 11',
  /** The customer office: everything customer-facing (contacts, /location, footer, map, NAP, JSON-LD). */
  officeAddress: 'бул. „Андрей Сахаров“ № 11, ж.к. Младост 1, 1784 София',
  /** Letters and complaints go to the office. */
  correspondenceAddress: 'бул. „Андрей Сахаров“ № 11, ж.к. Младост 1, 1784 София',
  /** Search text for the maps link when coordinates are missing. */
  officeMapQuery: 'бул. Андрей Сахаров 11, София, България',
  /** Structured office address (NAP + JSON-LD). */
  office: {
    streetAddress: 'бул. „Андрей Сахаров“ № 11',
    district: 'Младост 1',
    locality: 'София',
    postalCode: '1784',
    country: 'BG',
    /**
     * Exact office position (decimal degrees). Drives the JSON-LD `geo` and the map on /location.
     * After changing it run: node scripts/make-office-map.mjs <lat> <lon>
     * null = not known yet → no map and no geo (nothing is shown instead of a wrong pin).
     */
    // OpenStreetMap: commercial building бул. Андрей Сахаров 11 (2026-10-23) — client to confirm the pin
    geo: { lat: 42.6524536, lon: 23.3728051 } as { lat: number; lon: number } | null,
  },
  phone: '+359 888 807 152',
  phoneHref: 'tel:+359888807152',
  workingHours: 'Понеделник – петък: 10:00 – 19:00 ч.; събота: 10:00 – 16:00 ч.; неделя: почивен ден',
  /** Same hours as `workingHours`, structured for JSON-LD (schema.org openingHoursSpecification). */
  openingHours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '19:00' },
    { days: ['Saturday'], opens: '10:00', closes: '16:00' },
  ],
  holidayHours: 'В официалните празници – намалено работно време', // TODO: конкретните часове
  // Public address on the domain; Resend forwards it to the office mailbox (/api/inbound,
  // INBOUND_FORWARD_TO in Vercel). Client decision 2026-10-24.
  email: 'finance@royalfinance.bg',
  complaintsEmail: 'finance@royalfinance.bg',
  privacyEmail: 'finance@royalfinance.bg',
  dpo: null as { name: string; email: string } | null, // нямат ДЗЛД — в политиката се посочва само privacyEmail
  role: 'agent', // „Глобъл Профинанс“ е агент; кредитите се отпускат от кредитора (lender)
  retention: {
    rejectedApplication: '2 години от подаването на заявката',
    complaints: '2 години от приключване на жалбата',
  },
  complaintResponseDays: 30, // TODO: юристът да потвърди
  effectiveDate: '23.10.2026',
};

// Кредиторът — регистрираната финансова институция, от чието име се сключват договорите
export const lender = {
  legalName: '„Тием Финанси“ ООД',
  eik: '202786529',
  registeredAddress: 'гр. Перник 2300, ул. „Кракра“, бл. 39, ет. 1, офис 5',
  correspondenceAddress: 'гр. Перник 2300, ул. „Кракра“, бл. 39, ет. 1, офис 5',
  // Контактите на кредитора са по желание: ако липсват, не показвай ред с TODO на сайта,
  // а насочвай клиента към агента (company) и към адреса на кредитора.
  phone: null as string | null,
  email: null as string | null,
  complaintsEmail: null as string | null,
  privacyEmail: null as string | null,
  bnb: {
    regNumber: 'BGR00464',
    decision: 'БНБ-119213/10.11.2022',
    regDate: '10.11.2022',
    activity: 'Отпускане на кредити със средства, които не са набрани чрез публично привличане на влогове или други възстановими средства; финансов лизинг; придобиване на вземания по кредити (факторинг, форфетинг и др.)',
  },
  website: '[TODO: сайт на кредитора, ако има]',
};

/** Agent disclosure: under the form, in the footer and in emails. */
export const agentStatement =
  `${company.brandName} е търговска марка на ${company.legalName}, която действа като агент на ` +
  `${lender.legalName}, ЕИК ${lender.eik}, вписано в регистъра на финансовите институции към БНБ под № ${lender.bnb.regNumber}.`;

/** Public BNB register of financial institutions under art. 3a of the Credit Institutions Act. */
export const BNB_REGISTER_URL = 'https://www.bnb.bg/RegistersAndServices/RSFinancialInstitutionsRegisters/index.htm';

/** Legal pages, in footer order. */
export const legalLinks = [
  { label: 'Политика за поверителност', href: '/privacy' },
  { label: 'Общи условия', href: '/terms' },
  { label: 'Решаване на спорове', href: '/disputes' },
  { label: 'Информация за кредитора', href: '/about' },
] as const;
