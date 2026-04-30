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

  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');

  let query = supabase.from('allowlisted_org_emails').select('*');

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ORG-USERS] Fetch error:', error);
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

  const { email, organization_id } = await request.json();

  if (!email || !organization_id) {
    return new Response(JSON.stringify({ error: 'Email and organization_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get current user from session
  const sessionResponse = await supabase.auth.getUser();
  const userId = sessionResponse.data.user?.id || 'system';

  const { data, error } = await supabase.from('allowlisted_org_emails').insert({
    email: email.toLowerCase(),
    organization_id,
    created_by: userId,
  });

  if (error) {
    console.error('[ORG-USERS] Insert error:', error);
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

export async function DELETE({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const organizationId = url.searchParams.get('organization_id');

  if (!email || !organizationId) {
    return new Response(JSON.stringify({ error: 'Email and organization_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete from allowlisted_org_emails
  const { error: deleteError } = await supabase
    .from('allowlisted_org_emails')
    .delete()
    .eq('email', email.toLowerCase())
    .eq('organization_id', organizationId);

  if (deleteError) {
    console.error('[ORG-USERS] Delete error:', deleteError);
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Also delete from org_users if the user was already registered
  const { data: user } = await supabase.auth.admin.listUsers();
  const registeredUser = user?.users.find((u) => u.email === email.toLowerCase());

  if (registeredUser) {
    await supabase
      .from('org_users')
      .delete()
      .eq('user_id', registeredUser.id)
      .eq('organization_id', organizationId);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
