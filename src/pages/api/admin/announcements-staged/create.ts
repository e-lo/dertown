import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

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

    const { organization_added, organization, ...announcementData } = await request.json();

    // Validate required fields
    if (!announcementData.title || !announcementData.message) {
      return new Response(JSON.stringify({ error: 'Title and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Failed to create announcement', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ announcement: data }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create announcement API:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

