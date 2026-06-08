import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { extractAnnouncementWithAI } from '@/lib/ai/extract-announcement';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  let text: string;
  try {
    const body = await request.json();
    text = (body.text ?? '').trim();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  if (!text) return jsonError('No text provided', 400);

  let extracted;
  try {
    extracted = await extractAnnouncementWithAI(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[announcement-import] AI extraction failed:', msg);
    return jsonResponse({ ok: false, error: msg }, 422);
  }

  // Try to resolve organization name to an ID
  let organizationId: string | null = null;
  if (extracted.organization_name) {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('name', extracted.organization_name)
      .eq('status', 'approved')
      .single();
    if (org) organizationId = org.id;
  }

  // Send push notifications fire-and-forget (same as /api/admin/announcements/create)
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      title: extracted.title,
      message: extracted.message,
      link: extracted.link,
      organization_id: organizationId,
      show_at: extracted.show_at,
      expires_at: extracted.expires_at,
      status: 'published',
      comments: `Imported via Quick Import on ${new Date().toISOString().split('T')[0]}`,
    })
    .select('id, title')
    .single();

  if (error) {
    console.error('[announcement-import] Insert error:', error.message);
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  // Fire-and-forget push notifications
  sendPushNotifications(data).catch((err) =>
    console.error('[announcement-import] Push notification error:', err)
  );

  return jsonResponse({ ok: true, announcement: { id: data.id, title: data.title } });
});

async function sendPushNotifications(announcement: { title: string; message?: string; id: string }) {
  const { data: tokens } = await supabaseAdmin.from('push_tokens').select('token');
  if (!tokens?.length) return;

  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map(({ token }) => ({
      to: token,
      title: announcement.title,
      body: (announcement.message ?? '').slice(0, 200),
      data: { type: 'announcement', id: announcement.id },
    }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
  }
}
