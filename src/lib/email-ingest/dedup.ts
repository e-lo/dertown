import { supabaseAdmin } from '@/lib/supabase';
import { findEventDuplicateHint } from '../event-duplicate';
import type { EventDuplicateHint } from '../event-duplicate';
import type { ScrapedEvent } from '../scraper/types';

export async function checkDuplicate(event: ScrapedEvent): Promise<EventDuplicateHint | null> {
  const { data: existingEvents } = await supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time, location_id, organization_id, source_id')
    .not('status', 'eq', 'archived');

  if (!existingEvents || existingEvents.length === 0) return null;

  return findEventDuplicateHint(
    {
      id: '',
      title: event.title,
      start_date: event.start_date,
      start_time: event.start_time ?? null,
    },
    existingEvents
  );
}
