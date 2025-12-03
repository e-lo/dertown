import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { announcementId } = await request.json();
    if (!announcementId) {
      return new Response(JSON.stringify({ error: 'Announcement ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the staged announcement using admin client (bypasses RLS)
    const { data: staged, error: fetchError } = await supabaseAdmin
      .from('announcements_staged')
      .select('*')
      .eq('id', announcementId)
      .single();

    if (fetchError || !staged) {
      return new Response(JSON.stringify({ error: 'Staged announcement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
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
        return new Response(JSON.stringify({ error: 'Failed to create new organization', details: orgError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
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
    // Note: staged table uses 'message', approved table uses 'message' as well
    const { error: createError } = await supabaseAdmin
      .from('announcements')
      .insert({
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
      return new Response(JSON.stringify({ error: 'Failed to create approved announcement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin approve announcement API:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
