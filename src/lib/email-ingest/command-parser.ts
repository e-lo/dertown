import type { CloudMailinPayload, EmailIntent } from './types';

const ANNOUNCEMENT_RE = /^(add\s+)?announcement[:\s]/i;
const SUBJECT_FWD_RE = /^(re|fwd?)[:\s]+/gi;
const URL_RE = /https?:\/\/[^\s<>"]+/;

export function parseIntent(payload: CloudMailinPayload): EmailIntent {
  const subject = payload.headers?.subject ?? '';
  // Strip Re:/Fwd: prefixes before matching announcement pattern
  const normalizedSubject = subject.replace(SUBJECT_FWD_RE, '').trim();
  // Prefer reply_plain (new content only); fall back to plain; last resort: strip HTML tags
  const rawBody =
    payload.reply_plain ??
    payload.plain ??
    payload.html?.replace(/<[^>]+>/g, ' ') ??
    '';

  // Priority 1: URL in body → scrape
  const urlMatch = URL_RE.exec(rawBody);
  if (urlMatch) {
    // Strip trailing punctuation that's not part of the URL
    const url = urlMatch[0].replace(/[.,;)]+$/, '');
    return { type: 'scrape', url };
  }

  // Priority 2: Announcement-style subject
  if (ANNOUNCEMENT_RE.test(normalizedSubject)) {
    const title = normalizedSubject.replace(ANNOUNCEMENT_RE, '').trim();
    const body = payload.plain ?? payload.html?.replace(/<[^>]+>/g, ' ') ?? '';
    return { type: 'announcement', title, body };
  }

  // Priority 3: Plain event description
  const body = payload.plain ?? payload.html?.replace(/<[^>]+>/g, ' ') ?? '';
  return { type: 'event', body };
}
