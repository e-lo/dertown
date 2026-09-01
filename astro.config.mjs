// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';
import sentry from '@sentry/astro';

// https://astro.build/config
export default defineConfig({
  // Canonical origin, matching the SITE env var the feeds already use. Pages are
  // now CDN-cached and served to many visitors, so absolute URLs in the HTML
  // (og:image, canonical) must not be derived from whichever request happened to
  // populate the cache.
  site: process.env.SITE || 'https://dertown.org',
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