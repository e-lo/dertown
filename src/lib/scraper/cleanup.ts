/**
 * Pre-scrape cleanup: remove past events that are still awaiting approval.
 *
 * A pending event whose date has already passed can never be usefully
 * approved, yet it lingers in the admin "Pending approval" queue forever
 * (the scraper skips past events, so it is never re-touched, and the weekly
 * cleanup-staged-events function only removes archived/duplicate rows).
 *
 * This runs at the start of every write-mode scrape (`--remote` / `--local-db`)
 * and hard-deletes past pending rows from both queues:
 *   - events_staged — the scraper's own staging queue
 *   - events        — public form submissions awaiting admin approval
 *
 * "Past" mirrors the site's own current/future test: start_date is before
 * today AND there is no end_date still in the present/future. Dates are
 * evaluated in the site's locale timezone so the boundary matches what the
 * admin sees.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { localeTimeZone } from '../calendar-utils';

type PendingTable = 'events_staged' | 'events';

/** Cap on ids per PostgREST filter, to keep request URLs a sane length. */
const ID_CHUNK = 100;

/** Today's date (YYYY-MM-DD) in the site's locale timezone. */
function getTodayLocaleDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: localeTimeZone });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Detach still-current children that point at a doomed parent, so deleting the
 * parent doesn't trip the self-referential parent_event_id FK. Only future rows
 * are touched: past pending children are deleted alongside the parent in one
 * statement (FK NO ACTION tolerates that), and events_staged forbids updating a
 * past-dated row anyway (its start_date >= CURRENT_DATE check constraint).
 */
async function detachFutureChildren(
  db: SupabaseClient<Database>,
  table: PendingTable,
  parentIds: string[],
  today: string,
  verbose: boolean
): Promise<void> {
  for (const ids of chunk(parentIds, ID_CHUNK)) {
    const { error } = await db
      .from(table)
      .update({ parent_event_id: null })
      .in('parent_event_id', ids)
      .gte('start_date', today);

    if (error && verbose) {
      console.log(`  WARN: cleanup could not detach ${table} children: ${error.message}`);
    }
  }
}

/**
 * Delete pending rows in one table whose event date is in the past.
 * Returns the number of rows deleted (0 on a handled error).
 */
async function deletePastPending(
  db: SupabaseClient<Database>,
  table: PendingTable,
  today: string,
  verbose: boolean
): Promise<number> {
  // Past = start_date before today AND not still ongoing via a present/future end_date.
  const pastPending = () =>
    db
      .from(table)
      .select('id')
      .eq('status', 'pending')
      .lt('start_date', today)
      .or(`end_date.is.null,end_date.lt.${today}`);

  const { data: stale, error: fetchError } = await pastPending();

  if (fetchError) {
    console.log(`  WARN: cleanup could not read ${table}: ${fetchError.message}`);
    return 0;
  }

  if (!stale || stale.length === 0) return 0;

  await detachFutureChildren(
    db,
    table,
    stale.map((row) => row.id),
    today,
    verbose
  );

  // Delete by the same predicate (one statement), so intra-batch parent/child
  // rows are removed together without an FK violation.
  const { error: deleteError, count } = await db
    .from(table)
    .delete({ count: 'exact' })
    .eq('status', 'pending')
    .lt('start_date', today)
    .or(`end_date.is.null,end_date.lt.${today}`);

  if (deleteError) {
    console.log(`  WARN: cleanup could not delete from ${table}: ${deleteError.message}`);
    return 0;
  }

  return count ?? stale.length;
}

/**
 * Remove past-dated pending events from both queues before a scrape run.
 * Call only with a write client (skipped in dry-run).
 */
export async function cleanupPastPendingEvents(
  db: SupabaseClient<Database>,
  verbose: boolean
): Promise<void> {
  const today = getTodayLocaleDate();

  const stagedDeleted = await deletePastPending(db, 'events_staged', today, verbose);
  const submittedDeleted = await deletePastPending(db, 'events', today, verbose);
  const total = stagedDeleted + submittedDeleted;

  if (total > 0) {
    console.log(
      `Cleaned up ${total} past pending event(s) ` +
        `(${stagedDeleted} staged, ${submittedDeleted} submitted).`
    );
  } else if (verbose) {
    console.log('No past pending events to clean up.');
  }
}
