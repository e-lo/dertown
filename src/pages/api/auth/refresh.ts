import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

// Support local Supabase for testing
const useLocalDb = import.meta.env.USE_LOCAL_DB === 'true';

const supabaseUrl = useLocalDb ? 'http://127.0.0.1:54321' : import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = useLocalDb
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  : import.meta.env.PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required environment variables: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY'
  );
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const refreshToken =
      cookies.get('sb-refresh-token')?.value ||
      cookies.get('supabase-refresh-token')?.value ||
      cookies.get('sb-localhost-refresh-token')?.value;

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'No refresh token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      console.error('[REFRESH DEBUG] Failed to refresh session:', error?.message);
      return new Response(
        JSON.stringify({ error: error?.message || 'Failed to refresh session' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const isProduction =
      import.meta.env.PROD ||
      (typeof request.headers.get('x-forwarded-proto') === 'string' &&
        request.headers.get('x-forwarded-proto') === 'https');

    cookies.set('sb-access-token', data.session.access_token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: data.session.expires_in || 3600,
      secure: isProduction,
    });

    if (data.session.refresh_token) {
      cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days (persist login)
        secure: isProduction,
      });
    }

    return new Response(JSON.stringify({ message: 'Session refreshed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[REFRESH DEBUG] Error refreshing session:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
