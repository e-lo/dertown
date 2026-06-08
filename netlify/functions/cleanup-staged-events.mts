/**
 * Netlify Scheduled Function: cleanup-staged-events
 *
 * Deletes archived and duplicate staged events whose start_date is more than
 * DAYS_CUTOFF days in the past. These rows are safe to remove because:
 *   - Their start_date has already passed, so the scraper would never re-scrape them.
 *   - Recent rejections (within DAYS_CUTOFF days) are kept as scraper memory so the
 *     same event isn't re-queued if the scraper runs before its date passes.
 *
 * Runs every Sunday at 02:00 UTC.
 */

import { createClient } from '@supabase/supabase-js';

/** Delete rejected staged events older than this many days. */
const DAYS_CUTOFF = 7;

export default async function handler(): Promise<void> {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[cleanup-staged-events] Missing Supabase credentials — skipping.');
    return;
  }

  const db = createClient(supabaseUrl, supabaseKey);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_CUTOFF);
  const cutoffDate = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD

  // Find IDs about to be deleted so we can fix parent_event_id references first.
  const { data: stale, error: fetchError } = await db
    .from('events_staged')
    .select('id')
    .in('status', ['archived', 'duplicate'])
    .lt('start_date', cutoffDate);

  if (fetchError) {
    console.error('[cleanup-staged-events] Failed to fetch stale rows:', fetchError.message);
    return;
  }

  if (!stale || stale.length === 0) {
    console.log('[cleanup-staged-events] Nothing to clean up.');
    return;
  }

  const staleIds = stale.map((e: { id: string }) => e.id);

  // Nullify parent_event_id on any pending children that point to a stale parent,
  // so they aren't orphaned in a broken hierarchy.
  const { error: parentError } = await db
    .from('events_staged')
    .update({ parent_event_id: null })
    .in('parent_event_id', staleIds);

  if (parentError) {
    console.error('[cleanup-staged-events] Failed to nullify parent refs:', parentError.message);
    // Non-fatal — still attempt the delete.
  }

  // Delete the stale rejected rows.
  const { error: deleteError, count } = await db
    .from('events_staged')
    .delete({ count: 'exact' })
    .in('status', ['archived', 'duplicate'])
    .lt('start_date', cutoffDate);

  if (deleteError) {
    console.error('[cleanup-staged-events] Delete failed:', deleteError.message);
    return;
  }

  console.log(
    `[cleanup-staged-events] Deleted ${count ?? staleIds.length} stale rejected staged event(s)` +
      ` (start_date < ${cutoffDate}).`
  );
}

/** Run every Sunday at 02:00 UTC. */
export const config = {
  schedule: '0 2 * * 0',
};
