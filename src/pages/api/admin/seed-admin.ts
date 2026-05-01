import { supabase } from '../../../lib/supabase';

/**
 * Seed admin permissions for dertown@gmail.com
 * Only callable from localhost or with special auth token
 * Usage: POST /api/admin/seed-admin
 */
export async function POST({ request }: any) {
  // Safety check: only allow from localhost in development
  const url = new URL(request.url);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (!isLocalhost) {
    return new Response(
      JSON.stringify({ error: 'Only available on localhost' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Find dertown@gmail.com in auth.users
    const { data: user, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      return new Response(
        JSON.stringify({ error: `Failed to list users: ${userError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dertownUser = user?.users?.find((u: any) => u.email === 'dertown@gmail.com');

    if (!dertownUser) {
      return new Response(
        JSON.stringify({
          error: 'dertown@gmail.com not found in auth.users',
          message: 'Please create an account first at the login page'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Seed or update user_permissions
    const { data, error } = await supabase
      .from('user_permissions')
      .upsert(
        {
          user_id: dertownUser.id,
          is_admin: true,
          org_access_enabled: false,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      return new Response(
        JSON.stringify({ error: `Failed to seed permissions: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'dertown@gmail.com seeded as super admin',
        user_id: dertownUser.id,
        permissions: {
          is_admin: true,
          org_access_enabled: false
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
