// Single source of company data for the legal pages, footer, contact block and emails.
// Never hardcode these values in pages. Missing values stay as visible "[TODO: …]"
// and are listed in LEGAL_TODO.md.
export const company = {
  legalName: '„Глобъл Профинанс“ ЕООД',
  legalNameLatin: 'GLOBAL PROFINANCE EOOD',
  brandName: 'Royal Finance',
  eik: '208274496',
  registeredAddress: 'гр. София 1000, р-н Младост, ж.к. Младост 1, бл. 79, вх. 2, ет. 1',
  correspondenceAddress: 'гр. София 1000, р-н Младост, ж.к. Младост 1, бл. 79, вх. 2, ет. 1', // TODO: потвърди дали е същият
  /** Search text for the maps link (block number + district geocode better than the full legal address). */
  officeMapQuery: 'ж.к. Младост 1, бл. 79, София, България',
  phone: '+359 888 807 152',
  phoneHref: 'tel:+359888807152',
  workingHours: 'Понеделник – петък: 10:00 – 19:00 ч.; събота: 10:00 – 16:00 ч.; неделя: почивен ден',
  holidayHours: 'В официалните празници – намалено работно време', // TODO: конкретните часове
  email: 'royalfinance@abv.bg',
  complaintsEmail: 'royalfinance@abv.bg',
  privacyEmail: 'royalfinance@abv.bg',
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
