import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';
import { ACCESS_TOKEN_DEFAULT_TTL, REFRESH_TOKEN_TTL } from '@/lib/constants';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const refreshToken =
      cookies.get('sb-refresh-token')?.value ||
      cookies.get('supabase-refresh-token')?.value ||
      cookies.get('sb-localhost-refresh-token')?.value;

    if (!refreshToken) {
      return jsonError('No refresh token', 401);
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      console.error('[REFRESH DEBUG] Failed to refresh session:', error?.message);
      return jsonError(error?.message || 'Failed to refresh session', 401);
    }

    const isProduction =
      import.meta.env.PROD ||
      (typeof request.headers.get('x-forwarded-proto') === 'string' &&
        request.headers.get('x-forwarded-proto') === 'https');

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
        maxAge: REFRESH_TOKEN_TTL, // 30 days (persist login)
        secure: isProduction,
      });
    }

    return jsonResponse({ message: 'Session refreshed' });
  } catch (error) {
    console.error('[REFRESH DEBUG] Error refreshing session:', error);
    return jsonError('Internal server error');
  }
};
