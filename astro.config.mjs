// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

const optionalSecret = () => envField.string({ context: 'server', access: 'secret', optional: true });

export default defineConfig({
  site: 'https://royalfinance.bg',
  output: 'static',
  // Earlier Bulgarian URLs → English slugs (301)
  redirects: {
    '/za-nas': '/about',
    '/poveritelnost': '/privacy',
    '/obshti-usloviya': '/terms',
    '/sporove': '/disputes',
  },
  // Functions run in fra1 (vercel.json) and may take at most 10 s
  adapter: vercel({ maxDuration: 10 }),
  vite: {
    // Never inline scripts (or fonts) into HTML: the CSP allows scripts only from 'self'
    // and fonts only from 'self', with no 'unsafe-inline' and no data: fonts.
    build: { assetsInlineLimit: 0 },
  },
  env: {
    schema: {
      // The only value the browser may see
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public' }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      EMAIL_FROM: envField.string({ context: 'server', access: 'secret' }),
      LEADS_EMAIL_TO: envField.string({ context: 'server', access: 'secret' }),
      // Rate limiting (Upstash Redis, eu-central-1). The Vercel Marketplace integration may
      // name them KV_REST_API_URL / KV_REST_API_TOKEN instead — both are accepted.
      UPSTASH_REDIS_REST_URL: optionalSecret(),
      UPSTASH_REDIS_REST_TOKEN: optionalSecret(),
      KV_REST_API_URL: optionalSecret(),
      KV_REST_API_TOKEN: optionalSecret(),
      RATE_LIMIT_SALT: optionalSecret(),
      // Extra allowed origins, comma-separated (e.g. the *.vercel.app URL before the domain is live)
      ALLOWED_ORIGINS: optionalSecret(),
    },
  },
});
