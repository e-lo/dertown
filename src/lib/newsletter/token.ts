/**
 * Signed, stateless confirmation tokens for newsletter double opt-in.
 *
 * Format: `base64url(JSON {e: email, t: issuedAtMs}).base64url(HMAC-SHA256)`.
 * No database row is needed: the signature proves we issued the link, and the
 * timestamp bounds how long it stays valid.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signConfirmToken(email: string, secret: string, now: Date): string {
  const payload = Buffer.from(JSON.stringify({ e: email, t: now.getTime() })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** The confirmed email, or null when the token is malformed, forged, or expired. */
export function verifyConfirmToken(token: string, secret: string, now: Date): string | null {
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const { e, t } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      e?: unknown;
      t?: unknown;
    };
    if (typeof e !== 'string' || typeof t !== 'number') return null;
    const age = now.getTime() - t;
    if (age < 0 || age > CONFIRM_TOKEN_TTL_MS) return null;
    return normalizeEmail(e);
  } catch {
    return null;
  }
}
