import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';

export const prerender = false;

/**
 * Deployment health probe — reports which critical env vars are present
 * (booleans only, never values) at build-inline time vs. function runtime.
 * Used to diagnose SSR 500s caused by missing environment configuration.
 */
export const GET: APIRoute = async () => {
  // Execute the same query the events feed uses and surface its error (if any)
  let eventsQuery: string;
  try {
    const { error } = await db.events.getAll();
    eventsQuery = error ? `supabase error: ${error.message} (${error.code ?? 'no code'})` : 'ok';
  } catch (e) {
    eventsQuery = `threw: ${(e as Error).message}`;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      eventsQuery,
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
