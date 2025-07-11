import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { filterFutureEvents } from './event-utils';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper functions for common database operations
export const db = {
  // Events
  events: {
    getAll: () =>
      supabase
        .from('events')
        .select(
          `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name)
        `
        )
        .eq('status', 'approved')
        .eq('exclude_from_calendar', false),
    getById: (id: string) =>
      supabase
        .from('events')
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
        .from('events')
        .select(
          `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address),
          organization:organizations!events_organization_id_fkey(name)
        `
        )
        .eq('status', 'approved')
        .eq('exclude_from_calendar', false)
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
        .from('events')
        .select(
          `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name)
        `
        )
        .eq('status', 'approved')
        .eq('featured', true),
    getCurrentAndFuture: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(
          `
          *,
          primary_tag:tags!events_primary_tag_id_fkey(name),
          secondary_tag:tags!events_secondary_tag_id_fkey(name),
          location:locations!events_location_id_fkey(name, address)
        `
        )
        .eq('status', 'approved')
        .eq('exclude_from_calendar', false);
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

  // Locations
  locations: {
    getAll: () => supabase.from('locations').select('*').eq('status', 'approved'),
    getById: (id: string) => supabase.from('locations').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['locations']['Insert']) =>
      supabase.from('locations').insert(data),
    update: (id: string, data: Database['public']['Tables']['locations']['Update']) =>
      supabase.from('locations').update(data).eq('id', id),
    delete: (id: string) => supabase.from('locations').delete().eq('id', id),
  },

  // Organizations
  organizations: {
    getAll: () => supabase.from('organizations').select('*').eq('status', 'approved'),
    getById: (id: string) => supabase.from('organizations').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['organizations']['Insert']) =>
      supabase.from('organizations').insert(data),
    update: (id: string, data: Database['public']['Tables']['organizations']['Update']) =>
      supabase.from('organizations').update(data).eq('id', id),
    delete: (id: string) => supabase.from('organizations').delete().eq('id', id),
  },

  // Tags
  tags: {
    getAll: () => supabase.from('tags').select('*'),
    getById: (id: string) => supabase.from('tags').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['tags']['Insert']) =>
      supabase.from('tags').insert(data),
    update: (id: string, data: Database['public']['Tables']['tags']['Update']) =>
      supabase.from('tags').update(data).eq('id', id),
    delete: (id: string) => supabase.from('tags').delete().eq('id', id),
  },

  // Announcements
  announcements: {
    getPublished: () =>
      supabase
        .from('announcements')
        .select('*')
        .or(
          `and(status.eq.published,show_at.lte.${new Date().toISOString()},expires_at.is.null),and(status.eq.published,show_at.lte.${new Date().toISOString()},expires_at.gt.${new Date().toISOString()})`
        ),
    getById: (id: string) => supabase.from('announcements').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['announcements']['Insert']) =>
      supabase.from('announcements').insert(data),
    update: (id: string, data: Database['public']['Tables']['announcements']['Update']) =>
      supabase.from('announcements').update(data).eq('id', id),
    delete: (id: string) => supabase.from('announcements').delete().eq('id', id),
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
