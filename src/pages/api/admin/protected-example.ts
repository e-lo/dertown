import { withAdminAuth, jsonResponse } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  // All authenticated users are considered admins
  // Return protected resource
  return jsonResponse({ message: 'You are an admin and can access this resource.' });
});
