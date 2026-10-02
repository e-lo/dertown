import { readFileSync } from 'node:fs';
import { validateEventForm } from '../validation';
import { describeValidationIssues, describeSubmitFailure } from '../form-errors';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing public event submission validation and error messages\n');

const base = { title: 'Test Event', start_date: '2026-07-01' };

// A checked checkbox arrives from FormData as the string "true" (its value
// attribute); the schema used to demand a boolean and reject every submission
// with "Registration required" ticked.
const checked = validateEventForm({ ...base, registration: 'true' });
check('registration: checked checkbox ("true") accepted', checked.success);
check(
  'registration: checked checkbox parsed to true',
  checked.success && checked.data.registration === true
);

const checkedOn = validateEventForm({ ...base, registration: 'on' });
check(
  'registration: default checkbox value ("on") parsed to true',
  checkedOn.success && checkedOn.data.registration === true
);

const unchecked = validateEventForm(base);
check(
  'registration: unchecked (omitted) accepted',
  unchecked.success && unchecked.data.registration === undefined
);

// The client re-sends its own parsed output, so a real boolean must still pass.
const bool = validateEventForm({ ...base, registration: true });
check('registration: boolean true accepted', bool.success && bool.data.registration === true);

const junk = validateEventForm({ ...base, registration: 'maybe' });
check('registration: unrecognised string rejected', !junk.success);

// Client-side validation errors name the field so the submitter can fix it.
const badEmail = validateEventForm({ ...base, email: 'not-an-email' });
check('issues: invalid email rejected', !badEmail.success);
if (!badEmail.success) {
  const message = describeValidationIssues(badEmail.error.issues);
  check('issues: message names the field', message.includes('email'));
  check('issues: message includes the reason', message.includes('Invalid email format'));
}

// Server error bodies are { error, details? } — never { message }.
check(
  'server: uses the error field',
  describeSubmitFailure({ error: 'Database insert failed', details: 'boom' }) ===
    'Database insert failed'
);
check(
  'server: lists field errors from a flattened Zod error',
  describeSubmitFailure({
    error: 'Validation failed',
    details: { formErrors: [], fieldErrors: { website: ['Invalid URL format'] } },
  }) === 'Validation failed\nwebsite: Invalid URL format'
);
check(
  'server: falls back when the body is not JSON',
  describeSubmitFailure(null) === 'Failed to submit event. Please try again.'
);

// Staging tables are admin-only under RLS, so public submissions must be
// written with the service role. An anon-client insert fails every submission
// with "new row violates row-level security policy".
const supabaseSource = readFileSync(new URL('../supabase.ts', import.meta.url), 'utf8');
for (const helper of ['eventsStaged', 'announcementsStaged']) {
  const block =
    supabaseSource.match(new RegExp(`\\b${helper}: \\{([\\s\\S]*?)\\n  \\},`))?.[1] ?? '';
  check(`rls: ${helper} helper found`, block.length > 0);
  check(
    `rls: ${helper} never uses the anon client`,
    block.length > 0 && !/\bsupabase\.from\(/.test(block)
  );
}

console.log(`\n${failures === 0 ? '✅ All tests passed' : `❌ ${failures} test(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
