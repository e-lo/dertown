// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';
import sentry from '@sentry/astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [
    // Error tracking. DSN + runtime init live in sentry.{client,server}.config.js.
    // No-ops when PUBLIC_SENTRY_DSN is unset.
    sentry(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});