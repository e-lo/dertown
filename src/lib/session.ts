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
    return { role: null, organizationIds: [], error: error || 'No session found' };
  }

  const userEmail = session.user?.email || '';
  const SUPER_ADMIN_EMAILS = ['dertown@gmail.com']; // Update as needed

  // Check if super admin
  if (SUPER_ADMIN_EMAILS.includes(userEmail)) {
    return { role: 'super_admin', organizationIds: [], error: null };
  }

  // Check if org editor (has org_users entries)
  const { data: orgUsers, error: orgError } = await supabase
    .from('org_users')
    .select('organization_id')
    .eq('user_id', session.user.id);

  if (orgError) {
    console.error('[SESSION DEBUG] Error fetching org_users:', orgError);
    return { role: null, organizationIds: [], error: orgError.message };
  }

  if (orgUsers && orgUsers.length > 0) {
    const organizationIds = orgUsers.map((ou) => ou.organization_id);
    return { role: 'org_editor', organizationIds, error: null };
  }

  // Not super admin or org editor
  return { role: null, organizationIds: [], error: 'User does not have admin access' };
}
