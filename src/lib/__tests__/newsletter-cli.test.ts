/**
 * CLI guard rails for the newsletter scripts: scheduling refuses without an
 * explicit --approved flag, and render turns a draft JSON into HTML + text.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { NewsletterIssue } from '../newsletter/types';
import { existingBroadcastFor } from '../../../scripts/newsletter/cli';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

const TSX = resolve(process.cwd(), 'node_modules/.bin/tsx');
const EMPTY_ENV = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };

function run(script: string, args: string[]) {
  return spawnSync(TSX, [resolve(process.cwd(), script), ...args], {
    env: EMPTY_ENV,
    encoding: 'utf8',
  });
}

const issue: NewsletterIssue = {
  sendDate: '2026-10-29',
  subject: 'Test issue',
  previewText: 'Preview',
  intro: 'Hello.',
  featured: [],
  thisWeek: [
    {
      event: {
        id: 'evt-1',
        title: 'Pumpkin Walk',
        displayDate: '2026-10-30',
        whenLabel: 'Fri, Oct 30 · 6pm',
        locationName: null,
        imageUrl: null,
        imageAlt: null,
        description: null,
        featured: false,
        tag: null,
        occurrenceIds: ['evt-1'],
      },
    },
  ],
  planAhead: [],
};

function runTests(): boolean {
  console.log('🧪 Testing newsletter CLI\n');
  let allTestsPassed = true;
  const dir = mkdtempSync(join(tmpdir(), 'newsletter-cli-'));

  const unapproved = run('scripts/newsletter/resend.ts', ['schedule', '2026-10-29', '--dir', dir]);
  allTestsPassed =
    check('schedule without --approved fails', unapproved.status !== 0, true) && allTestsPassed;
  allTestsPassed =
    check('schedule explains --approved', unapproved.stderr.includes('--approved'), true) &&
    allTestsPassed;

  const unknown = run('scripts/newsletter/resend.ts', ['bogus']);
  allTestsPassed = check('unknown command fails', unknown.status !== 0, true) && allTestsPassed;

  writeFileSync(join(dir, '2026-10-29.json'), JSON.stringify(issue));
  const rendered = run('scripts/newsletter/render.ts', ['2026-10-29', '--dir', dir]);
  allTestsPassed = check('render exits 0', rendered.status, 0) && allTestsPassed;
  allTestsPassed =
    check('render writes html', existsSync(join(dir, '2026-10-29.html')), true) && allTestsPassed;
  allTestsPassed =
    check('render writes text', existsSync(join(dir, '2026-10-29.txt')), true) && allTestsPassed;
  allTestsPassed =
    check(
      'rendered html has the event',
      existsSync(join(dir, '2026-10-29.html')) &&
        readFileSync(join(dir, '2026-10-29.html'), 'utf8').includes('Pumpkin Walk'),
      true
    ) && allTestsPassed;

  writeFileSync(join(dir, '2026-11-05.json'), JSON.stringify({ sendDate: '2026-11-05' }));
  const invalid = run('scripts/newsletter/render.ts', ['2026-11-05', '--dir', dir]);
  allTestsPassed =
    check('render rejects incomplete draft', invalid.status !== 0, true) && allTestsPassed;
  allTestsPassed =
    check('render names the missing field', invalid.stderr.includes('subject'), true) &&
    allTestsPassed;

  const broadcasts = [
    { id: 'b-old', name: 'This Week in Der Town 2026-10-22', status: 'sent' },
    { id: 'b-1', name: 'This Week in Der Town 2026-10-29', status: 'queued' },
  ];
  allTestsPassed =
    check(
      'finds an existing broadcast for the send date',
      existingBroadcastFor(broadcasts, '2026-10-29')?.id,
      'b-1'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'no broadcast for another date',
      existingBroadcastFor(broadcasts, '2026-11-05'),
      undefined
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'schedule checks Resend for an existing broadcast before creating',
      /existingBroadcastFor\([\s\S]*broadcasts\.create/.test(
        readFileSync(resolve(process.cwd(), 'scripts/newsletter/resend.ts'), 'utf8')
      ),
      true
    ) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
