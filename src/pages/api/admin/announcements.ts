import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  // Get announcements that are pending (need approval) using admin client (bypasses RLS)
  // Include all pending announcements regardless of date, and other non-published announcements
  // Get pending announcements (all dates)
  const { data: pendingAnnouncements, error: pendingError } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  // Get other non-published announcements
  const { data: otherAnnouncements, error: otherError } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .neq('status', 'published')
    .neq('status', 'pending') // Exclude pending since we already got them
    .order('created_at', { ascending: false });

  const error = pendingError || otherError;
  const data = [...(pendingAnnouncements || []), ...(otherAnnouncements || [])];

  if (error) {
    console.error('Error fetching announcements:', error);
    return jsonError('Failed to fetch announcements');
  }

  return jsonResponse({ announcements: data || [] });
});

export const PUT = withAdminAuth(async ({ request }) => {
  const { id, ...updateData } = await request.json();

  if (!id) {
    return jsonError('Announcement ID is required', 400);
  }

  // Convert empty strings to null for nullable fields (required by database constraints)
  const cleanedData: any = {};
  for (const [key, value] of Object.entries(updateData)) {
    // For nullable text fields, convert empty strings to null
    if (value === '' || value === null || value === undefined) {
      cleanedData[key] = null;
    } else {
      cleanedData[key] = value;
    }
  }

  // Update the announcement using admin client (bypasses RLS)
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
