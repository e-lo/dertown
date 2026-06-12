import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Deployment health probe — reports which critical env vars are present
 * (booleans only, never values) at build-inline time vs. function runtime.
 * Used to diagnose SSR 500s caused by missing environment configuration.
 */
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      ok: true,
      buildInlined: {
        publicSupabaseUrl: Boolean(import.meta.env.PUBLIC_SUPABASE_URL),
        publicSupabaseKey: Boolean(import.meta.env.PUBLIC_SUPABASE_KEY),
        useLocalDb: import.meta.env.USE_LOCAL_DB === 'true',
      },
      runtime: {
        publicSupabaseUrl: Boolean(process.env.PUBLIC_SUPABASE_URL),
        publicSupabaseKey: Boolean(process.env.PUBLIC_SUPABASE_KEY),
        resendKey: Boolean(process.env.RESEND_API_KEY),
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
