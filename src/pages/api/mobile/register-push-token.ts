import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { token, platform } = body as { token?: string; platform?: string };

    if (!token || typeof token !== 'string') {
      return jsonError('Missing or invalid token', 400);
    }
    if (platform !== 'ios' && platform !== 'android') {
      return jsonError('Invalid platform — must be ios or android', 400);
    }

    const { error } = await supabaseAdmin
      .from('push_tokens')
      .upsert(
        { token, platform, last_seen_at: new Date().toISOString() },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('Error registering push token:', error);
      return jsonError('Failed to register push token');
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Error registering push token:', err);
    return jsonError('Internal server error', 500);
  }
};
