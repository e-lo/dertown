/**
 * Reads Supabase auth tokens out of whichever "cookies" shape a caller has.
 *
 * Pages and API routes pass one of two things: Astro's cookie object
 * (`Astro.cookies`), or a raw `Cookie` header wrapped as `{ cookieHeader }` —
 * the latter because `Astro.cookies` has not always reflected what the browser
 * actually sent on SSR routes.
 *
 * Kept separate from src/lib/session.ts so it can be unit-tested: session.ts
 * pulls in src/lib/supabase.ts, which reads `import.meta.env` at module load
 * and therefore cannot be imported outside a Vite/Astro build.
 */

/** A raw `Cookie` request header, wrapped so callers can pass it by name. */
export interface RawCookieHeader {
  cookieHeader: string;
}

/** The subset of `Astro.cookies` this module uses. */
export interface CookieStore {
  get(name: string): { value?: string } | undefined;
}

export type CookieSource = RawCookieHeader | CookieStore;

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Cookie names to try, oldest deployments last. Supabase's own naming has
 * changed across versions and the local stack uses its own prefix, so a session
 * may live under any of these.
 */
const ACCESS_TOKEN_COOKIES = [
  'sb-access-token',
  'supabase-auth-token',
  'sb-localhost-auth-token',
] as const;

const REFRESH_TOKEN_COOKIES = [
  'sb-refresh-token',
  'supabase-refresh-token',
  'sb-localhost-refresh-token',
] as const;

/**
 * True when `source` is a raw header rather than an Astro cookie store.
 *
 * Branches on the argument's SHAPE, never on whether a header is present. A
 * request with no cookies at all — every crawler — arrives as `cookieHeader:
 * ''`, and testing that for truthiness sent it down the cookie-store path,
 * where `.get()` does not exist. The resulting TypeError threw before the
 * page's own not-found redirect, 500-ing every public page that checks admin
 * access.
 */
export function isRawCookieHeader(source: CookieSource): source is RawCookieHeader {
  return typeof (source as CookieStore).get !== 'function';
}

function fromHeader(cookieHeader: string, names: readonly string[]): string | undefined {
  for (const name of names) {
    const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    // A present-but-empty cookie is not a token: fall through to the next name.
    const value = match ? decodeURIComponent(match[1]) : undefined;
    if (value) return value;
  }
  return undefined;
}

function fromStore(store: CookieStore, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = store.get(name)?.value;
    if (value) return value;
  }
  return undefined;
}

/** Pulls the access and refresh tokens out of either cookie shape. */
export function readAuthTokens(source: CookieSource): AuthTokens {
  if (isRawCookieHeader(source)) {
    const { cookieHeader } = source as RawCookieHeader;
    return {
      accessToken: fromHeader(cookieHeader, ACCESS_TOKEN_COOKIES),
      refreshToken: fromHeader(cookieHeader, REFRESH_TOKEN_COOKIES),
    };
  }

  const store = source as CookieStore;
  return {
    accessToken: fromStore(store, ACCESS_TOKEN_COOKIES),
    refreshToken: fromStore(store, REFRESH_TOKEN_COOKIES),
  };
}
