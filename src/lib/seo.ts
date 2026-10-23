// JSON-LD (schema.org) built from src/data/company.ts — never hardcode company data here.
// Missing data (photos, geo, profiles) is simply left out until the client supplies it.
import { company } from '../data/company';

export const SITE = 'https://www.royalfinance.bg'; // primary domain (apex redirects here)

/** Absolute, canonical URL: no trailing slash except for the home page. */
export function canonicalUrl(pathname: string): string {
  const clean = pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  return `${SITE}${clean || '/'}`;
}

/** The office as a FinancialService (a LocalBusiness subtype). No ratings or reviews markup. */
export function financialService() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    '@id': `${SITE}/#office`,
    name: company.brandName,
    legalName: company.legalName,
    url: `${SITE}/`,
    logo: `${SITE}/logo.svg`,
    image: `${SITE}/og.png`,
    telephone: company.phoneHref.replace('tel:', ''),
    email: company.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: company.office.streetAddress,
      addressLocality: company.office.locality,
      postalCode: company.office.postalCode,
      addressCountry: company.office.country,
    },
    ...(company.office.geo && {
      geo: { '@type': 'GeoCoordinates', latitude: company.office.geo.lat, longitude: company.office.geo.lon },
      hasMap: `https://www.google.com/maps/search/?api=1&query=${company.office.geo.lat},${company.office.geo.lon}`,
    }),
    openingHoursSpecification: company.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    areaServed: [
      { '@type': 'Place', name: `${company.office.district}, ${company.office.locality}` },
      { '@type': 'City', name: company.office.locality },
    ],
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Начало', path: '/' }, ...items].map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export function faqPage(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

/** Safe to embed in <script type="application/ld+json">: no "</script>" break-out. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
