import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ auth }) => {
  let pendingQuery = supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  let otherQuery = supabaseAdmin
    .from('announcements')
    .select('*')
    .neq('status', 'published')
    .neq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!auth.isSuperAdmin) {
    pendingQuery = pendingQuery.in('organization_id', auth.organizationIds);
    otherQuery = otherQuery.in('organization_id', auth.organizationIds);
  }

  const [{ data: pending, error: pendingError }, { data: other, error: otherError }] =
    await Promise.all([pendingQuery, otherQuery]);

  if (pendingError || otherError) {
    console.error('Error fetching announcements:', pendingError || otherError);
    return jsonError('Failed to fetch announcements');
  }

  return jsonResponse({ announcements: [...(pending || []), ...(other || [])] });
});

export const PUT = withAdminAuth(async ({ request, auth }) => {
  const { id, ...updateData } = await request.json();

  if (!id) {
    return jsonError('Announcement ID is required', 400);
  }

  // Org editors can only update announcements belonging to their organizations
  if (!auth.isSuperAdmin) {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('announcements')
      .select('organization_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return jsonError('Announcement not found', 404);
    }

    if (!existing.organization_id || !auth.organizationIds.includes(existing.organization_id)) {
      return jsonError('Forbidden: announcement does not belong to your organization', 403);
    }

    // Org editors cannot publish announcements — requires super admin approval
    if (updateData.status === 'published') {
      return jsonError('Forbidden: only super admins can publish announcements', 403);
    }
  }

  const cleanedData: any = {};
  for (const [key, value] of Object.entries(updateData)) {
    cleanedData[key] = (value === '' || value === null || value === undefined) ? null : value;
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update(cleanedData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating announcement:', error);
    return jsonError('Failed to update announcement');
  }

  if (!data || data.length === 0) {
    return jsonError('Announcement not found', 404);
  }

  return jsonResponse({ announcement: data[0] });
});
