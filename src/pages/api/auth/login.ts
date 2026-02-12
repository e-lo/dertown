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
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      console.error('[LOGIN DEBUG] Authentication failed:', error?.message);
      return new Response(JSON.stringify({ error: error?.message || 'Login failed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // All authenticated users are considered admins

    // Create response with session cookies using Astro's cookie handling
    const response = new Response(
      JSON.stringify({
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    // Set session cookies using Astro's cookies object
    // Determine if we're in production (HTTPS) based on environment
    const isProduction =
      import.meta.env.PROD ||
      (typeof request.headers.get('x-forwarded-proto') === 'string' &&
        request.headers.get('x-forwarded-proto') === 'https');

    if (data.session.access_token) {
      cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: data.session.expires_in || 3600,
        secure: isProduction, // true in production (HTTPS), false in local dev
      });
    }

    if (data.session.refresh_token) {
      cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days (persist login)
        secure: isProduction, // true in production (HTTPS), false in local dev
      });
    }
    return response;
  } catch (error) {
    console.error('[LOGIN DEBUG] Login error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
