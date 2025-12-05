import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { localeTimeZone } from './calendar-utils';

// Decide which Supabase credentials to use
const useLocalDb = import.meta.env.USE_LOCAL_DB === 'true';

const supabaseUrl = useLocalDb ? 'http://127.0.0.1:54321' : import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = useLocalDb
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  : import.meta.env.PUBLIC_SUPABASE_KEY;
const supabaseServiceKey = useLocalDb
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  : import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Constants
const RELATED_EVENTS_LIMIT = 6;
const FEATURED_EVENTS_LIMIT = 8;

/**
 * Gets today's date in locale timezone as a date string (YYYY-MM-DD)
 * @returns {string} Today's date in locale timezone
 */
export function getTodayLocale(): string {
  // Get current UTC time
  const nowUtc = new Date();
  
  // Convert to locale timezone date string (YYYY-MM-DD format)
  // Use 'en-CA' locale which gives us YYYY-MM-DD format directly
  const todayLocaleDateStr = nowUtc.toLocaleDateString('en-CA', { 
    timeZone: localeTimeZone 
  });
  
  return todayLocaleDateStr;
}

/**
 * Filters events to only include those that are current or future
 * An event is included if:
 * - start_date >= today (Pacific time), OR
 * - end_date >= today (Pacific time)
 * 
 * @param {any[]} events - Array of event objects to filter
 * @returns {any[]} Filtered array of events
 */
export function filterCurrentAndFutureEvents(events: any[]): any[] {
  if (!events) return [];
  
  const todayLocale = getTodayLocale();
  
  return events.filter((event: any) => {
    // Must have at least a start_date
    if (!event.start_date) return false;
    
    // Check if start_date >= today (date comparison in locale time)
    const startDateStr = event.start_date;
    const startDateIsTodayOrFuture = startDateStr >= todayLocale;
    
    // Check if end_date >= today (if end_date exists)
    if (event.end_date) {
      const endDateStr = event.end_date;
      const endDateIsTodayOrFuture = endDateStr >= todayLocale;
      // Include if either start_date or end_date is today or future
      return startDateIsTodayOrFuture || endDateIsTodayOrFuture;
    }
    
    // If no end_date, only check start_date
    return startDateIsTodayOrFuture;
  });
}

