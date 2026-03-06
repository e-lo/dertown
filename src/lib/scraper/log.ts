import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { ScrapeResult } from './types';

/** Write a scrape result to scrape_logs and update the source_sites record. */
export async function writeScrapeLog(
  db: SupabaseClient<Database>,
  result: ScrapeResult
): Promise<void> {
  const hasErrors = result.errors.length > 0;
  const status = hasErrors ? 'error' : 'success';
  const errorMessage = hasErrors ? result.errors.join('; ') : null;
  const hasValidSourceId =
    !!result.source_id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result.source_id
    );

  if (!hasValidSourceId) {
    console.warn(
      `  Skipping scrape_logs/source_sites write for ${result.source_name}: unresolved source_id`
    );
    return;
  }

  // Insert log entry
  const { error: logError } = await db.from('scrape_logs').insert({
    source_id: result.source_id,
    status,
    error_message: errorMessage,
  });

  if (logError) {
    console.error(`  Failed to write scrape log for ${result.source_name}:`, logError.message);
  }

  // Update source_sites record
  const { error: updateError } = await db
    .from('source_sites')
    .update({
      last_scraped: new Date().toISOString(),
      last_status: status,
      last_error: errorMessage,
    })
    .eq('id', result.source_id);

  if (updateError) {
    console.error(
      `  Failed to update source_sites for ${result.source_name}:`,
      updateError.message
    );
  }
}
