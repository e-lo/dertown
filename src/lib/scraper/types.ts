/** A single event extracted from a source page (before DB matching/insertion). */
export interface ScrapedEvent {
  title: string;
  description: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  start_time: string | null; // HH:MM (24h)
  end_time: string | null;
  location_name: string | null; // raw venue name from source
  cost: string | null;
  registration_required: boolean | null;
  registration_url: string | null;
  website: string | null; // event detail page URL
  image_url: string | null;
  series_key?: string | null; // stable key to group scraped instances into a series
  series_parent_title?: string | null; // title to use when creating a parent series event
  series_parent_website?: string | null; // canonical series page URL
}

/** Result of processing one event through the matching/dedup pipeline. */
export interface ProcessedEvent {
  scraped: ScrapedEvent;
  action: 'new' | 'update' | 'skip';
  update_reason?: string; // e.g. "time changed 10:00→09:30"
  location_id: string | null;
  location_added: string | null; // venue name if no DB match found
  organization_id: string | null;
  organization_added: string | null;
  primary_tag_id: string | null;
  parent_event_id: string | null;
  series_key: string | null;
  series_parent_title: string | null;
  series_parent_website: string | null;
  source_id: string | null;
  existing_event_id?: string; // set for 'update' and 'skip' actions
  existing_event_table?: 'events' | 'events_staged';
}

/** Per-source scrape result summary. */
export interface ScrapeResult {
  source_id: string | null;
  source_name: string;
  total_extracted: number;
  filtered_geo: number;
  filtered_excluded: number;
  new_count: number;
  updated_count: number;
  skipped_count: number;
  errors: string[];
  events: ProcessedEvent[];
}

/** Source exclusion rules from YAML config. */
export interface ExcludeRules {
  title_keywords?: string[];
  location_keywords?: string[];
  title_patterns?: string[];
}

/** Geo filter config from YAML. */
export interface GeoFilter {
  location_keywords: string[];
}

/** Per-source configuration from sources.yaml. */
export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  type: 'html' | 'ical' | 'json-api';
  selectors?: Record<string, string>;
  ical_url?: string;
  fallback_type?: string;
  detail_description_selectors?: string[];
  api_url?: string;
  api_cal_ids?: string;
  geo_filter?: GeoFilter | null;
  default_organization?: string | null;
  default_location?: string | null;
  default_tag?: string | null;
  exclude?: ExcludeRules | null;
  location_map?: Record<string, string> | null;
  organization_map?: Record<string, string> | null;
  instance_location_overrides?: Record<string, string> | null; // Salesforce event/instance ID -> location
}

/** Venue name pattern → tag mapping from config. */
export interface VenueTagRule {
  match: string;
  tag: string;
}

/** Top-level sources.yaml structure. */
export interface SourcesConfig {
  sources: SourceConfig[];
  tag_keywords?: Record<string, string[]>;
  venue_tags?: VenueTagRule[];
  description_max_chars?: number;
}
