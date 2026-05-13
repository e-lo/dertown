import type { APIContext, APIRoute } from 'astro';
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

export type AuthContext = APIContext & {
  auth: {
    role: 'super_admin' | 'org_editor';
    organizationIds: string[]; // empty for super_admin (means all orgs)
    isSuperAdmin: boolean;
  };
};

export function withAdminAuth(
  handler: (context: AuthContext) => Promise<Response>
): APIRoute {
  return async (context) => {
    try {
      const { role, organizationIds } = await checkAdminAccess(context.cookies);
      const isAdmin = role === 'super_admin' || role === 'org_editor';
      if (!isAdmin) {
        return jsonError('Unauthorized', 401);
      }
      const auth = {
        role: role as 'super_admin' | 'org_editor',
        organizationIds: organizationIds ?? [],
        isSuperAdmin: role === 'super_admin',
      };
      return await handler({ ...context, auth });
    } catch (error) {
      console.error(`Error in ${context.url.pathname}:`, error);
      return jsonError('Internal server error', 500);
    }
  };
}
