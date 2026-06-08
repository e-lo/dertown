import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request, auth }) => {
  let requestData;
  try {
    requestData = await request.json();
  } catch (parseError) {
    console.error('[CREATE ANNOUNCEMENT] JSON parse error:', parseError);
    return jsonError('Invalid JSON in request body', 400);
  }

  const { organization_added, ...announcementData } = requestData;

  if (!announcementData.title || !announcementData.message) {
    return jsonError('Title and message are required', 400);
  }

  // Org editors can only create announcements for their assigned organizations.
  if (!auth.isSuperAdmin && announcementData.organization_id) {
    if (!auth.organizationIds.includes(announcementData.organization_id)) {
      return jsonError('Forbidden: cannot create announcement for this organization', 403);
    }
  }

  let organizationId = announcementData.organization_id || null;

  if (organization_added && organization_added.trim()) {
    const { data: newOrganization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organization_added.trim(),
        status: 'approved' as const,
      })
      .select()
      .single();

    if (orgError) {
      console.error('[CREATE ANNOUNCEMENT] Organization creation error:', orgError);
      return jsonResponse(
        { error: 'Failed to create new organization', details: orgError.message },
        500
      );
    }

    if (newOrganization) {
      organizationId = newOrganization.id;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      title: announcementData.title,
      message: announcementData.message,
      link: announcementData.link || null,
      email: announcementData.email || null,
      author: announcementData.author || null,
      show_at: announcementData.show_at || null,
      expires_at: announcementData.expires_at || null,
      comments: announcementData.comments || null,
      organization_id: organizationId,
      status: 'published',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[CREATE ANNOUNCEMENT] Error creating announcement:', error);
    console.error('[CREATE ANNOUNCEMENT] Announcement data:', JSON.stringify(announcementData, null, 2));
    return jsonResponse({ error: 'Failed to create announcement', details: error.message }, 500);
  }

  // Fire-and-forget: send push notifications to all registered devices
  sendPushNotifications(data).catch((err) =>
    console.error('Push notification send error:', err)
  );

  return jsonResponse({ announcement: data }, 201);
});

async function sendPushNotifications(announcement: {
  title: string;
  message: string;
  id: string;
}): Promise<void> {
  const { data: tokens } = await supabaseAdmin
    .from('push_tokens')
    .select('token');

  if (!tokens || tokens.length === 0) return;

  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map(({ token }) => ({
      to: token,
      title: announcement.title,
      body: announcement.message.slice(0, 200),
      data: { type: 'announcement', id: announcement.id },
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(batch),
    });
  }
}
