// src/pages/api/admin/kid-activities/[id]/activity-events.ts
import { withAdminAuth, jsonResponse } from '@/lib/api-utils';

export const prerender = false;

// Stub: activity events / schedule management is out of scope for this iteration.
// Returns empty array so the UI shows "No schedule set" instead of 404 errors.
export const GET = withAdminAuth(async () => {
  return jsonResponse({ events: [] });
});