// Helper functions for common database operations
export const db = {
  // Events
  events: {
    getById: (id: string) => supabase.from('public_events').select(`
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `).eq('id', id).single(),
    getByParentEventId: async (parentEventId: string) => {
      // Query public_events view - it should include parent_event_id after migration is applied
      // If the view doesn't have parent_event_id yet, this will fail gracefully
      const { data, error } = await supabase
        .from('public_events')
        .select(`
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address)
        `)
        .eq('parent_event_id', parentEventId)
        .order('start_date', { ascending: true });

      // If error is about missing column, the migration hasn't been run yet
      if (error && error.code === '42703') {
        console.warn('public_events view does not have parent_event_id column. Migration may need to be run.');
        return { data: [], error: null };
      }

      return { data: data || [], error };
    },
    getRelated: async (eventId: string, organizationId: string | null, locationId: string | null) => {
      // First, try to get the parent event to exclude series events
      const { data: currentEvent } = await supabase
        .from('public_events')
        .select('parent_event_id')
        .eq('id', eventId)
        .single();

      let query = supabase
        .from('public_events')
        .select(`
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address)
        `)
        .neq('id', eventId)
        .limit(RELATED_EVENTS_LIMIT);

      // Exclude events from the same series (same parent_event_id)
      if (currentEvent?.parent_event_id) {
        query = query.or(`parent_event_id.is.null,parent_event_id.neq.${currentEvent.parent_event_id}`);
      }

      // Only use organization/location matching when parent_event_id is NULL
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      } else if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error } = await query;

      return { data: data || [], error };
    },
    getFeatured: async () => {
      const { data, error } = await supabase
        .from('public_events')
        .select(`
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address)
        `)
        .eq('featured', true);

      return { data: data || [], error };
    },
    getAll: async () => {
      const { data, error } = await supabase
        .from('public_events')
        .select(`
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address)
        `)
        .order('start_date', { ascending: true });

      return { data: data || [], error };
    },
    getCurrentAndFuture: async () => {
      // Get all events and filter client-side
      const result = await db.events.getAll();
      if (result.error) return { data: null, error: result.error };
      
      // Filter to only current and future events
      const filteredData = filterCurrentAndFutureEvents(result.data || []);

      return { data: filteredData, error: null };
    },
    create: (data: Database['public']['Tables']['events']['Insert']) =>
      supabase.from('events').insert(data),
    update: (id: string, data: Database['public']['Tables']['events']['Update']) =>
      supabase.from('events').update(data).eq('id', id),
    delete: (id: string) => supabase.from('events').delete().eq('id', id),
  },

  // Events Staged
  eventsStaged: {
    create: (data: Database['public']['Tables']['events_staged']['Insert']) =>
      supabase.from('events_staged').insert(data),
    getAll: () => supabase.from('events_staged').select('*'),
    getById: (id: string) => supabase.from('events_staged').select('*').eq('id', id).single(),
    update: (id: string, data: Database['public']['Tables']['events_staged']['Update']) =>
      supabase.from('events_staged').update(data).eq('id', id),
    delete: (id: string) => supabase.from('events_staged').delete().eq('id', id),
  },

  // Locations
  locations: {
    getAll: () => supabaseAdmin.from('locations').select('*'),
    getById: (id: string) => supabaseAdmin.from('locations').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['locations']['Insert']) =>
      supabaseAdmin.from('locations').insert(data),
    update: (id: string, data: Database['public']['Tables']['locations']['Update']) =>
      supabaseAdmin.from('locations').update(data).eq('id', id),
    delete: (id: string) => supabaseAdmin.from('locations').delete().eq('id', id),
  },

  // Organizations
  organizations: {
    getAll: () => supabaseAdmin.from('organizations').select('*'),
    getById: (id: string) => supabaseAdmin.from('organizations').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['organizations']['Insert']) =>
      supabaseAdmin.from('organizations').insert(data),
    update: (id: string, data: Database['public']['Tables']['organizations']['Update']) =>
      supabaseAdmin.from('organizations').update(data).eq('id', id),
    delete: (id: string) => supabaseAdmin.from('organizations').delete().eq('id', id),
  },

  // Tags
  tags: {
    getAll: () => supabase.from('tags').select('*'),
    getById: (id: string) => supabaseAdmin.from('tags').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['tags']['Insert']) =>
      supabaseAdmin.from('tags').insert(data),
    update: (id: string, data: Database['public']['Tables']['tags']['Update']) =>
      supabaseAdmin.from('tags').update(data).eq('id', id),
    delete: (id: string) => supabaseAdmin.from('tags').delete().eq('id', id),
  },

  // Announcements
  announcements: {
    getPublished: () => supabase.from('announcements').select('*').eq('status', 'published'),
    getById: (id: string) => supabase.from('announcements').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['announcements']['Insert']) =>
      supabase.from('announcements').insert(data),
    update: (id: string, data: Database['public']['Tables']['announcements']['Update']) =>
      supabase.from('announcements').update(data).eq('id', id),
    delete: (id: string) => supabase.from('announcements').delete().eq('id', id),
  },

  // Announcements Staged
  announcementsStaged: {
    create: (data: Database['public']['Tables']['announcements_staged']['Insert']) =>
      supabase.from('announcements_staged').insert(data),
    getAll: () => supabase.from('announcements_staged').select('*'),
    getById: (id: string) =>
      supabase.from('announcements_staged').select('*').eq('id', id).single(),
    update: (id: string, data: Database['public']['Tables']['announcements_staged']['Update']) =>
      supabase.from('announcements_staged').update(data).eq('id', id),
    delete: (id: string) => supabase.from('announcements_staged').delete().eq('id', id),
  },

  // Source Sites
  sourceSites: {
    getAll: () => supabase.from('source_sites').select('*'),
    getById: (id: string) => supabase.from('source_sites').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['source_sites']['Insert']) =>
      supabase.from('source_sites').insert(data),
    update: (id: string, data: Database['public']['Tables']['source_sites']['Update']) =>
      supabase.from('source_sites').update(data).eq('id', id),
    delete: (id: string) => supabase.from('source_sites').delete().eq('id', id),
  },

  // Scrape Logs
  scrapeLogs: {
    getAll: () => supabase.from('scrape_logs').select('*'),
    getById: (id: string) => supabase.from('scrape_logs').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['scrape_logs']['Insert']) =>
      supabase.from('scrape_logs').insert(data),
    update: (id: string, data: Database['public']['Tables']['scrape_logs']['Update']) =>
      supabase.from('scrape_logs').update(data).eq('id', id),
    delete: (id: string) => supabase.from('scrape_logs').delete().eq('id', id),
  },
};

// Export types for convenience
export type { Database } from '../types/database';
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
