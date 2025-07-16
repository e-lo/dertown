import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { filterFutureEvents } from './event-utils';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabaseServiceKey =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Helper functions for common database operations
export const db = {
  // Events
  events: {
    getAll: () =>
      supabase.from('public_events').select(
        `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name)
        `
      ),
    getById: (id: string) =>
      supabase
        .from('public_events')
        .select(
          `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address),
          organization:organizations!events_organization_id_fkey(name)
        `
        )
        .eq('id', id)
        .single(),
    getRelated: (eventId: string, organizationId: string | null, locationId: string | null) => {
      let query = supabase
        .from('public_events')
        .select(
          `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address),
          organization:organizations!events_organization_id_fkey(name)
        `
        )
        .neq('id', eventId)
        .limit(6);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      } else if (locationId) {
        query = query.eq('location_id', locationId);
      }

      return query;
    },
    getFeatured: () =>
      supabase
        .from('public_events')
        .select(
          `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name)
        `
        )
        .eq('featured', true),
    getCurrentAndFuture: async () => {
      const { data, error } = await supabase.from('public_events').select(
        `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address)
        `
      );
      return { data: data ? filterFutureEvents(data) : [], error };
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

  // Admin functions that include private fields
  admin: {
    // Get events with private fields for admin use
    getEventsWithPrivateFields: () =>
      supabaseAdmin.from('events').select(
        `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address),
          organization:organizations!events_organization_id_fkey(name)
        `
      ),

    // Get announcements with private fields for admin use
    getAnnouncementsWithPrivateFields: () => supabaseAdmin.from('announcements').select('*'),
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
    getAll: () => supabaseAdmin.from('tags').select('*'),
    getById: (id: string) => supabaseAdmin.from('tags').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['tags']['Insert']) =>
      supabaseAdmin.from('tags').insert(data),
    update: (id: string, data: Database['public']['Tables']['tags']['Update']) =>
      supabaseAdmin.from('tags').update(data).eq('id', id),
    delete: (id: string) => supabaseAdmin.from('tags').delete().eq('id', id),
  },

  // Announcements
  announcements: {
    getPublished: () => supabase.from('public_announcements').select('*'),
    getById: (id: string) =>
      supabase.from('public_announcements').select('*').eq('id', id).single(),
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
