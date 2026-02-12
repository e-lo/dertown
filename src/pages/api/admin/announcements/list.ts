import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

/**
 * GET /api/admin/announcements/list?days=14
 * Returns pending announcements plus published announcements within the date window
 * (show_at from today - days to today + days). Default 14 days each direction.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const { isAdmin } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const days = Math.min(
      60,
      Math.max(1, parseInt(url.searchParams.get('days') || '14', 10) || 14)
    );
    const today = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - days);
    const end = new Date();
    end.setDate(end.getDate() + days);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const [pendingRes, publishedRes] = await Promise.all([
      supabaseAdmin
        .from('announcements')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('announcements')
        .select('*')
        .eq('status', 'published')
        .gte('show_at', startStr)
        .lte('show_at', endStr)
        .order('show_at', { ascending: false })
        .limit(100),
    ]);

    if (pendingRes.error || publishedRes.error) {
      console.error('Error fetching announcements list:', pendingRes.error || publishedRes.error);
      return new Response(JSON.stringify({ error: 'Failed to fetch announcements' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pending = pendingRes.data || [];
    const published = publishedRes.data || [];
    const byId = new Map((pending as { id: string }[]).map((a) => [a.id, a]));
    published.forEach((a) => {
      if (!byId.has(a.id)) byId.set(a.id, a);
    });
    const combined = Array.from(byId.values()).sort(
      (
        a: { show_at?: string; created_at?: string },
        b: { show_at?: string; created_at?: string }
      ) => {
        const da = a.show_at || a.created_at || '';
        const db = b.show_at || b.created_at || '';
        return db.localeCompare(da);
      }
    );

    return new Response(JSON.stringify({ announcements: combined }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in announcements list API:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
