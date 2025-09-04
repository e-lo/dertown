import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';
import type { TablesInsert } from '../../../lib/supabase';
import { validateAnnouncementForm } from '../../../lib/validation';

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
      return new Response(JSON.stringify({ error: 'Invalid submission detected' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Basic rate limiting - check if submission is too fast (likely a bot)
    if (data.submission_time) {
      const submissionTime = new Date(data.submission_time);
      const now = new Date();
      const timeDiff = now.getTime() - submissionTime.getTime();

      // If submission is less than 3 seconds from the timestamp, it's likely a bot
      if (timeDiff < 3000) {
        console.log('[SPAM DETECTED] Announcement submission too fast:', timeDiff, 'ms');
        return new Response(JSON.stringify({ error: 'Submission too fast, please try again' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const validation = validateAnnouncementForm(data);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validation.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const formData = validation.data;

    // Handle show_at - if not provided, use current time
    const showAt = formData.show_at ? new Date(formData.show_at) : new Date();

    // Handle expires_at - if not provided, default to 2 weeks after show_at
    let expiresAt = null;
    if (formData.expires_at) {
      expiresAt = new Date(formData.expires_at);
    } else {
      expiresAt = new Date(showAt);
      expiresAt.setDate(expiresAt.getDate() + 14); // Add 2 weeks
    }

    const announcementData: Record<string, unknown> = {
      title: formData.title,
      message: formData.message,
      show_at: showAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      link: formData.link || null,
      email: formData.email || null,
      comments: formData.comments || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Handle organization (either existing ID or store for admin review)
    if (formData.organization_id && formData.organization_id !== '') {
      announcementData.organization_id = formData.organization_id;
    } else if (formData.organization_added && formData.organization_added !== '') {
      announcementData.organization_added = formData.organization_added;
    }

    // Add logic to handle cases where announcementData is just a generic object
    const { message, title, author, email } = announcementData as {
      message: string;
      title: string;
      author?: string;
      email?: string;
    };

    if (!message || !title) {
      return new Response(
        JSON.stringify({
          error: 'Title and message are required',
        }),
        { status: 400 }
      );
    }

    const insertData: TablesInsert<'announcements_staged'> = {
      message,
      title,
      author,
      email,
      status: 'pending',
    };

    const { error } = await db.announcementsStaged.create(insertData);

    if (error) {
      console.error('Error inserting announcement:', error);
      return new Response(
        JSON.stringify({ error: 'Database insert failed', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
