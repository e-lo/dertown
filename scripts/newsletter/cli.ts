/** Shared helpers for the newsletter CLI scripts (run with tsx, not Astro). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DateWindow } from '../../src/lib/newsletter/dates';
import { NEWSLETTER_NAME } from '../../src/lib/newsletter/render';
import type {
  IssueEvent,
  NewsletterAnnouncement,
  NewsletterIssue,
} from '../../src/lib/newsletter/types';

export const DEFAULT_FROM = 'This Week in Der Town <hello@dertown.org>';
export const DEFAULT_SITE_URL = 'https://dertown.org';

export class CliError extends Error {}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new CliError(`Missing env var ${name} (add it to .env.local)`);
  return value;
}

export function siteUrl(): string {
  return (process.env.SITE || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export interface ParsedArgs {
  positional: string[];
  flags: Set<string>;
  options: Map<string, string>;
}

/** `--name value` options listed in `valued`; any other `--x` is a boolean flag. */
export function parseArgs(argv: string[], valued: string[] = ['dir', 'send-date']): ParsedArgs {
  const parsed: ParsedArgs = { positional: [], flags: new Set(), options: new Map() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      parsed.positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (valued.includes(name)) {
      const value = argv[++i];
      if (!value) throw new CliError(`--${name} needs a value`);
      parsed.options.set(name, value);
    } else {
      parsed.flags.add(name);
    }
  }
  return parsed;
}

export function requireDateKey(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CliError('Expected a send date like 2026-10-29');
  }
  return value;
}

/** Snapshot of one source row, so `verify` can tell what changed since drafting. */
export interface OccurrenceSnapshot {
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
}

export interface IssueSource {
  sendDate: string;
  sendAtIso: string;
  windows: { thisWeek: DateWindow; planAhead: DateWindow };
  thisWeek: IssueEvent[];
  planAhead: IssueEvent[];
  announcements: NewsletterAnnouncement[];
  occurrences: Record<string, OccurrenceSnapshot>;
}

export interface SentRecord {
  broadcastId: string;
  scheduledAt: string | null;
}

export function broadcastName(sendDate: string): string {
  return `${NEWSLETTER_NAME} ${sendDate}`;
}

/**
 * The broadcast already created in Resend for this send date, if any. Checked
 * before creating one so a crash after Resend accepted the broadcast (but
 * before sent.json was written) can't schedule the issue twice.
 */
export function existingBroadcastFor<T extends { id: string; name: string | null }>(
  broadcasts: T[],
  sendDate: string
): T | undefined {
  return broadcasts.find((b) => b.name === broadcastName(sendDate));
}

export function issuePaths(dir: string, sendDate: string) {
  const base = join(resolve(dir), sendDate);
  return {
    source: `${base}.source.json`,
    draft: `${base}.json`,
    html: `${base}.html`,
    text: `${base}.txt`,
    sent: `${base}.sent.json`,
  };
}

export function draftsDir(args: ParsedArgs): string {
  const dir = args.options.get('dir') ?? 'newsletters';
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson<T>(path: string, what: string): T {
  if (!existsSync(path)) throw new CliError(`No ${what} at ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const REQUIRED_ISSUE_FIELDS: (keyof NewsletterIssue)[] = [
  'sendDate',
  'subject',
  'previewText',
  'intro',
  'featured',
  'thisWeek',
  'planAhead',
];

export function readIssue(path: string): NewsletterIssue {
  const issue = readJson<Partial<NewsletterIssue>>(path, 'draft');
  const missing = REQUIRED_ISSUE_FIELDS.filter((field) => issue[field] === undefined);
  if (missing.length) throw new CliError(`Draft ${path} is missing: ${missing.join(', ')}`);
  return issue as NewsletterIssue;
}

/** Run a CLI entry point, printing CliErrors without a stack trace. */
export async function main(fn: () => Promise<number | void>): Promise<void> {
  try {
    process.exit((await fn()) ?? 0);
  } catch (err) {
    console.error(err instanceof CliError ? `Error: ${err.message}` : err);
    process.exit(1);
  }
}
