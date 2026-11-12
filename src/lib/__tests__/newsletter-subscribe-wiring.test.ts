/**
 * Wiring checks for the newsletter signup: the footer renders the form, the
 * endpoint uses the newsletter key (never the transactional one), and the
 * confirm page verifies the token before subscribing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

const read = (path: string) => {
  try {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
  } catch {
    return '';
  }
};

function runTests(): boolean {
  console.log('🧪 Testing newsletter signup wiring\n');
  const footer = read('src/components/Footer.astro');
  const signup = read('src/components/NewsletterSignup.astro');
  const subscribe = read('src/pages/api/newsletter/subscribe.ts');
  const confirm = read('src/pages/newsletter/confirm.astro');
  const envExample = read('env.example');
  const privacy = read('src/pages/privacy.astro');
  let allTestsPassed = true;

  allTestsPassed =
    check('footer renders signup', footer.includes('<NewsletterSignup'), true) && allTestsPassed;
  allTestsPassed =
    check('honeypot field', signup.includes('name="website"'), true) && allTestsPassed;
  allTestsPassed =
    check('signup posts to the endpoint', signup.includes('/api/newsletter/subscribe'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('signup sends time-to-fill', signup.includes('elapsed_ms'), true) && allTestsPassed;
  allTestsPassed =
    check(
      'endpoint rejects too-fast submissions',
      subscribe.includes('elapsed_ms') && subscribe.includes('SPAM_RATE_LIMIT_MS'),
      true
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'endpoint tolerates a JSON null body',
      subscribe.includes('.catch(() => null)) ?? {}'),
      true
    ) && allTestsPassed;
  allTestsPassed =
    check('endpoint not prerendered', subscribe.includes('export const prerender = false'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('endpoint uses newsletter key', subscribe.includes('RESEND_NEWSLETTER_API_KEY'), true) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'endpoint does not use transactional key',
      subscribe.includes('env.RESEND_API_KEY'),
      false
    ) && allTestsPassed;
  allTestsPassed =
    check('endpoint signs a confirm token', subscribe.includes('signConfirmToken'), true) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'confirm page not prerendered',
      confirm.includes('export const prerender = false'),
      true
    ) && allTestsPassed;
  allTestsPassed =
    check('confirm page verifies token', confirm.includes('verifyConfirmToken'), true) &&
    allTestsPassed;
  allTestsPassed =
    check('confirm page adds subscriber', confirm.includes('addConfirmedSubscriber'), true) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'env.example documents newsletter vars',
      [
        'RESEND_NEWSLETTER_API_KEY',
        'RESEND_NEWSLETTER_SEGMENT_ID',
        'NEWSLETTER_FROM_EMAIL',
        'NEWSLETTER_SIGNING_SECRET',
      ].every((k) => envExample.includes(k)),
      true
    ) && allTestsPassed;
  allTestsPassed =
    check('privacy page mentions the newsletter', /newsletter/i.test(privacy), true) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'confirm page subscribes only on POST (link scanners prefetch GETs)',
      /Astro\.request\.method === 'POST'/.test(confirm) && /<form[^>]*method="post"/.test(confirm),
      true
    ) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
