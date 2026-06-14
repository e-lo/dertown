import * as Sentry from '@sentry/astro';

// SSR-side Sentry. Reads PUBLIC_SENTRY_DSN build-inlined or from runtime env
// (process.env) — the same lesson as supabase.ts: don't rely on build-inlining
// alone. Skipped when unset.
const dsn =
  import.meta.env.PUBLIC_SENTRY_DSN ||
  (typeof process !== 'undefined' ? process.env?.PUBLIC_SENTRY_DSN : undefined);

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
