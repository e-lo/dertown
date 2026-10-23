import { renderConfirmEmail, renderNewsletter, renderNewsletterText } from '../newsletter/render';
import type { IssueEvent, NewsletterIssue } from '../newsletter/types';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

function event(partial: Partial<IssueEvent> & { id: string }): IssueEvent {
  return {
    title: `Event ${partial.id}`,
    displayDate: '2026-10-30',
    whenLabel: 'Fri, Oct 30 · 7pm',
    locationName: 'Festhalle',
    imageUrl: 'https://cdn.example/img.jpg',
    imageAlt: 'A crowd',
    description: 'A fun evening.',
    featured: false,
    tag: 'Music',
    occurrenceIds: [partial.id],
    ...partial,
  };
}

const opts = { siteUrl: 'https://dertown.org' };

const issue: NewsletterIssue = {
  sendDate: '2026-10-29',
  subject: 'Halloween weekend in Der Town',
  previewText: 'Costumes, concerts, and a pumpkin walk',
  intro: 'Spooky season is here & so are the events.',
  featured: [
    { event: event({ id: 'evt-1', title: 'Beer & <b>Brats</b>' }), blurb: 'Grab a "brat".' },
  ],
  thisWeek: [
    { event: event({ id: 'evt-2', displayDate: '2026-10-30' }) },
    { event: event({ id: 'evt-3', displayDate: '2026-10-31', whenLabel: 'Sat, Oct 31 · 10am' }) },
  ],
  planAhead: [
    { event: event({ id: 'evt-4', displayDate: '2026-11-20' }), blurb: 'Tickets go fast.' },
  ],
};

const sparse = event({
  id: 'evt-s',
  imageUrl: null,
  imageAlt: null,
  locationName: null,
  description: null,
  tag: null,
});
const sparseIssue: NewsletterIssue = {
  ...issue,
  featured: [{ event: sparse }],
  thisWeek: [{ event: sparse }],
  planAhead: [{ event: sparse }],
};

const countImgTags = (html: string) => (html.match(/<img\b/gi) ?? []).length;

function runTests(): boolean {
  console.log('🧪 Testing newsletter rendering\n');
  let allTestsPassed = true;
  const html = renderNewsletter(issue, opts);

  allTestsPassed =
    check('unsubscribe placeholder', html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'), true) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'event link is absolute',
      html.includes('href="https://dertown.org/events/evt-1"'),
      true
    ) && allTestsPassed;
  allTestsPassed =
    check('raw markup in a title is not rendered', html.includes('Beer & <b>Brats</b>'), false) &&
    allTestsPassed;
  allTestsPassed =
    check('title is escaped', html.includes('Beer &amp; &lt;b&gt;Brats&lt;/b&gt;'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('blurb quotes are escaped', html.includes('Grab a &quot;brat&quot;.'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('intro is escaped', html.includes('here &amp; so are'), true) && allTestsPassed;
  allTestsPassed =
    check('no image means no img tag', countImgTags(renderNewsletter(sparseIssue, opts)), 0) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'no null/undefined leaks',
      /\b(null|undefined)\b/.test(renderNewsletter(sparseIssue, opts)),
      false
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'day headings',
      html.includes('Friday, Oct 30') && html.includes('Saturday, Oct 31'),
      true
    ) && allTestsPassed;
  allTestsPassed =
    check('no style or script tags', /<(style|script)\b/i.test(html), false) && allTestsPassed;
  allTestsPassed =
    check('newsletter name in header', html.includes('This Week in Der Town'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('preview text present', html.includes('Costumes, concerts, and a pumpkin walk'), true) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'featured image goes through the image CDN',
      html.includes('https://dertown.org/.netlify/images?url='),
      true
    ) && allTestsPassed;

  const text = renderNewsletterText(issue, opts);
  allTestsPassed =
    check('text version has links', text.includes('https://dertown.org/events/evt-1'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('text version is not escaped', text.includes('Beer & <b>Brats</b>'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('text version has unsubscribe', text.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'), true) &&
    allTestsPassed;

  const seriesIssue: NewsletterIssue = {
    ...issue,
    featured: [],
    thisWeek: [{ event: event({ id: 'parent-1', occurrenceIds: ['child-1', 'child-2'] }) }],
    planAhead: [],
  };
  const seriesHtml = renderNewsletter(seriesIssue, opts);
  allTestsPassed =
    check(
      'series links to its first public occurrence, not the hidden parent',
      [seriesHtml.includes('/events/child-1"'), seriesHtml.includes('/events/parent-1"')],
      [true, false]
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'text version links series to first occurrence',
      renderNewsletterText(seriesIssue, opts).includes('/events/child-1'),
      true
    ) && allTestsPassed;

  const confirm = renderConfirmEmail('https://dertown.org/newsletter/confirm?token=abc&x=1');
  allTestsPassed =
    check(
      'confirm subject',
      confirm.subject,
      'Confirm your subscription to This Week in Der Town'
    ) && allTestsPassed;
  allTestsPassed =
    check('confirm html has escaped url', confirm.html.includes('token=abc&amp;x=1'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('confirm text has url', confirm.text.includes('token=abc&x=1'), true) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
