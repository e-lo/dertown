/**
 * CDN caching for public, on-demand-rendered responses.
 *
 * Every request to an SSR page or API route costs a Netlify function
 * invocation. Public responses are byte-identical for every anonymous visitor,
 * so we let Netlify's CDN answer repeat requests from the edge instead. A cache
 * hit never invokes the function and is not billed as one.
 *
 * Freshness is handled by explicit invalidation rather than a short TTL: the
 * "Refresh public site" button in the admin header purges the cache (see
 * src/pages/api/admin/purge-cache.ts). The TTL below is only the backstop for
 * when nobody remembers to press it.
 */

/** Longest the public site may lag the database without an explicit purge. */
const CDN_TTL_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * After the TTL expires, keep serving the stale copy while one background
 * invocation refreshes it, so no visitor ever waits on a cold render.
 */
const STALE_WHILE_REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** Applied to every cached public response, so one purge can clear the site. */
export const SITE_CACHE_TAG = 'public';

/**
 * Supabase session cookie. Pages that render admin-only controls must not serve
 * an editor's HTML to the public (or a stale anonymous copy to an editor), so
 * the cache key includes this cookie. Anonymous visitors send no such cookie and
 * therefore all share a single cache entry.
 */
const SESSION_COOKIE = 'sb-access-token';

/**
 * Netlify cache directives for a public response.
 *
 * `durable` stores the response in Netlify's shared global cache instead of a
 * per-edge-node one, so a miss in one region is served from another region's
 * stored copy rather than re-invoking the function.
 *
 * @param tags Extra cache tags for targeted purges, e.g. `['ical']`.
 */
export function cdnCacheHeaders(tags: string[] = []): Record<string, string> {
  return {
    'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${CDN_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
    'Netlify-Cache-Tag': [SITE_CACHE_TAG, ...tags].join(','),
  };
}

/**
 * Mark a public page as CDN-cacheable. Call at the end of the page's
 * frontmatter so early redirects and error paths stay uncached.
 *
 * @param headers `Astro.response.headers` for the page being rendered.
 * @param tags Extra cache tags for targeted purges, e.g. `['events']`.
 */
export function setPublicCache(headers: Headers, tags: string[] = []): void {
  for (const [name, value] of Object.entries(cdnCacheHeaders(tags))) {
    headers.set(name, value);
  }

  headers.set('Netlify-Vary', `cookie=${SESSION_COOKIE}`);

  // Browsers revalidate against the CDN rather than holding their own copy, so a
  // purge reaches returning visitors immediately. Revalidation hits the edge, not
  // the function.
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
}
