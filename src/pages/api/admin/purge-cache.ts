import { purgeCache } from '@netlify/functions';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { SITE_CACHE_TAG } from '@/lib/cache';

export const prerender = false;

/**
 * Force the public site to re-read from the database.
 *
 * Public pages are CDN-cached for hours (see src/lib/cache.ts) so that normal
 * traffic doesn't invoke a function per view. Editing does not invalidate that
 * cache automatically — an approve-by-approve auto-purge would keep the cache
 * cold through an editing session (and Netlify rate-limits a tag to two purges
 * per five seconds). Instead the admin finishes their edits and purges once.
 *
 * Admin pages are never cached, so the admin UI always shows live data
 * regardless of when this last ran.
 *
 * POST with no body to clear everything, or `{"tags": ["events"]}` to clear a
 * subset. Purging is global and takes effect within a few seconds.
 */
export const POST = withAdminAuth(async ({ request }) => {
  let tags: string[] = [SITE_CACHE_TAG];

  // A bodyless POST is the common case (the admin header button sends none).
  try {
    const body = await request.json();
    if (Array.isArray(body?.tags) && body.tags.length > 0) {
      tags = body.tags.filter((tag: unknown): tag is string => typeof tag === 'string');
    }
  } catch {
    // No JSON body — fall through to purging the whole public site.
  }

  try {
    await purgeCache({ tags });
  } catch (error) {
    // purgeCache throws on a non-2xx from the Purge API, and is a logged no-op
    // in local dev. Surface the failure so the admin knows the site is stale.
    console.error('[purge-cache] Purge failed:', error);
    return jsonError(
      `Cache purge failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  return jsonResponse({ purged: tags });
});
