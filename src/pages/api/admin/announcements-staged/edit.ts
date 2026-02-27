import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const PUT = withAdminAuth(async ({ request }) => {
  const { id, ...updateData } = await request.json();

  if (!id) {
    return jsonError('Announcement ID is required', 400);
  }

  // Convert empty strings to null for nullable fields (required by database constraints)
  // Also filter out organization_id since announcements_staged doesn't have that column
  const cleanedData: any = {};
  for (const [key, value] of Object.entries(updateData)) {
    // Skip organization_id - staged announcements use 'organization' (text) instead
    if (key === 'organization_id') {
      continue;
    }
    // For nullable text fields, convert empty strings to null
    if (value === '' || value === null || value === undefined) {
      cleanedData[key] = null;
    } else {
      cleanedData[key] = value;
    }
  }

  // Update the staged announcement using admin client (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('announcements_staged')
    .update(cleanedData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating staged announcement:', error);
    return jsonResponse({ error: 'Failed to update announcement', details: error.message }, 500);
  }

  if (!data || data.length === 0) {
    return jsonError('Announcement not found', 404);
  }

  return jsonResponse({ announcement: data[0] });
});
