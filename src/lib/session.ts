import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

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

export async function getSessionFromCookies(cookies: any) {
  // Try different cookie name patterns that Supabase might use
  const accessToken =
    cookies.get('sb-access-token')?.value ||
    cookies.get('supabase-auth-token')?.value ||
    cookies.get('sb-localhost-auth-token')?.value;

  const refreshToken =
    cookies.get('sb-refresh-token')?.value ||
    cookies.get('supabase-refresh-token')?.value ||
    cookies.get('sb-localhost-refresh-token')?.value;

  if (!accessToken || !refreshToken) {
    return { session: null, error: 'No session cookies found' };
  }

  // Create Supabase client
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

  // Set the session manually (will refresh if needed)
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    console.error('[SESSION DEBUG] Error setting session:', error);
    return { session: null, error: error.message };
  }

  if (data.session) {
    const isProduction = import.meta.env.PROD;
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
        maxAge: 60 * 60 * 24 * 30, // 30 days for refresh token (persist login)
        secure: isProduction,
      });
    }
  }

  return { session: data.session, error: null };
}

export async function checkAdminAccess(cookies: any) {
  const { session, error } = await getSessionFromCookies(cookies);

  if (error || !session) {
    return { isAdmin: false, error: error || 'No session found' };
  }

  // All authenticated users are considered admins
  return { isAdmin: true, error: null };
}
