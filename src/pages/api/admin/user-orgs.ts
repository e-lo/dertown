/**
 * /api/admin/user-orgs
 *
 * Manages org assignments for a specific user (by user_id).
 * Works with both org_users (registered users) and allowlisted_org_emails
 * (future signups) so access is consistent regardless of when they registered.
 *
 * Super admin only.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

// GET /api/admin/user-orgs?user_id=xxx
// Returns org memberships for a given user.
export const GET = withAdminAuth(async ({ url, auth }) => {
  if (!auth.isSuperAdmin) return jsonError('Forbidden', 403);

  const user_id = url.searchParams.get('user_id');
  if (!user_id) return jsonError('user_id is required', 400);

  const { data, error } = await supabaseAdmin
    .from('org_users')
    .select('organization_id, organizations!org_users_organization_id_fkey(id, name)')
    .eq('user_id', user_id);

  if (error) {
    console.error('[USER-ORGS] GET error:', error);
    return jsonError('Failed to fetch org assignments');
  }

  const orgs = (data ?? []).map((row) => {
    const org = row.organizations as { id: string; name: string } | null;
    return { id: org?.id ?? row.organization_id, name: org?.name ?? '' };
  });

  return jsonResponse(orgs);
});

// POST /api/admin/user-orgs
// Assign a user to an organization.
// Body: { user_id, organization_id }
export const POST = withAdminAuth(async ({ request, auth }) => {
  if (!auth.isSuperAdmin) return jsonError('Forbidden', 403);

  const body = await request.json().catch(() => ({}));
  const { user_id, organization_id } = body;

  if (!user_id || !organization_id) {
    return jsonError('user_id and organization_id are required', 400);
  }

  // Look up the user's email for the allowlist
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
  if (authErr || !authUser?.user) {
    return jsonError('User not found', 404);
  }
  const email = authUser.user.email ?? '';

  // Insert into org_users (upsert so duplicate is harmless)
  const { error: orgUserErr } = await supabaseAdmin
    .from('org_users')
    .upsert({ user_id, organization_id, created_by: 'admin' }, { onConflict: 'user_id,organization_id' });

  if (orgUserErr) {
    console.error('[USER-ORGS] POST org_users error:', orgUserErr);
    return jsonError('Failed to assign org');
  }

  // Also upsert allowlisted_org_emails so access persists if they re-register
  if (email) {
    await supabaseAdmin
      .from('allowlisted_org_emails')
      .upsert(
        {
          email: email.toLowerCase(),
          organization_id,
          created_by: auth.userId,
        },
        { onConflict: 'email,organization_id' }
      );
  }

  return jsonResponse({ success: true }, 201);
});

// DELETE /api/admin/user-orgs?user_id=xxx&organization_id=yyy
// Remove a user from an organization.
export const DELETE = withAdminAuth(async ({ url, auth }) => {
  if (!auth.isSuperAdmin) return jsonError('Forbidden', 403);

  const user_id = url.searchParams.get('user_id');
  const organization_id = url.searchParams.get('organization_id');

  if (!user_id || !organization_id) {
    return jsonError('user_id and organization_id are required', 400);
  }

  // Remove from org_users
  const { error: ouErr } = await supabaseAdmin
    .from('org_users')
    .delete()
    .eq('user_id', user_id)
    .eq('organization_id', organization_id);

  if (ouErr) {
    console.error('[USER-ORGS] DELETE org_users error:', ouErr);
    return jsonError('Failed to remove org assignment');
  }

  // Also remove from allowlisted_org_emails if user's email is there
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
  const email = authUser?.user?.email;
  if (email) {
    await supabaseAdmin
      .from('allowlisted_org_emails')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('organization_id', organization_id);
  }

  return jsonResponse({ success: true });
});
