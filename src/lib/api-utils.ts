import type { APIRoute } from 'astro';
import { checkAdminAccess } from '@/lib/session';

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export function withAdminAuth(handler: APIRoute): APIRoute {
  return async (context) => {
    try {
      const { isAdmin } = await checkAdminAccess(context.cookies);
      if (!isAdmin) {
        return jsonError('Unauthorized', 401);
      }
      return await handler(context);
    } catch (error) {
      console.error(`Error in ${context.url.pathname}:`, error);
      return jsonError('Internal server error', 500);
    }
  };
}
