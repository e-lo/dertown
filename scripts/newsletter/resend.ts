/**
 * Resend side of the newsletter: setup checks, test sends, the pre-send
 * re-check, and scheduling the weekly broadcast.
 *
 *   npm run newsletter -- check-setup
 *   npm run newsletter -- create-segment
 *   npm run newsletter -- test-send <sendDate> <to>
 *   npm run newsletter -- verify <sendDate>
 *   npm run newsletter -- schedule <sendDate> --approved [--send-now]
 *   npm run newsletter -- status <sendDate>
 *   npm run newsletter -- cancel <sendDate>
 *
 * `schedule` only runs with --approved, which the /newsletter skill passes
 * after the editor explicitly approves the issue.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { Resend } from 'resend';
import { sendInstantForKey } from '../../src/lib/newsletter/dates';
import {
  NEWSLETTER_NAME,
  renderNewsletter,
  renderNewsletterText,
} from '../../src/lib/newsletter/render';
import type { NewsletterIssue } from '../../src/lib/newsletter/types';
import {
  broadcastName,
  CliError,
  DEFAULT_FROM,
  existingBroadcastFor,
  draftsDir,
  issuePaths,
  main,
  parseArgs,
  readIssue,
  readJson,
  requireDateKey,
  requireEnv,
  siteUrl,
  writeJson,
  type IssueSource,
  type ParsedArgs,
  type SentRecord,
} from './cli';
import { fetchSnapshots, publicClient } from './supabase';

const MIN_LEAD_MS = 60 * 60 * 1000;
const VERIFY_CHANGED_EXIT = 2;
const UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}';
// What these local commands need. NEWSLETTER_FROM_EMAIL has a default, and
// newsletter signups (when built) run on the site, not here.
const NEWSLETTER_ENV = ['RESEND_NEWSLETTER_API_KEY', 'RESEND_NEWSLETTER_SEGMENT_ID'];

const resendClient = () => new Resend(requireEnv('RESEND_NEWSLETTER_API_KEY'));
const fromAddress = () => process.env.NEWSLETTER_FROM_EMAIL || DEFAULT_FROM;

const pacific = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'full',
    timeStyle: 'short',
  });

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error || !result.data) {
    throw new CliError(`${what} failed: ${result.error?.message ?? 'no data returned'}`);
  }
  return result.data;
}

function allEntries(issue: NewsletterIssue) {
  return [...issue.featured, ...issue.thisWeek, ...issue.planAhead];
}

// ---------------------------------------------------------------------------

async function checkSetup(): Promise<number> {
  const missing = NEWSLETTER_ENV.filter((name) => !process.env[name]);
  console.log(missing.length ? `Missing env vars: ${missing.join(', ')}` : 'Env vars: all set');
  console.log(`Sender: ${fromAddress()}`);
  if (!process.env.RESEND_NEWSLETTER_API_KEY) return 1;

  const resend = resendClient();
  const from = fromAddress();
  const domainName = from.match(/@([^>\s]+)/)?.[1];
  const domains = unwrap(await resend.domains.list(), 'Listing domains');
  const domain = domains.data.find((d) => d.name === domainName);
  console.log(
    domain
      ? `Sender domain ${domain.name}: ${domain.status}`
      : `Sender domain ${domainName ?? '(unparseable)'} is not in this Resend account`
  );

  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID;
  let segmentOk = false;
  if (segmentId) {
    const segment = await resend.segments.get(segmentId);
    segmentOk = !segment.error;
    if (segment.data) {
      const contacts = await resend.contacts.list({ segmentId, limit: 100 });
      const count = contacts.data?.data.length ?? 0;
      console.log(
        `Segment "${segment.data.name}": ${count}${contacts.data?.has_more ? '+' : ''} contacts`
      );
    } else {
      console.log(`Segment ${segmentId}: not found (${segment.error?.message})`);
    }
  } else {
    console.log('Segment: not set — run `npm run newsletter -- create-segment`');
  }

  return missing.length === 0 && domain?.status === 'verified' && segmentOk ? 0 : 1;
}

async function createSegment(): Promise<number> {
  const segment = unwrap(
    await resendClient().segments.create({ name: NEWSLETTER_NAME }),
    'Creating segment'
  );
  console.log(`Created segment "${segment.name}"\nRESEND_NEWSLETTER_SEGMENT_ID=${segment.id}`);
  console.log('Add that line to .env.local and to the Netlify environment variables.');
  return 0;
}

async function testSend(args: ParsedArgs, sendDate: string): Promise<number> {
  const to = args.positional[2];
  if (!to) throw new CliError('Usage: test-send <sendDate> <to>');
  const issue = readIssue(issuePaths(draftsDir(args), sendDate).draft);
  // Transactional sends don't fill the unsubscribe placeholder; point it at the site instead.
  const html = renderNewsletter(issue, { siteUrl: siteUrl() }).replaceAll(
    UNSUBSCRIBE_PLACEHOLDER,
    siteUrl()
  );
  const text = renderNewsletterText(issue, { siteUrl: siteUrl() }).replaceAll(
    UNSUBSCRIBE_PLACEHOLDER,
    siteUrl()
  );
  const sent = unwrap(
    await resendClient().emails.send({
      from: fromAddress(),
      to: [to],
      subject: `[TEST] ${issue.subject}`,
      html,
      text,
    }),
    'Test send'
  );
  console.log(`Sent test to ${to} (id ${sent.id})`);
  return 0;
}

/** Lists picked events that were cancelled or changed since drafting. */
async function verify(args: ParsedArgs, sendDate: string): Promise<number> {
  const paths = issuePaths(draftsDir(args), sendDate);
  const issue = readIssue(paths.draft);
  const source = readJson<IssueSource>(paths.source, 'source data (run newsletter:fetch)');
  const picked = allEntries(issue);
  const ids = [...new Set(picked.flatMap((entry) => entry.event.occurrenceIds))];
  const current = await fetchSnapshots(publicClient(), ids);

  const problems: string[] = [];
  for (const entry of picked) {
    for (const id of entry.event.occurrenceIds) {
      const before = source.occurrences[id];
      const now = current.get(id);
      if (!now) {
        problems.push(
          `"${entry.event.title}" (${id}) is no longer public — cancelled or unpublished`
        );
      } else if (before && JSON.stringify(before) !== JSON.stringify(now)) {
        problems.push(
          `"${entry.event.title}" (${id}) changed: ${JSON.stringify(before)} → ${JSON.stringify(now)}`
        );
      }
    }
  }

  if (problems.length) {
    console.log(`Changes since drafting:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    return VERIFY_CHANGED_EXIT;
  }
  console.log(`All ${ids.length} picked events are unchanged.`);
  return 0;
}

async function schedule(args: ParsedArgs, sendDate: string): Promise<number> {
  if (!args.flags.has('approved')) {
    throw new CliError(
      'Refusing to schedule without --approved. Only pass it after the editor explicitly approves this issue.'
    );
  }
  const paths = issuePaths(draftsDir(args), sendDate);
  if (existsSync(paths.sent)) {
    const sent = readJson<SentRecord>(paths.sent, 'sent record');
    throw new CliError(
      `Issue ${sendDate} is already scheduled (broadcast ${sent.broadcastId}). Cancel it first.`
    );
  }

  const sendNow = args.flags.has('send-now');
  const sendAt = sendInstantForKey(sendDate);
  if (!sendNow && sendAt.getTime() - Date.now() < MIN_LEAD_MS) {
    throw new CliError(
      `Thursday noon (${pacific(sendAt.toISOString())}) is less than an hour away or past. ` +
        'Ask the editor: send now (--send-now) or re-draft for next week.'
    );
  }

  const verified = await verify(args, sendDate);
  if (verified !== 0) {
    console.error(
      'Not scheduled: fix the draft for the changes above, re-render, and get approval again.'
    );
    return verified;
  }

  const resend = resendClient();
  const existing = existingBroadcastFor(
    unwrap(await resend.broadcasts.list({ limit: 100 }), 'Listing broadcasts').data,
    sendDate
  );
  if (existing) {
    writeJson(paths.sent, { broadcastId: existing.id, scheduledAt: existing.scheduled_at });
    throw new CliError(
      `Resend already has a broadcast for ${sendDate} (${existing.id}, ${existing.status}). ` +
        'Recorded it locally; check `status`, or `cancel` it before scheduling again.'
    );
  }

  const issue = readIssue(paths.draft);
  const broadcast = unwrap(
    await resend.broadcasts.create({
      name: broadcastName(sendDate),
      segmentId: requireEnv('RESEND_NEWSLETTER_SEGMENT_ID'),
      from: fromAddress(),
      subject: issue.subject,
      previewText: issue.previewText,
      html: renderNewsletter(issue, { siteUrl: siteUrl() }),
      text: renderNewsletterText(issue, { siteUrl: siteUrl() }),
      send: true,
      ...(sendNow ? {} : { scheduledAt: sendAt.toISOString() }),
    }),
    'Creating broadcast'
  );

  const record: SentRecord = {
    broadcastId: broadcast.id,
    scheduledAt: sendNow ? null : sendAt.toISOString(),
  };
  writeJson(paths.sent, record);
  console.log(
    sendNow
      ? `Sending now (broadcast ${broadcast.id}).`
      : `Scheduled for ${pacific(sendAt.toISOString())} (broadcast ${broadcast.id}).\n` +
          `To cancel: npm run newsletter -- cancel ${sendDate}, or Resend dashboard → Broadcasts.`
  );
  return 0;
}

async function status(args: ParsedArgs, sendDate: string): Promise<number> {
  const sent = readJson<SentRecord>(issuePaths(draftsDir(args), sendDate).sent, 'sent record');
  const broadcast = unwrap(
    await resendClient().broadcasts.get(sent.broadcastId),
    'Loading broadcast'
  );
  console.log(
    `Broadcast ${broadcast.id}: ${broadcast.status}` +
      (broadcast.scheduled_at ? `, scheduled ${pacific(broadcast.scheduled_at)}` : '') +
      (broadcast.sent_at ? `, sent ${pacific(broadcast.sent_at)}` : '')
  );
  return 0;
}

async function cancel(args: ParsedArgs, sendDate: string): Promise<number> {
  const paths = issuePaths(draftsDir(args), sendDate);
  const sent = readJson<SentRecord>(paths.sent, 'sent record');
  unwrap(await resendClient().broadcasts.remove(sent.broadcastId), 'Cancelling broadcast');
  unlinkSync(paths.sent);
  console.log(
    `Cancelled broadcast ${sent.broadcastId}. The draft is kept; you can schedule again.`
  );
  return 0;
}

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const [command, dateArg] = args.positional;
  switch (command) {
    case 'check-setup':
      return checkSetup();
    case 'create-segment':
      return createSegment();
    case 'test-send':
      return testSend(args, requireDateKey(dateArg));
    case 'verify':
      return verify(args, requireDateKey(dateArg));
    case 'schedule':
      return schedule(args, requireDateKey(dateArg));
    case 'status':
      return status(args, requireDateKey(dateArg));
    case 'cancel':
      return cancel(args, requireDateKey(dateArg));
    default:
      throw new CliError(
        `Unknown command "${command ?? ''}". Commands: check-setup, create-segment, test-send, verify, schedule, status, cancel`
      );
  }
});
