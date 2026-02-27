import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const POST = withAdminAuth(async ({ request }) => {
  const { announcementId } = await request.json();
  if (!announcementId) {
    return jsonError('Announcement ID is required', 400);
  }

  // Get the staged announcement using admin client (bypasses RLS)
  const { data: staged, error: fetchError } = await supabaseAdmin
    .from('announcements_staged')
    .select('*')
    .eq('id', announcementId)
    .single();

  if (fetchError || !staged) {
    return jsonError('Staged announcement not found', 404);
  }

  // Handle organization: staged announcements use 'organization' (text) and 'organization_added' (text)
  // The approved announcements table uses 'organization_id' (uuid)
  let organizationId: string | null = null;

  // If a new organization was added, create it first
  if (staged.organization_added) {
    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: staged.organization_added,
        status: 'approved',
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating new organization:', orgError);
      return jsonResponse(
        { error: 'Failed to create new organization', details: orgError.message },
        500
      );
    }

    if (newOrg) {
      organizationId = newOrg.id;
    }
  } else if (staged.organization) {
    // Look up existing organization by name
    const { data: existingOrg, error: lookupError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('name', staged.organization)
      .eq('status', 'approved')
      .single();

    if (lookupError) {
      console.error('Error looking up organization:', lookupError);
      // Don't fail - just proceed without organization_id
    } else if (existingOrg) {
      organizationId = existingOrg.id;
    }
  }

  // Create the approved announcement using admin client
  const { error: createError } = await supabaseAdmin.from('announcements').insert({
    title: staged.title,
    message: staged.message,
    link: staged.link,
    email: staged.email,
    organization_id: organizationId,
    author: staged.author,
    show_at: staged.show_at,
    expires_at: staged.expires_at,
    comments: staged.comments,
    status: 'published',
  });

  if (createError) {
    console.error('Error creating approved announcement:', createError);
    return jsonError('Failed to create approved announcement');
  }

  // Delete the staged announcement using admin client
  const { error: deleteError } = await supabaseAdmin
    .from('announcements_staged')
    .delete()
    .eq('id', announcementId);

  if (deleteError) {
    console.error('Error deleting staged announcement:', deleteError);
    // Don't fail the request if deletion fails, as the announcement was already created
  }

  return jsonResponse({ success: true });
});
