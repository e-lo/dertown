import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

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
      return new Response(
        JSON.stringify({ error: 'Failed to update announcement', details: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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
    console.error('Error in edit staged announcement API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
