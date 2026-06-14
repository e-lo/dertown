// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import solid from '@astrojs/solid-js';
import netlify from '@astrojs/netlify';
import sentry from '@sentry/astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [
    tailwind(),
    solid(),
    // Error tracking. DSN + runtime init live in sentry.{client,server}.config.js.
    // No-ops when PUBLIC_SENTRY_DSN is unset, so it's safe before the env var is added.
    sentry(),
  ],

});