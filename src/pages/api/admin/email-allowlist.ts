/**
 * /api/admin/email-allowlist
 * CRUD for the email_allowlist table. Super admin only.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

// GET /api/admin/email-allowlist
export const GET = withAdminAuth(async ({ auth }) => {
  if (!auth.isSuperAdmin) return jsonError('Forbidden', 403);

  const { data, error } = await supabaseAdmin
    .from('email_allowlist')
    .select('id, email, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[EMAIL-ALLOWLIST] GET error:', error);
    return jsonError('Failed to fetch allowlist');
  }

  return jsonResponse(data ?? []);
});

// POST /api/admin/email-allowlist
// Body: { email }
export const POST = withAdminAuth(async ({ request, auth }) => {
  if (!auth.isSuperAdmin) return jsonError('Forbidden', 403);

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';

  if (!email) return jsonError('email is required', 400);

  const { data, error } = await supabaseAdmin
    .from('email_allowlist')
    .upsert({ email }, { onConflict: 'email' })
    .select()
    .single();

  if (error) {
    console.error('[EMAIL-ALLOWLIST] POST error:', error);
    return jsonError('Failed to add email');
  }

  return jsonResponse(data, 201);
});

// DELETE /api/admin/email-allowlist?email=xxx
export const DELETE = withAdminAuth(async ({ url, auth }) => {
  if (!auth.isSuperAdmin) return jsonError('Forbidden', 403);

  const email = url.searchParams.get('email');
  if (!email) return jsonError('email query parameter is required', 400);

  const { error } = await supabaseAdmin
    .from('email_allowlist')
    .delete()
    .eq('email', email.toLowerCase());

  if (error) {
    console.error('[EMAIL-ALLOWLIST] DELETE error:', error);
    return jsonError('Failed to remove email');
  }

  return jsonResponse({ success: true });
});
