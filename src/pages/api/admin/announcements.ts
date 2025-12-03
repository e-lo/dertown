import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get announcements that are not published using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .neq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch announcements' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ announcements: data || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in announcements API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id, ...updateData } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Announcement ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Failed to update announcement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'Announcement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ announcement: data[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in edit announcement API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
