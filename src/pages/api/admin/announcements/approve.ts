import { supabaseAdmin } from '@/lib/supabase';
import { withSuperAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withSuperAdminAuth(async ({ request }) => {
  const { announcementId } = await request.json();

  if (!announcementId) {
    return jsonError('Announcement ID is required', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update({ status: 'published' })
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    console.error('Error approving announcement:', error);
    return jsonError('Failed to approve announcement');
  }

  // Fire-and-forget: send push notifications to all registered devices
  sendPushNotifications(data).catch((err) =>
    console.error('Push notification send error:', err)
  );

  return jsonResponse({ announcement: data });
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

  // Expo Push API accepts up to 100 messages per request
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
