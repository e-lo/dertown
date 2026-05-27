import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const now = new Date().toISOString();
    // Query announcements table directly (public_announcements view incorrectly excludes
    // rows where show_at IS NULL because NULL <= now() evaluates to NULL in PostgreSQL).
    // The announcements table has RLS: "Enable read access for all users" FOR SELECT USING (true).
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('status', 'published')
      .or(`show_at.is.null,show_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return jsonError('Failed to fetch announcements');
    }

    return jsonResponse({ announcements: announcements ?? [] });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    return jsonError('Internal server error', 500);
  }
};
