import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { ingestText } from '@/lib/email-ingest/ingest-text';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  let text: string;
  try {
    const body = await request.json();
    text = (body.text ?? '').trim();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  if (!text) {
    return jsonError('No text provided', 400);
  }

  try {
    const result = await ingestText(text, 'admin-paste');
    return jsonResponse({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[paste-import] Error:', message);
    return jsonResponse({ ok: false, error: message }, 422);
  }
});
