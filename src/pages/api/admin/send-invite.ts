/**
 * POST /api/admin/send-invite
 * Sends the Supabase invite email to a user who has been created but not yet
 * sent an invite. Super admin only.
 *
 * Body: { user_id }
 */
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request, auth }) => {
  if (!auth.isSuperAdmin) return jsonError('Forbidden', 403);

  const body = await request.json().catch(() => ({}));
  const { user_id } = body;

  if (!user_id) return jsonError('user_id is required', 400);

  // Look up the user's email
  const { data: authUser, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(user_id);
  if (lookupError || !authUser?.user?.email) {
    return jsonError('User not found', 404);
  }

  const user = authUser.user;
  const email = user.email!;

  // If the account is already confirmed the user can log in normally —
  // inviteUserByEmail would error. Return a helpful message instead.
  if (user.email_confirmed_at) {
    return jsonError(
      'This user already has an active account and can log in at /login. No invite needed.',
      409
    );
  }

  // Use the request's origin so the link works in both dev and production.
  // Without this, Supabase falls back to its configured Site URL which may
  // still be localhost if it hasn't been updated in the dashboard.
  const origin = request.headers.get('origin') ?? request.headers.get('host') ?? '';
  const redirectTo = origin ? `${origin}/admin` : undefined;

  // inviteUserByEmail sends the invite email. When called for an existing user
  // it resends / generates a fresh invite link.
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined
  );
  if (inviteError) {
    console.error('[SEND-INVITE] Invite error:', inviteError);
    return jsonError(`Failed to send invite: ${inviteError.message}`);
  }

  return jsonResponse({ success: true, email });
});
