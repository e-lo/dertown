import { validateEventForm, validateAnnouncementForm } from '../validation';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing public-submission URL normalization\n');

// The reported bug: public submissions reject a bare domain like "google.com"
// instead of prefacing it with https:// the way the admin forms do.
const eventResult = validateEventForm({
  title: 'Test Event',
  start_date: '2026-07-01',
  website: 'google.com',
  registration_link: 'www.example.com/register',
  external_image_url: 'https://cdn.example.com/img.jpg',
});

check('event: bare website accepted', eventResult.success);
if (eventResult.success) {
  check(
    'event: website prefaced with https://',
    eventResult.data.website === 'https://google.com'
  );
  check(
    'event: registration_link prefaced with https://',
    eventResult.data.registration_link === 'https://www.example.com/register'
  );
  check(
    'event: already-qualified URL left untouched',
    eventResult.data.external_image_url === 'https://cdn.example.com/img.jpg'
  );
}

// mailto: and other schemes must pass through untouched (not get an https:// prefix).
const mailtoResult = validateEventForm({
  title: 'Test Event',
  start_date: '2026-07-01',
  website: 'mailto:hello@example.com',
});
check('event: mailto: scheme accepted', mailtoResult.success);
if (mailtoResult.success) {
  check(
    'event: mailto: left untouched',
    mailtoResult.data.website === 'mailto:hello@example.com'
  );
}

// Empty/omitted URL fields stay optional.
const emptyResult = validateEventForm({
  title: 'Test Event',
  start_date: '2026-07-01',
  website: '',
});
check('event: empty website still valid', emptyResult.success);

// Announcements: same behavior on the link field.
const annResult = validateAnnouncementForm({
  title: 'Test Announcement',
  message: 'Hello',
  link: 'example.org',
});
check('announcement: bare link accepted', annResult.success);
if (annResult.success) {
  check(
    'announcement: link prefaced with https://',
    annResult.data.link === 'https://example.org'
  );
}

const annMailto = validateAnnouncementForm({
  title: 'Test Announcement',
  message: 'Hello',
  link: 'mailto:contact@example.org',
});
check('announcement: mailto: link accepted', annMailto.success);
if (annMailto.success) {
  check(
    'announcement: mailto: link left untouched',
    annMailto.data.link === 'mailto:contact@example.org'
  );
}

console.log(`\n${failures === 0 ? '✅ All tests passed' : `❌ ${failures} test(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
