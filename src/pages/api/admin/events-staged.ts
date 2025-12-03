import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  // Check authentication
  const { isAdmin, error: authError } = await checkAdminAccess(cookies);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabaseAdmin
    .from('events_staged')
    .select(`
      *,
      primary_tag:tags!events_staged_primary_tag_id_fkey(name),
      secondary_tag:tags!events_staged_secondary_tag_id_fkey(name),
      location:locations!events_staged_location_id_fkey(name, address),
      organization:organizations!events_staged_organization_id_fkey(name)
    `);

  if (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch staged events' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ events: data || [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
