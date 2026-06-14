import * as Sentry from '@sentry/astro';

// Browser-side Sentry. Reads the (public, non-secret) DSN from PUBLIC_SENTRY_DSN.
// When unset, init is skipped so nothing is sent and nothing breaks.
const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Performance sampling — keep modest for the free tier.
    tracesSampleRate: 0.1,
    // Session Replay off by default (enable later if you want it).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
