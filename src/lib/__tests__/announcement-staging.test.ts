import { buildStagedAnnouncement } from '../announcement-staging';
import { validateAnnouncementForm } from '../validation';
import { ANNOUNCEMENT_DEFAULT_EXPIRY_DAYS } from '../constants';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing staged-announcement insert builder\n');

// Helper: validate raw form input the way the API route does, then build.
function buildFrom(raw: Record<string, unknown>, organizationName: string | null = null) {
  const result = validateAnnouncementForm(raw);
  if (!result.success) {
    throw new Error('validation failed: ' + JSON.stringify(result.error.flatten()));
  }
  return buildStagedAnnouncement(result.data, organizationName);
}

// The reported bug: the route computed show_at/expires_at/comments/author/org
// then dropped them before the DB insert. Every intended field must survive.
const full = buildFrom({
  title: 'Spring Cleanup',
  message: 'Join us Saturday',
  link: 'example.org/cleanup',
  email: 'host@example.org',
  author: 'Jane Doe',
  comments: 'For moderators only',
  show_at: '2026-07-01T09:00:00',
  expires_at: '2026-07-10T09:00:00',
});

check('persists comments', full.comments === 'For moderators only');
check('persists author', full.author === 'Jane Doe');
check('persists normalized link', full.link === 'https://example.org/cleanup');
check('persists email', full.email === 'host@example.org');
check('persists explicit show_at', full.show_at === new Date('2026-07-01T09:00:00').toISOString());
check(
  'persists explicit expires_at',
  full.expires_at === new Date('2026-07-10T09:00:00').toISOString()
);
check('status is pending', full.status === 'pending');

// author must be captured by the schema (it was previously absent from the
// schema, so it was always stripped to undefined).
const validated = validateAnnouncementForm({
  title: 'T',
  message: 'M',
  author: 'Sam',
});
check('schema captures author', validated.success && validated.data.author === 'Sam');

// expires_at defaults to show_at + N days when omitted.
const defaulted = buildFrom({
  title: 'T',
  message: 'M',
  show_at: '2026-07-01T00:00:00',
});
const expectedExpiry = new Date('2026-07-01T00:00:00');
expectedExpiry.setDate(expectedExpiry.getDate() + ANNOUNCEMENT_DEFAULT_EXPIRY_DAYS);
check(
  'expires_at defaults to show_at + N days',
  defaulted.expires_at === expectedExpiry.toISOString()
);

// show_at defaults to "now" when omitted (just assert it's a valid ISO string).
const noShow = buildFrom({ title: 'T', message: 'M' });
check(
  'show_at defaults to a timestamp',
  typeof noShow.show_at === 'string' && noShow.show_at!.length > 0
);

// Organization mapping: existing org resolved to a NAME goes in `organization`.
const existingOrg = buildFrom(
  { title: 'T', message: 'M', organization_id: '11111111-1111-4111-8111-111111111111' },
  'Rotary Club'
);
check('existing org stored as name', existingOrg.organization === 'Rotary Club');
check('existing org leaves organization_added null', existingOrg.organization_added === null);

// New org (free text) goes in `organization_added` when no existing org resolved.
const newOrg = buildFrom({ title: 'T', message: 'M', organization_added: 'New Garden Club' });
check('new org stored in organization_added', newOrg.organization_added === 'New Garden Club');
check('new org leaves organization null', newOrg.organization === null);

// Existing org takes precedence over a stray organization_added.
const both = buildFrom({ title: 'T', message: 'M', organization_added: 'Ignore Me' }, 'Real Org');
check(
  'resolved org wins over organization_added',
  both.organization === 'Real Org' && both.organization_added === null
);

console.log(`\n${failures === 0 ? '✅ All tests passed' : `❌ ${failures} test(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
