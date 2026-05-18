import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

// GET /api/admin/users
// Returns all users with permissions, enriched with email and org memberships.
// Super admin only.
export const GET = withAdminAuth(async ({ auth }) => {
  if (!auth.isSuperAdmin) {
    return jsonError('Forbidden: only super admins can manage users', 403);
  }

  // 1. Fetch all user_permissions rows
  const { data: perms, error: permsError } = await supabaseAdmin
    .from('user_permissions')
    .select('id, user_id, is_admin, org_access_enabled, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (permsError) {
    console.error('[ADMIN USERS] Fetch permissions error:', permsError);
    return jsonError('Failed to fetch user permissions');
  }

  if (!perms || perms.length === 0) {
    return jsonResponse([]);
  }

  // 2. Fetch auth user records to get emails
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (authError) {
    console.error('[ADMIN USERS] Fetch auth users error:', authError);
    return jsonError('Failed to fetch user emails');
  }

  const emailByUserId = new Map<string, string>();
  for (const u of authData?.users ?? []) {
    emailByUserId.set(u.id, u.email ?? '');
  }

  // 3. Fetch org memberships for users who have org_access_enabled
  const orgAccessUserIds = perms
    .filter((p) => p.org_access_enabled)
    .map((p) => p.user_id);

  let orgsByUserId = new Map<string, { id: string; name: string }[]>();

  if (orgAccessUserIds.length > 0) {
    const { data: orgUsers, error: orgUsersError } = await supabaseAdmin
      .from('org_users')
      .select('user_id, organization_id, organizations!org_users_organization_id_fkey(id, name)')
      .in('user_id', orgAccessUserIds);

    if (orgUsersError) {
      console.error('[ADMIN USERS] Fetch org users error:', orgUsersError);
      // Non-fatal — continue without org data
    } else {
      for (const row of orgUsers ?? []) {
        const org = row.organizations as { id: string; name: string } | null;
        if (!org) continue;
        const list = orgsByUserId.get(row.user_id) ?? [];
        list.push({ id: org.id, name: org.name });
        orgsByUserId.set(row.user_id, list);
      }
    }
  }

  // 4. Join everything together
  const users = perms.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    email: emailByUserId.get(p.user_id) ?? null,
    is_admin: p.is_admin,
    org_access_enabled: p.org_access_enabled,
    organizations: orgsByUserId.get(p.user_id) ?? [],
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  return jsonResponse(users);
});

// POST /api/admin/users
// Grant permissions to a user by email. Creates the user_permissions row.
// Body: { email, is_admin?, org_access_enabled? }
export const POST = withAdminAuth(async ({ request, auth }) => {
  if (!auth.isSuperAdmin) {
    return jsonError('Forbidden: only super admins can manage users', 403);
  }

  const body = await request.json().catch(() => ({}));
  const { email, is_admin = false, org_access_enabled = false } = body;

  if (!email || typeof email !== 'string') {
    return jsonError('email is required', 400);
  }

  // Look up user by email in auth.users
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (authError) {
    console.error('[ADMIN USERS] Lookup error:', authError);
    return jsonError('Failed to look up user');
  }

  let authUser = authData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
  );

  let invited = false;
  if (!authUser) {
    // User hasn't signed up yet — send an invite so they can set up their account.
    // This creates the auth user immediately and emails them a magic link.
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim()
    );
    if (inviteError) {
      console.error('[ADMIN USERS] Invite error:', inviteError);
      return jsonError(`Could not invite "${email}": ${inviteError.message}`);
    }
    authUser = inviteData.user;
    invited = true;
  }

  // Upsert user_permissions
  const { data, error } = await supabaseAdmin
    .from('user_permissions')
    .upsert(
      { user_id: authUser.id, is_admin, org_access_enabled },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[ADMIN USERS] Upsert error:', error);
    return jsonError('Failed to save user permissions');
  }

  // Always add to email_allowlist so they can use the self-service register page
  // if needed (e.g. invite link expires). Ignore conflicts — idempotent.
  await supabaseAdmin
    .from('email_allowlist')
    .upsert({ email: authUser.email!.toLowerCase() }, { onConflict: 'email' });

  return jsonResponse({ ...data, email: authUser.email, invited }, 201);
});

// PUT /api/admin/users
// Update an existing user's permissions.
// Body: { user_id, is_admin?, org_access_enabled? }
export const PUT = withAdminAuth(async ({ request, auth }) => {
  if (!auth.isSuperAdmin) {
    return jsonError('Forbidden: only super admins can manage users', 403);
  }

  const body = await request.json().catch(() => ({}));
  const { user_id, is_admin, org_access_enabled } = body;

  if (!user_id) {
    return jsonError('user_id is required', 400);
  }

  // Guard: never strip admin from the primary super admin account
  if (is_admin === false) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (authUser?.user?.email === 'dertownleavenworth@gmail.com') {
      return jsonError('Cannot revoke admin access from the primary admin account', 403);
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (is_admin !== undefined) updates.is_admin = is_admin;
  if (org_access_enabled !== undefined) updates.org_access_enabled = org_access_enabled;

  const { data, error } = await supabaseAdmin
    .from('user_permissions')
    .update(updates)
    .eq('user_id', user_id)
    .select()
    .single();

  if (error) {
    console.error('[ADMIN USERS] Update error:', error);
    return jsonError('Failed to update user permissions');
  }

  return jsonResponse(data);
});

// DELETE /api/admin/users?user_id=xxx
// Remove a user's permissions entirely.
export const DELETE = withAdminAuth(async ({ url, auth }) => {
  if (!auth.isSuperAdmin) {
    return jsonError('Forbidden: only super admins can manage users', 403);
  }

  const user_id = url.searchParams.get('user_id');
  if (!user_id) {
    return jsonError('user_id query parameter is required', 400);
  }

  // Guard: never remove the primary super admin
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
  if (authUser?.user?.email === 'dertownleavenworth@gmail.com') {
    return jsonError('Cannot remove the primary admin account', 403);
  }

  const { error } = await supabaseAdmin
    .from('user_permissions')
    .delete()
    .eq('user_id', user_id);

  if (error) {
    console.error('[ADMIN USERS] Delete error:', error);
    return jsonError('Failed to remove user permissions');
  }

  return jsonResponse({ success: true });
});
