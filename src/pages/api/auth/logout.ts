import type { APIRoute } from 'astro';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  try {
    // Clear session cookies using Astro's cookie handling
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });

    return jsonResponse({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return jsonError('Internal server error');
  }
};
