/**
 * Auth cookie reading.
 *
 * The reported bug: every public page that checks admin access
 * (/events/<id>, /locations/<id>, /organizations/<id>, /admin/users) returned
 * HTTP 500 to any request that sent NO Cookie header at all — search engine and
 * social-media crawlers, among others. Those pages call
 * `checkAdminAccess({ cookieHeader })` where the header defaults to '', and the
 * raw-header branch was selected by the header's TRUTHINESS. An empty string is
 * falsy, so a cookieless request fell through to the Astro-cookie branch and
 * called `.get()` on a plain object: `TypeError: cookies.get is not a function`.
 *
 * Real browsers almost always carry some cookie (analytics, at minimum), which
 * is why this only ever showed up for bots.
 */
import { readAuthTokens, isRawCookieHeader } from '../auth-cookies';

let failures = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${label}`);
  } catch (e) {
    console.log(`❌ FAIL: ${label}\n        ${(e as Error).message}`);
    failures++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

/** Stands in for `Astro.cookies`. */
function cookieStore(values: Record<string, string>) {
  return { get: (name: string) => (name in values ? { value: values[name] } : undefined) };
}

console.log('🧪 Auth cookie reading\n');

// --- The regression ---------------------------------------------------------

check('a cookieless request is read as a raw header, not an Astro cookie store', () => {
  assert(
    isRawCookieHeader({ cookieHeader: '' }),
    'an empty Cookie header was routed to the Astro-cookie branch, where .get() ' +
      'does not exist — this is the 500 on every public page for crawlers'
  );
});

check('a cookieless request yields no tokens instead of throwing', () => {
  const tokens = readAuthTokens({ cookieHeader: '' });
  assert(tokens.accessToken === undefined, 'invented an access token from an empty header');
  assert(tokens.refreshToken === undefined, 'invented a refresh token from an empty header');
});

// --- The paths that already worked, so the fix does not trade one for another ---

check('a raw header carrying a session yields both tokens', () => {
  const tokens = readAuthTokens({
    cookieHeader: '_ga=GA1.1.123; sb-access-token=access-abc; sb-refresh-token=refresh-xyz',
  });
  assert(tokens.accessToken === 'access-abc', `access token was ${tokens.accessToken}`);
  assert(tokens.refreshToken === 'refresh-xyz', `refresh token was ${tokens.refreshToken}`);
});

check('a raw header with unrelated cookies only yields no tokens', () => {
  const tokens = readAuthTokens({ cookieHeader: '_ga=GA1.1.123; theme=dark' });
  assert(tokens.accessToken === undefined, 'matched a non-auth cookie as the access token');
  assert(tokens.refreshToken === undefined, 'matched a non-auth cookie as the refresh token');
});

check('a raw header URL-decodes cookie values', () => {
  const tokens = readAuthTokens({ cookieHeader: 'sb-access-token=a%20b%2Bc' });
  assert(tokens.accessToken === 'a b+c', `access token was ${tokens.accessToken}`);
});

check('a present-but-empty cookie falls through to the next name', () => {
  const tokens = readAuthTokens({
    cookieHeader: 'sb-access-token=; supabase-auth-token=legacy-access',
  });
  assert(tokens.accessToken === 'legacy-access', `access token was ${tokens.accessToken}`);
});

check('legacy and local-stack cookie names are still honored', () => {
  const legacy = readAuthTokens({
    cookieHeader: 'supabase-auth-token=legacy-access; supabase-refresh-token=legacy-refresh',
  });
  assert(legacy.accessToken === 'legacy-access', `access token was ${legacy.accessToken}`);
  assert(legacy.refreshToken === 'legacy-refresh', `refresh token was ${legacy.refreshToken}`);

  const local = readAuthTokens({
    cookieHeader: 'sb-localhost-auth-token=local-access; sb-localhost-refresh-token=local-refresh',
  });
  assert(local.accessToken === 'local-access', `access token was ${local.accessToken}`);
  assert(local.refreshToken === 'local-refresh', `refresh token was ${local.refreshToken}`);
});

check('an Astro cookie store carrying a session yields both tokens', () => {
  const tokens = readAuthTokens(
    cookieStore({ 'sb-access-token': 'access-abc', 'sb-refresh-token': 'refresh-xyz' })
  );
  assert(tokens.accessToken === 'access-abc', `access token was ${tokens.accessToken}`);
  assert(tokens.refreshToken === 'refresh-xyz', `refresh token was ${tokens.refreshToken}`);
});

check('an empty Astro cookie store yields no tokens instead of throwing', () => {
  const tokens = readAuthTokens(cookieStore({}));
  assert(tokens.accessToken === undefined, 'invented an access token from an empty store');
  assert(tokens.refreshToken === undefined, 'invented a refresh token from an empty store');
});

console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
