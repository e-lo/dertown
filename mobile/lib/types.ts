// Re-export Supabase generated types so mobile code imports from one place
export type { Database, Json } from '../../src/types/database';

/**
 * Shape of an event returned by /api/events/search and /api/events/[id].
 * Matches the select query in src/lib/supabase.ts db.events.getAll().
 */
export interface MobileEvent {
  id: string;
  title: string;
  start_date: string;               // "YYYY-MM-DD"
  end_date: string | null;
  start_time: string | null;        // "HH:MM:SS"
  end_time: string | null;          // "HH:MM:SS"
  description: string | null;
  website: string | null;
  registration: boolean | null;
  cost: string | null;
  featured: boolean | null;
  external_image_url: string | null;
  parent_event_id: string | null;
  location_id: string | null;
  organization_id: string | null;
  primary_tag:   { name: string } | null;
  secondary_tag: { name: string } | null;
  location: {
    id: string;
    name: string;
    address: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  organization: { name: string } | null;
}

/** Parameters for /api/events/search */
export interface EventSearchParams {
  q?: string;
  category?: string;
}

/** Shape of an announcement returned by GET /api/announcements */
export interface MobileAnnouncement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  show_at: string | null;
  expires_at: string | null;
}
