import type { AstroGlobal } from 'astro';
import { getSessionFromCookies, checkAdminAccess } from '../session';
import { MERGE_SPECS, type MergeEntityType } from '../entity-merge-fields';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MergePageGuard =
  | { redirect: string }
  | { redirect: null; primaryId: string; secondaryId: string; userEmail: string };

/** Super-admin check and ?primary=&secondary= validation for the location/organization merge pages. */
export async function guardMergePage(
  Astro: AstroGlobal,
  type: MergeEntityType
): Promise<MergePageGuard> {
  const { session } = await getSessionFromCookies(Astro.cookies);
  if (!session) {
    return {
      redirect: `/login?redirect=${encodeURIComponent(Astro.url.pathname + Astro.url.search)}`,
    };
  }

  const { role } = await checkAdminAccess(Astro.cookies);
  if (role !== 'super_admin') return { redirect: '/admin' };

  const primaryId = Astro.url.searchParams.get('primary') ?? '';
  const secondaryId = Astro.url.searchParams.get('secondary') ?? '';
  if (!UUID_REGEX.test(primaryId) || !UUID_REGEX.test(secondaryId) || primaryId === secondaryId) {
    return { redirect: `/admin/${MERGE_SPECS[type].table}` };
  }

  return { redirect: null, primaryId, secondaryId, userEmail: session.user?.email || 'Admin' };
}
