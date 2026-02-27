import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  const { data: tags, error } = await supabaseAdmin.from('tags').select('id, name').order('name');

  if (error) {
    console.error('Error fetching tags:', error);
    return jsonError('Failed to fetch tags');
  }

  return jsonResponse(tags);
});
