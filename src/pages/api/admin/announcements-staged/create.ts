import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  const { organization_added, organization, ...announcementData } = await request.json();

  // Validate required fields
  if (!announcementData.title || !announcementData.message) {
    return jsonError('Title and message are required', 400);
  }

  // Handle organization - staged announcements use 'organization' (text) and 'organization_added' (text)
  const stagedData: any = {
    title: announcementData.title,
    message: announcementData.message,
    link: announcementData.link || null,
    email: announcementData.email || null,
    author: announcementData.author || null,
    show_at: announcementData.show_at || null,
    expires_at: announcementData.expires_at || null,
    comments: announcementData.comments || null,
    status: 'pending',
  };

  if (organization) {
    stagedData.organization = organization;
    stagedData.organization_added = null;
  } else if (organization_added && organization_added.trim()) {
    stagedData.organization = null;
    stagedData.organization_added = organization_added.trim();
  } else {
    stagedData.organization = null;
    stagedData.organization_added = null;
  }

  // Create the staged announcement
  const { data, error } = await supabaseAdmin
    .from('announcements_staged')
    .insert(stagedData)
    .select()
    .single();

  if (error) {
    console.error('Error creating staged announcement:', error);
    return jsonResponse(
      { error: 'Failed to create announcement', details: error.message },
      500
    );
  }

  return jsonResponse({ announcement: data }, 201);
});
