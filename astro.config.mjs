// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // TODO: replace with the production domain once the client confirms it
  site: 'https://example.com',
  output: 'static',
  adapter: vercel(),
  env: {
    schema: {
      TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public' }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      EMAIL_FROM: envField.string({ context: 'server', access: 'secret' }),
      LEADS_EMAIL_TO: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
