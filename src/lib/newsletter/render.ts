/**
 * Email-safe HTML and plain-text rendering for "This Week in Der Town".
 *
 * Table layout, inline styles only, no <style>/<script>: Gmail and Outlook
 * strip or ignore most else. Every interpolated string goes through
 * escapeHtml, including URLs in attributes.
 */
import { COLORS } from '../config';
import { imageCdnUrl } from '../image';
import type { IssueEntry, IssueEvent, NewsletterIssue } from './types';

export const NEWSLETTER_NAME = 'This Week in Der Town';
const UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}';
const SNIPPET_LENGTH = 200;

/** Email clients don't reliably support 8-digit hex, so drop any alpha channel. */
const toSixDigitHex = (color: string) => color.slice(0, 7);
const PRIMARY = toSixDigitHex(COLORS.primary);
const PRIMARY_DARK = toSixDigitHex(COLORS.primaryDark);
const PRIMARY_LIGHT = toSixDigitHex(COLORS.primaryLight);
const TEXT = '#1f2937';
const MUTED = '#6b7280';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function utcNoon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** '2026-10-30' → 'Friday, Oct 30' */
function dayHeading(date: string): string {
  const d = utcNoon(date);
  return `${WEEKDAY_LONG[d.getUTCDay()]}, ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** '2026-10-29' → 'October 29, 2026' */
function issueDateLabel(date: string): string {
  const d = utcNoon(date);
  return `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Event descriptions are markdown-ish; reduce to a short plain-text snippet. */
function plainSnippet(description: string | null): string | null {
  if (!description) return null;
  const plain = description
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  if (plain.length <= SNIPPET_LENGTH) return plain;
  const cut = plain.slice(0, SNIPPET_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : SNIPPET_LENGTH)}…`;
}

function blurbFor(entry: IssueEntry): string | null {
  return entry.blurb?.trim() || plainSnippet(entry.event.description);
}

/**
 * Link to the first listed occurrence: a collapsed series' `id` is its parent,
 * which is usually excluded from the public calendar and has no public page.
 */
function eventUrl(event: IssueEvent, siteUrl: string): string {
  return `${siteUrl}/events/${encodeURIComponent(event.occurrenceIds[0] ?? event.id)}`;
}

function whenWhere(event: IssueEvent): string {
  return [event.whenLabel, event.locationName].filter(Boolean).join(' · ');
}

function groupByDay(entries: IssueEntry[]): [string, IssueEntry[]][] {
  const days = new Map<string, IssueEntry[]>();
  for (const entry of entries) {
    days.set(entry.event.displayDate, [...(days.get(entry.event.displayDate) ?? []), entry]);
  }
  return [...days.entries()];
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function sectionHeading(title: string): string {
  return `<tr><td style="padding:28px 24px 8px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${PRIMARY};">${escapeHtml(title)}</td></tr>`;
}

function featuredCard(entry: IssueEntry, siteUrl: string): string {
  const { event } = entry;
  const url = escapeHtml(eventUrl(event, siteUrl));
  const image = event.imageUrl
    ? `<a href="${url}"><img src="${escapeHtml(siteUrl + imageCdnUrl(event.imageUrl, { width: 1200, height: 630, fit: 'cover' }))}" width="552" alt="${escapeHtml(event.imageAlt ?? event.title)}" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:8px;"></a>`
    : '';
  const blurb = blurbFor(entry);
  return `<tr><td style="padding:12px 24px 16px;">
${image}
<p style="margin:${image ? '12px' : '0'} 0 4px;font-family:${FONT};font-size:20px;line-height:1.3;font-weight:700;"><a href="${url}" style="color:${TEXT};text-decoration:none;">${escapeHtml(event.title)}</a></p>
<p style="margin:0 0 6px;font-family:${FONT};font-size:14px;color:${MUTED};">${escapeHtml(whenWhere(event))}</p>
${blurb ? `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.5;color:${TEXT};">${escapeHtml(blurb)}</p>` : ''}
</td></tr>`;
}

function compactRow(entry: IssueEntry, siteUrl: string, withBlurb: boolean): string {
  const { event } = entry;
  const blurb = withBlurb ? blurbFor(entry) : null;
  return `<tr><td style="padding:6px 24px;">
<p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.4;font-weight:600;"><a href="${escapeHtml(eventUrl(event, siteUrl))}" style="color:${PRIMARY_DARK};text-decoration:none;">${escapeHtml(event.title)}</a></p>
<p style="margin:2px 0 0;font-family:${FONT};font-size:14px;color:${MUTED};">${escapeHtml(whenWhere(event))}</p>
${blurb ? `<p style="margin:4px 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${TEXT};">${escapeHtml(blurb)}</p>` : ''}
</td></tr>`;
}

function dayHeadingRow(date: string): string {
  return `<tr><td style="padding:14px 24px 2px;font-family:${FONT};font-size:15px;font-weight:700;color:${TEXT};border-top:1px solid #e5e7eb;">${escapeHtml(dayHeading(date))}</td></tr>`;
}

function announcementRows(issue: NewsletterIssue): string {
  if (!issue.announcements?.length) return '';
  return (
    sectionHeading('Announcements') +
    issue.announcements
      .map(
        (a) => `<tr><td style="padding:6px 24px;">
<p style="margin:0;font-family:${FONT};font-size:16px;font-weight:600;color:${TEXT};">${a.url ? `<a href="${escapeHtml(a.url)}" style="color:${PRIMARY_DARK};text-decoration:none;">${escapeHtml(a.title)}</a>` : escapeHtml(a.title)}</p>
<p style="margin:2px 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${TEXT};">${escapeHtml(a.body)}</p>
</td></tr>`
      )
      .join('\n')
  );
}

export function renderNewsletter(issue: NewsletterIssue, opts: { siteUrl: string }): string {
  const { siteUrl } = opts;
  const featured = issue.featured.map((e) => featuredCard(e, siteUrl)).join('\n');
  const thisWeek = groupByDay(issue.thisWeek)
    .map(
      ([date, entries]) =>
        dayHeadingRow(date) + entries.map((e) => compactRow(e, siteUrl, false)).join('\n')
    )
    .join('\n');
  const planAhead = issue.planAhead.map((e) => compactRow(e, siteUrl, true)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(issue.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PRIMARY_LIGHT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(issue.previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PRIMARY_LIGHT};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:24px 24px 16px;background:${PRIMARY};border-radius:12px 12px 0 0;">
<p style="margin:0;font-family:${FONT};font-size:24px;font-weight:800;color:#ffffff;"><a href="${escapeHtml(siteUrl)}" style="color:#ffffff;text-decoration:none;">${escapeHtml(NEWSLETTER_NAME)}</a></p>
<p style="margin:4px 0 0;font-family:${FONT};font-size:14px;color:#ffffff;opacity:0.85;">${escapeHtml(issueDateLabel(issue.sendDate))}</p>
</td></tr>
<tr><td style="padding:20px 24px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${TEXT};">${escapeHtml(issue.intro)}</td></tr>
${issue.featured.length ? sectionHeading('Featured') + featured : ''}
${issue.thisWeek.length ? sectionHeading('This week') + thisWeek : ''}
${issue.planAhead.length ? sectionHeading('Plan ahead') + planAhead : ''}
${announcementRows(issue)}
<tr><td style="padding:28px 24px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};border-top:1px solid #e5e7eb;">
<p style="margin:0 0 8px;">See every event at <a href="${escapeHtml(siteUrl)}" style="color:${PRIMARY};">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>. Details change — please confirm with the organizer.</p>
<p style="margin:0;">You're getting this because you subscribed at dertown.org. <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:${MUTED};">Unsubscribe</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

function textEntry(entry: IssueEntry, siteUrl: string, withBlurb: boolean): string {
  const blurb = withBlurb ? blurbFor(entry) : null;
  return [
    `* ${entry.event.title}`,
    `  ${whenWhere(entry.event)}`,
    blurb ? `  ${blurb}` : null,
    `  ${eventUrl(entry.event, siteUrl)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderNewsletterText(issue: NewsletterIssue, opts: { siteUrl: string }): string {
  const { siteUrl } = opts;
  const sections: string[] = [
    `${NEWSLETTER_NAME} — ${issueDateLabel(issue.sendDate)}`,
    issue.intro,
  ];
  if (issue.featured.length) {
    sections.push(
      `FEATURED\n\n${issue.featured.map((e) => textEntry(e, siteUrl, true)).join('\n\n')}`
    );
  }
  if (issue.thisWeek.length) {
    const days = groupByDay(issue.thisWeek).map(
      ([date, entries]) =>
        `${dayHeading(date)}\n${entries.map((e) => textEntry(e, siteUrl, false)).join('\n')}`
    );
    sections.push(`THIS WEEK\n\n${days.join('\n\n')}`);
  }
  if (issue.planAhead.length) {
    sections.push(
      `PLAN AHEAD\n\n${issue.planAhead.map((e) => textEntry(e, siteUrl, true)).join('\n\n')}`
    );
  }
  if (issue.announcements?.length) {
    sections.push(
      `ANNOUNCEMENTS\n\n${issue.announcements.map((a) => [`* ${a.title}`, `  ${a.body}`, a.url ? `  ${a.url}` : null].filter(Boolean).join('\n')).join('\n\n')}`
    );
  }
  sections.push(`See every event at ${siteUrl}\nUnsubscribe: ${UNSUBSCRIBE_PLACEHOLDER}`);
  return `${sections.join('\n\n')}\n`;
}
