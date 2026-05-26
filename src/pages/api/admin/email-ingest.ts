import type { APIRoute } from 'astro';
import { createHmac } from 'crypto';
import { Resend } from 'resend';
import { jsonResponse, jsonError } from '@/lib/api-utils';
import { processInboundEmail } from '@/lib/email-ingest/processor';
import type { MailgunPayload } from '@/lib/email-ingest/types';

export const prerender = false;

function verifyMailgunSignature(signingKey: string, timestamp: string, token: string, signature: string): boolean {
  const expected = createHmac('sha256', signingKey).update(timestamp + token).digest('hex');
  return expected === signature;
}

export const POST: APIRoute = async ({ request }) => {
  // Parse multipart form data (Mailgun sends form, not JSON)
  let formData: FormData;
  try { formData = await request.formData(); } catch { return jsonError('Invalid form payload', 400); }

  const timestamp = formData.get('timestamp') as string ?? '';
  const token = formData.get('token') as string ?? '';
  const signature = formData.get('signature') as string ?? '';

  const signingKey = import.meta.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.warn('[email-ingest] MAILGUN_WEBHOOK_SIGNING_KEY is not set — skipping signature check');
  } else {
    if (!verifyMailgunSignature(signingKey, timestamp, token, signature)) {
      return jsonError('Unauthorized', 400);
    }
  }

  const payload: MailgunPayload = {
    sender: formData.get('sender') as string ?? '',
    recipient: formData.get('recipient') as string ?? '',
    from: formData.get('from') as string ?? '',
    subject: formData.get('subject') as string ?? '',
    'body-plain': formData.get('body-plain') as string ?? undefined,
    'body-html': formData.get('body-html') as string ?? undefined,
    'stripped-text': formData.get('stripped-text') as string ?? undefined,
    'stripped-html': formData.get('stripped-html') as string ?? undefined,
    timestamp,
    token,
    signature,
  };

  const senderEmail = payload.sender;
  if (!senderEmail) return jsonError('Missing sender', 400);

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
