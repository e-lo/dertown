import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import dotenv from 'dotenv';

// Load env files in priority order (first match wins per variable)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production' });
dotenv.config();

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export type DbMode = 'dry-run' | 'remote' | 'local-db';

/** Create a write client for the scraper. Returns null in dry-run mode. */
export function createWriteClient(mode: DbMode): SupabaseClient<Database> | null {
  if (mode === 'dry-run') return null;

  if (mode === 'local-db') {
    return createClient<Database>(LOCAL_URL, LOCAL_SERVICE_KEY);
  }

  // remote
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. ' +
        'These are required for --remote mode.'
    );
  }
  return createClient<Database>(url, key);
}

/** Create a read-only client for loading reference data (dedup, matching).
 *  Always connects to the remote DB using the anon key so that dry-run
 *  mode can still check for duplicates against production data.
 *  Returns null if credentials are unavailable.
 */
export function createReadClient(): SupabaseClient<Database> | null {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.PUBLIC_SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key);
}
