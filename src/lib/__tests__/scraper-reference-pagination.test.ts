import assert from 'node:assert/strict';
import { loadReferenceData } from '../scraper/match';

// Regression guard: PostgREST caps a single response at 1000 rows. loadReferenceData
// must page past that cap, or the deduper goes blind to overflow events and re-creates
// them as duplicates on every scrape (bug: 1043-row events table → 43 invisible events).
const PAGE_CAP = 1000;

function makeEvents(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    title: `Event ${i}`,
    source_title: `Event ${i}`,
    source_id: 'src',
    status: 'approved',
    start_date: '2026-08-07',
    start_time: null,
    end_time: null,
    description: null,
    cost: null,
    website: null,
    registration_link: null,
    location_id: null,
    external_image_url: null,
  }));
}

/** Minimal Supabase stub that enforces the 1000-row cap and honors .range(). */
function makeStub(rowsByTable: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = rowsByTable[table] || [];
      return {
        select() {
          // Awaitable form (used for small lookup tables) is itself capped at PAGE_CAP,
          // exactly like a real unpaginated PostgREST call.
          const capped = rows.slice(0, PAGE_CAP);
          return {
            range(from: number, to: number) {
              return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
            },
            then(resolve: (v: { data: unknown[]; error: null }) => void) {
              resolve({ data: capped, error: null });
            },
          };
        },
      };
    },
  };
}

async function run() {
  const eventRows = makeEvents(1043, 'evt');
  const stagedRows = makeEvents(1200, 'stg');
  const stub = makeStub({
    locations: [],
    organizations: [],
    tags: [],
    source_sites: [],
    events: eventRows,
    events_staged: stagedRows,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = await loadReferenceData(stub as any);

  assert.equal(ref.existingEvents.length, 1043, 'must page past the 1000-row cap for events');
  assert.equal(ref.existingStaged.length, 1200, 'must page past the 1000-row cap for events_staged');
  // The overflow rows (beyond the first 1000) must be present.
  assert.ok(
    ref.existingEvents.some((e) => e.id === 'evt-1042'),
    'overflow event beyond row 1000 must be loaded'
  );
  assert.ok(
    ref.existingEvents.every((e) => e.table === 'events'),
    'existingEvents must be tagged with their table'
  );

  console.log('scraper-reference-pagination tests passed');
}

run();
