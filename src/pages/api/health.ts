import type { APIRoute } from 'astro';
import { db } from '../../lib/supabase';

export const prerender = false;

/**
 * Deployment health probe. Runs the same query the events feed uses and reports
 * the runtime Node version + which critical env vars are present (booleans only,
 * never values). Use it to diagnose SSR 500s (missing env, Node/dependency
 * incompatibilities, etc.).
 */
export const GET: APIRoute = async () => {
  let eventsQuery: string;
  try {
    const { error } = await db.events.getAll();
    eventsQuery = error ? `supabase error: ${error.message} (${error.code ?? 'no code'})` : 'ok';
  } catch (e) {
    eventsQuery = `threw: ${(e as Error).message}`;
  }

  const present = (name: string) =>
    Boolean(
      (import.meta.env as Record<string, unknown>)[name] ||
        (typeof process !== 'undefined' ? process.env?.[name] : undefined)
    );

  return new Response(
    JSON.stringify(
      {
        ok: true,
        node: typeof process !== 'undefined' ? process.version : 'unknown',
        eventsQuery,
        env: {
          publicSupabaseUrl: present('PUBLIC_SUPABASE_URL'),
          publicSupabaseKey: present('PUBLIC_SUPABASE_KEY'),
          serviceRoleKey: present('SUPABASE_SERVICE_ROLE_KEY'),
        },
      },
      null,
      2
    ),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
