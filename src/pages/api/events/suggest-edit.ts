import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

// Get recipient email from environment or use default
// Note: Resend free tier only allows sending to your account email until domain is verified
const RECIPIENT_EMAIL = import.meta.env.RECIPIENT_EMAIL || 'dertownleavenworth@gmail.com';
const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const USE_LOCAL_DB = import.meta.env.USE_LOCAL_DB === 'true';

async function sendEmail(subject: string, body: string, fromEmail: string) {
  // Use Resend API if key is provided (works in both local and production)
  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      
      // Use Resend's test domain for unverified accounts, or your verified domain
      const fromEmailAddress = import.meta.env.RESEND_FROM_EMAIL || 'Der Town <onboarding@resend.dev>';
      
      // Resend free tier only allows sending to your account email until domain is verified
      // Make sure RECIPIENT_EMAIL matches your Resend account email
      console.log('[RESEND] Sending email to:', RECIPIENT_EMAIL);
      console.log('[RESEND] From address:', fromEmailAddress);
      
      const { data, error } = await resend.emails.send({
        from: fromEmailAddress,
        to: [RECIPIENT_EMAIL], // Must be your Resend account email (dertownleavenworth@gmail.com)
        replyTo: fromEmail,
        subject: subject,
        html: body.replace(/\n/g, '<br>'),
        text: body,
      });

      if (error) {
        console.error('[RESEND] Error sending email:', error);
        return { success: false, error };
      }

      console.log('[RESEND] Email sent successfully:', data?.id);
      return { success: true, method: 'resend', id: data?.id };
    } catch (error) {
      console.error('[RESEND] Exception sending email:', error);
      return { success: false, error };
    }
  }

  // Fallback: log if no email service is configured
  if (USE_LOCAL_DB) {
    console.log('[LOCAL EMAIL] No RESEND_API_KEY found. Email logged for testing:');
    console.log('To:', RECIPIENT_EMAIL);
    console.log('Subject:', subject);
    console.log('Body:', body);
    console.log('From:', fromEmail);
    console.log('\nTo send real emails, add RESEND_API_KEY to .env.local');
    console.log('To view emails in Inbucket, visit: http://localhost:54324');
    return { success: true, method: 'local-log' };
  }
  
  console.warn('[EMAIL] No email service configured. Email not sent.');
  console.log('Email would be sent to:', RECIPIENT_EMAIL);
  console.log('Subject:', subject);
  console.log('Body:', body);
  return { success: false, error: 'No email service configured' };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { eventId, eventTitle, eventUrl, name, email, suggestions } = await request.json();

    if (!eventId || !name || !email || !suggestions) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format email content
    const emailSubject = `Event Edit Suggestion: ${eventTitle || 'Event'}`;
    const emailBody = `
Event Edit Suggestion

Event: ${eventTitle || 'Unknown Event'}
Event URL: ${eventUrl || 'N/A'}
Event ID: ${eventId}

Submitted by:
Name: ${name}
Email: ${email}

Suggested Changes:
${suggestions}

---
This email was sent from the Der Town event edit suggestion form.
    `.trim();

    // Send the email
    const emailResult = await sendEmail(emailSubject, emailBody, email);

    if (!emailResult.success && !USE_LOCAL_DB) {
      // In production, if email fails, still return success to user but log the error
      console.error('Failed to send email:', emailResult.error);
    }

    // Always return success to the user (we don't want to expose email failures)
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Thank you for your suggestion! We will review it and update the event if appropriate.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing edit suggestion:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

