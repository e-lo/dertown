import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

// Get recipient email from environment or use default
// Note: Resend free tier only allows sending to your account email until domain is verified
const RECIPIENT_EMAIL = import.meta.env.RECIPIENT_EMAIL || 'dertownleavenworth@gmail.com';
const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const USE_LOCAL_DB = import.meta.env.USE_LOCAL_DB === 'true';

const VALID_CONTENT_TYPES = ['event', 'announcement', 'organization'] as const;
const VALID_ACTIONS = ['report', 'block'] as const;

type ContentType = (typeof VALID_CONTENT_TYPES)[number];
type ReportAction = (typeof VALID_ACTIONS)[number];

const MAX_FIELD = 200;
const MAX_DETAILS = 2000;

async function sendEmail(subject: string, body: string) {
  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      const fromEmailAddress =
        import.meta.env.RESEND_FROM_EMAIL || 'Der Town <onboarding@resend.dev>';

      const { data, error } = await resend.emails.send({
        from: fromEmailAddress,
        to: [RECIPIENT_EMAIL],
        subject,
        html: body.replace(/\n/g, '<br>'),
        text: body,
      });

      if (error) {
        console.error('[RESEND] Error sending content report:', error);
        return { success: false, error };
      }
      return { success: true, method: 'resend', id: data?.id };
    } catch (error) {
      console.error('[RESEND] Exception sending content report:', error);
      return { success: false, error };
    }
  }

  if (USE_LOCAL_DB) {
    console.log('[LOCAL EMAIL] Content report (no RESEND_API_KEY):');
    console.log('To:', RECIPIENT_EMAIL, '\nSubject:', subject, '\nBody:', body);
    return { success: true, method: 'local-log' };
  }

  console.warn('[EMAIL] No email service configured. Content report not sent:', subject, body);
  return { success: false, error: 'No email service configured' };
}

/**
 * Receives content reports and organizer blocks from the mobile app
 * (App Store Guideline 1.2 — user-generated content moderation).
 * Reports must be acted on within 24 hours.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const action: ReportAction = VALID_ACTIONS.includes(payload.action) ? payload.action : 'report';
    const { contentType, contentId, contentTitle, reason, details } = payload;

    if (!VALID_CONTENT_TYPES.includes(contentType) || !contentId || !reason) {
      return jsonError('Missing required fields', 400);
    }

    const clip = (v: unknown, max: number) => String(v ?? '').slice(0, max);
    const title = clip(contentTitle, MAX_FIELD) || 'Untitled';
    const urlPath: Record<ContentType, string> = {
      event: 'events',
      announcement: 'announcements',
      organization: 'organizations',
    };

    const emailSubject =
      action === 'block'
        ? `[MODERATION] Organizer blocked by a user: ${title}`
        : `[MODERATION] Content reported: ${title}`;

    const emailBody = `
Content ${action === 'block' ? 'Block' : 'Report'} from Der Town mobile app

Type: ${contentType}
Title: ${title}
ID: ${clip(contentId, MAX_FIELD)}
Link: https://dertown.org/${urlPath[contentType as ContentType]}/${clip(contentId, MAX_FIELD)}

Reason: ${clip(reason, MAX_FIELD)}
${details ? `Details: ${clip(details, MAX_DETAILS)}` : ''}

---
App Store Guideline 1.2 requires acting on objectionable-content reports
within 24 hours: review the content in the admin panel and remove it
(and its submitter) if it violates the terms of use.
    `.trim();

    const emailResult = await sendEmail(emailSubject, emailBody);
    if (!emailResult.success && !USE_LOCAL_DB) {
      console.error('Failed to send content report email:', emailResult.error);
    }

    // Always acknowledge — the report is also logged server-side above
    return jsonResponse({
      success: true,
      message: 'Thank you. We review reports within 24 hours and remove content that violates our terms.',
    });
  } catch (error) {
    console.error('Error processing content report:', error);
    return jsonError('Internal server error');
  }
};
