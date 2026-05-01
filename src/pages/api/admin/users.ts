import { supabase } from '../../../lib/supabase';
import { checkAdminAccess } from '../../../lib/session';

export async function GET({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch all users with their permissions
  const { data, error } = await supabase
    .from('user_permissions')
    .select('id, user_id, is_admin, org_access_enabled, created_at, updated_at');

  if (error) {
    console.error('[ADMIN USERS] Fetch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user_id, is_admin, org_access_enabled } = await request.json();

  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create or update user permissions
  const { data, error } = await supabase.from('user_permissions').upsert(
    {
      user_id,
      is_admin: is_admin ?? false,
      org_access_enabled: org_access_enabled ?? false,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[ADMIN USERS] Upsert error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function PUT({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user_id, is_admin, org_access_enabled } = await request.json();

  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update user permissions
  const updates: Record<string, any> = {};
  if (is_admin !== undefined) updates.is_admin = is_admin;
  if (org_access_enabled !== undefined) updates.org_access_enabled = org_access_enabled;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_permissions')
    .update(updates)
    .eq('user_id', user_id);

  if (error) {
    console.error('[ADMIN USERS] Update error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function DELETE({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const user_id = url.searchParams.get('user_id');

  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id query parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Don't allow deleting dertownleavenworth@gmail.com's admin access
  const { data: user } = await supabase.auth.admin.getUserById(user_id);
  if (user && user.email === 'dertownleavenworth@gmail.com') {
    return new Response(JSON.stringify({ error: 'Cannot revoke admin access from dertownleavenworth@gmail.com' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase.from('user_permissions').delete().eq('user_id', user_id);

  if (error) {
    console.error('[ADMIN USERS] Delete error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
