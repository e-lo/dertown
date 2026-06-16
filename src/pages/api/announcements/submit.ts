import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';
import { validateAnnouncementForm } from '../../../lib/validation';
import { buildStagedAnnouncement } from '../../../lib/announcement-staging';
import { jsonResponse, jsonError } from '@/lib/api-utils';
import { SPAM_RATE_LIMIT_MS } from '@/lib/constants';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Check honeypot field first
    if (data.website_url && data.website_url.trim() !== '') {
      console.log(
        '[SPAM DETECTED] Announcement submission with filled honeypot field:',
        data.website_url
      );
      return jsonError('Invalid submission detected', 400);
    }

    // Basic rate limiting - check if submission is too fast (likely a bot)
    if (data.submission_time) {
      const submissionTime = new Date(data.submission_time);
      const now = new Date();
      const timeDiff = now.getTime() - submissionTime.getTime();

      // If submission is less than 3 seconds from the timestamp, it's likely a bot
      if (timeDiff < SPAM_RATE_LIMIT_MS) {
        console.log('[SPAM DETECTED] Announcement submission too fast:', timeDiff, 'ms');
        return jsonError('Submission too fast, please try again', 429);
      }
    }

    const validation = validateAnnouncementForm(data);
    if (!validation.success) {
      return jsonResponse({ error: 'Validation failed', details: validation.error.flatten() }, 400);
    }
    const formData = validation.data;

    // Staged announcements key an existing organization by NAME (it's re-resolved
    // by name on approval), but the public form sends it as a UUID. Resolve the
    // id to a name, degrading gracefully so a submission is never lost over an
    // organization lookup failure.
    let organizationName: string | null = null;
    if (formData.organization_id) {
      try {
        const { data: org } = await db.organizations.getById(formData.organization_id);
        organizationName = org?.name ?? null;
      } catch (lookupErr) {
        console.error('Error resolving organization for staged announcement:', lookupErr);
      }
    }

    const insertData = buildStagedAnnouncement(formData, organizationName);

    const { error } = await db.announcementsStaged.create(insertData);

    if (error) {
      console.error('Error inserting announcement:', error);
      return jsonResponse({ error: 'Database insert failed', details: error.message }, 500);
    }
    return jsonResponse({ success: true }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Invalid request', details: String(err) }, 400);
  }
};
