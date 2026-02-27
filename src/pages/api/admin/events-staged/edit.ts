import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const PUT = withAdminAuth(async ({ request }) => {
  const { id, ...updateData } = await request.json();

  if (!id) {
    return jsonError('Event ID is required', 400);
  }

  // Convert empty strings to null for nullable fields (required by database constraints)
  // Email must be either NULL or a valid email format - empty string fails the constraint
  const cleanedData: any = {};
  for (const [key, value] of Object.entries(updateData)) {
    // For email, website, registration_link, and other text fields that can be null
    if (value === '' || value === null || value === undefined) {
      cleanedData[key] = null;
    } else {
      cleanedData[key] = value;
    }
  }

  // Update the staged event using admin client (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('events_staged')
    .update(cleanedData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating staged event:', error);
    return jsonError('Failed to update event');
  }

  if (!data || data.length === 0) {
    return jsonError('Event not found', 404);
  }

  return jsonResponse({ event: data[0] });
});
