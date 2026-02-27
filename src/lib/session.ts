import { supabase } from './supabase';
import { ACCESS_TOKEN_DEFAULT_TTL, REFRESH_TOKEN_TTL } from './constants';

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
      maxAge: data.session.expires_in || ACCESS_TOKEN_DEFAULT_TTL,
      secure: isProduction,
    });

    if (data.session.refresh_token) {
      cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_TTL, // 30 days for refresh token (persist login)
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
