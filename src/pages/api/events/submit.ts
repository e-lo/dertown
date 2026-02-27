import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';
import { validateEventForm } from '../../../lib/validation';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Check honeypot field first
    if (data.website_url && data.website_url.trim() !== '') {
      console.log('[SPAM DETECTED] Event submission with filled honeypot field:', data.website_url);
      return jsonError('Invalid submission detected', 400);
    }

    // Basic rate limiting - check if submission is too fast (likely a bot)
    if (data.submission_time) {
      const submissionTime = new Date(data.submission_time);
      const now = new Date();
      const timeDiff = now.getTime() - submissionTime.getTime();

      // If submission is less than 3 seconds from the timestamp, it's likely a bot
      if (timeDiff < 3000) {
        console.log('[SPAM DETECTED] Event submission too fast:', timeDiff, 'ms');
        return jsonError('Submission too fast, please try again', 429);
      }
    }

    const validation = validateEventForm(data);
    if (!validation.success) {
      console.log('[SUBMIT DEBUG] Validation failed:', validation.error.flatten());
      return jsonResponse({ error: 'Validation failed', details: validation.error.flatten() }, 400);
    }

    const formData = validation.data;
    console.log('[SUBMIT DEBUG] Validated form data:', formData);

    const eventData: unknown = {
      title: formData.title,
      description: formData.description,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      email: formData.email || null,
      website: formData.website || null,
      registration_link: formData.registration_link || null,
      external_image_url: formData.external_image_url || null,
      image_alt_text: formData.image_alt_text || null,
      registration: formData.registration || false,
      cost: formData.cost || null,
      comments: formData.comments || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    };

    // Handle location (either existing ID or store for admin review)
    if (formData.location_id && formData.location_id !== '') {
      (eventData as any).location_id = formData.location_id;
      console.log('[SUBMIT DEBUG] Using existing location ID:', formData.location_id);
    } else if (formData.location_added && formData.location_added !== '') {
      // Store new location name for admin review
      (eventData as any).location_added = formData.location_added;
      console.log('[SUBMIT DEBUG] Storing new location for review:', formData.location_added);
    }

    // Handle organization (either existing ID or store for admin review)
    if (formData.organization_id && formData.organization_id !== '') {
      (eventData as any).organization_id = formData.organization_id;
      console.log('[SUBMIT DEBUG] Using existing organization ID:', formData.organization_id);
    } else if (formData.organization_added && formData.organization_added !== '') {
      // Store new organization name for admin review
      (eventData as any).organization_added = formData.organization_added;
      console.log(
        '[SUBMIT DEBUG] Storing new organization for review:',
        formData.organization_added
      );
    }

    // Handle primary tag (use existing ID only)
    if (formData.primary_tag_id && formData.primary_tag_id !== '') {
      (eventData as any).primary_tag_id = formData.primary_tag_id;
      console.log('[SUBMIT DEBUG] Using existing primary tag ID:', formData.primary_tag_id);
    }

    // Handle secondary tag (use existing ID only)
    if (formData.secondary_tag_id && formData.secondary_tag_id !== '') {
      (eventData as any).secondary_tag_id = formData.secondary_tag_id;
      console.log('[SUBMIT DEBUG] Using existing secondary tag ID:', formData.secondary_tag_id);
    }

    console.log('[SUBMIT DEBUG] Final event data:', eventData);

    // Insert into events_staged
    const { error } = await db.eventsStaged.create(eventData as any);
    if (error) {
      console.log('[SUBMIT DEBUG] Event creation error:', error);
      return jsonResponse({ error: 'Database insert failed', details: error.message }, 500);
    }

    console.log('[SUBMIT DEBUG] Event created successfully');
    return jsonResponse({ success: true }, 201);
  } catch (err) {
    console.log('[SUBMIT DEBUG] Unexpected error:', err);
    return jsonResponse({ error: 'Invalid request', details: String(err) }, 400);
  }
};
