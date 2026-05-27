import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const now = new Date().toISOString();
    const { data: announcements, error } = await supabase
      .from('public_announcements')
      .select('*')
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
