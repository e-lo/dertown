import { normalizeEmail, signConfirmToken, verifyConfirmToken } from '../newsletter/token';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

function runTests(): boolean {
  console.log('🧪 Testing newsletter confirm tokens\n');
  let allTestsPassed = true;
  const now = new Date('2026-10-23T12:00:00Z');
  const token = signConfirmToken('foo@example.com', 'secret-a', now);

  allTestsPassed =
    check(
      'normalizes case and whitespace',
      normalizeEmail('  Foo@Example.COM '),
      'foo@example.com'
    ) && allTestsPassed;
  allTestsPassed = check('rejects junk', normalizeEmail('not an email'), null) && allTestsPassed;
  allTestsPassed =
    check('round trip', verifyConfirmToken(token, 'secret-a', now), 'foo@example.com') &&
    allTestsPassed;
  allTestsPassed =
    check(
      'valid after 6 days',
      verifyConfirmToken(token, 'secret-a', new Date('2026-10-29T12:00:00Z')),
      'foo@example.com'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'expired after 8 days',
      verifyConfirmToken(token, 'secret-a', new Date('2026-10-31T12:00:00Z')),
      null
    ) && allTestsPassed;
  allTestsPassed =
    check('wrong secret', verifyConfirmToken(token, 'secret-b', now), null) && allTestsPassed;
  allTestsPassed =
    check('tampered payload', verifyConfirmToken('x' + token, 'secret-a', now), null) &&
    allTestsPassed;
  allTestsPassed =
    check('garbage', verifyConfirmToken('abc', 'secret-a', now), null) && allTestsPassed;

  const [, signature] = token.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ e: 'evil@example.com', t: now.getTime() })
  ).toString('base64url');
  allTestsPassed =
    check(
      'swapped payload with old signature',
      verifyConfirmToken(`${forgedPayload}.${signature}`, 'secret-a', now),
      null
    ) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
