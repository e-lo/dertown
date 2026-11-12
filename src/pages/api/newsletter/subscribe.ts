/**
 * POST /api/newsletter/subscribe
 * Starts double opt-in: emails a signed confirmation link. The contact is only
 * added to the newsletter segment once that link is opened
 * (src/pages/newsletter/confirm.astro).
 *
 * Body: { email, website, elapsed_ms } — `website` is a honeypot real visitors
 * never fill; `elapsed_ms` is how long the page was open before submitting
 * (bots post instantly or skip the form entirely).
 */
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { jsonError, jsonResponse } from '@/lib/api-utils';
import { SPAM_RATE_LIMIT_MS } from '@/lib/constants';
import { renderConfirmEmail } from '@/lib/newsletter/render';
import { normalizeEmail, signConfirmToken } from '@/lib/newsletter/token';
import { SITE_URL } from '@/lib/site';

export const prerender = false;

const DEFAULT_FROM = 'This Week in Der Town <hello@dertown.org>';
// Same reply whether or not the address is already subscribed, so the form
// can't be used to probe who is on the list.
const CHECK_INBOX = 'Check your inbox for a confirmation link.';

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) ?? {};
  if (typeof body.website === 'string' && body.website.trim()) {
    return jsonResponse({ message: CHECK_INBOX });
  }
  // Measured in the browser: the footer is on CDN-cached pages, so a
  // server-rendered timestamp would be stale.
  const elapsedMs = Number(body.elapsed_ms);
  if (!Number.isFinite(elapsedMs) || elapsedMs < SPAM_RATE_LIMIT_MS) {
    return jsonError('That was quick! Please wait a moment and try again.', 429);
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : null;
  if (!email) return jsonError('Please enter a valid email address.', 400);

  const apiKey = import.meta.env.RESEND_NEWSLETTER_API_KEY;
  const secret = import.meta.env.NEWSLETTER_SIGNING_SECRET;
  if (!apiKey || !secret) {
    console.error('[NEWSLETTER] RESEND_NEWSLETTER_API_KEY or NEWSLETTER_SIGNING_SECRET is not set');
    return jsonError('Signups are temporarily unavailable. Please try again later.', 500);
  }

  const token = signConfirmToken(email, secret, new Date());
  const confirmUrl = `${SITE_URL}/newsletter/confirm?token=${encodeURIComponent(token)}`;
  const { subject, html, text } = renderConfirmEmail(confirmUrl);

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: import.meta.env.NEWSLETTER_FROM_EMAIL || DEFAULT_FROM,
    to: [email],
    subject,
    html,
    text,
  });
  if (error) {
    console.error('[NEWSLETTER] Failed to send confirmation email:', error);
    return jsonError("We couldn't send the confirmation email. Please try again later.", 502);
  }

  return jsonResponse({ message: CHECK_INBOX });
};
