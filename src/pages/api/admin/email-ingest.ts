import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { jsonResponse, jsonError } from '@/lib/api-utils';
import { processInboundEmail } from '@/lib/email-ingest/processor';
import type { CloudMailinPayload } from '@/lib/email-ingest/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const expectedSecret = import.meta.env.CLOUDMAILIN_SECRET;
  if (!expectedSecret) {
    console.warn('[email-ingest] CLOUDMAILIN_SECRET is not set — skipping signature check');
  } else {
    const providedSecret = request.headers.get('x-cloudmailin-secret');
    if (providedSecret !== expectedSecret) return jsonError('Unauthorized', 400);
  }
  // CloudMailin's payload shape is stable; we trust the contract without runtime validation.
  let payload: CloudMailinPayload;
  try { payload = await request.json(); } catch { return jsonError('Invalid JSON payload', 400); }
  const senderEmail = payload.envelope?.from;
  if (!senderEmail) return jsonError('Missing envelope.from', 400);
  try {
    const result = await processInboundEmail(payload);
    if (result.status === 'rejected_sender') {
      console.log(`[email-ingest] Rejected unauthorized sender: ${senderEmail}`);
      return jsonResponse({ ok: true });
    }
    console.log(`[email-ingest] Processed from ${senderEmail}: ${result.status}`);
    return jsonResponse({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[email-ingest] Error processing email from ${senderEmail}:`, message);
    const resendKey = import.meta.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const fromAddress = import.meta.env.RESEND_FROM_EMAIL || 'Der Town <onboarding@resend.dev>';
        await resend.emails.send({
          from: fromAddress, to: [senderEmail],
          subject: 'Could not process your forwarded email',
          text: `Hi,\n\nWe received your email but could not process it:\n\n${message}\n\nPlease try again or add the event manually at dertown.app/admin.\n`,
        });
      } catch (resendErr) { console.error('[email-ingest] Failed to send error reply:', resendErr); }
    }
    return jsonResponse({ ok: false, error: 'Processing failed' }, 500);
  }
};
