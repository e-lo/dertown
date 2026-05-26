import type { CloudMailinPayload, EmailIntent } from './types';

const ANNOUNCEMENT_RE = /^(add\s+)?announcement[:\s]/i;
const URL_RE = /https?:\/\/[^\s<>"]+/;

export function parseIntent(payload: CloudMailinPayload): EmailIntent {
  const subject = payload.headers?.subject ?? '';
  const body = payload.plain ?? '';

  // Priority 1: URL in body → scrape
  const urlMatch = URL_RE.exec(body);
  if (urlMatch) {
    return { type: 'scrape', url: urlMatch[0] };
  }

  // Priority 2: Announcement-style subject
  if (ANNOUNCEMENT_RE.test(subject)) {
    const title = subject.replace(ANNOUNCEMENT_RE, '').trim();
    return { type: 'announcement', title, body };
  }

  // Priority 3: Plain event description
  return { type: 'event', body };
}
