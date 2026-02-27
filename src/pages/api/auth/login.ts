import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';
import { ACCESS_TOKEN_DEFAULT_TTL, REFRESH_TOKEN_TTL } from '@/lib/constants';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return jsonError('Email and password are required', 400);
    }

    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      console.error('[LOGIN DEBUG] Authentication failed:', error?.message);
      return jsonError(error?.message || 'Login failed', 401);
    }

    // All authenticated users are considered admins

    // Create response with session cookies using Astro's cookie handling
    const response = jsonResponse({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });

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
        maxAge: data.session.expires_in || ACCESS_TOKEN_DEFAULT_TTL,
        secure: isProduction, // true in production (HTTPS), false in local dev
      });
    }

    if (data.session.refresh_token) {
      cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_TTL, // 30 days (persist login)
        secure: isProduction, // true in production (HTTPS), false in local dev
      });
    }
    return response;
  } catch (error) {
    console.error('[LOGIN DEBUG] Login error:', error);
    return jsonError('Internal server error');
  }
};
