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
  source_id: string;
  existing_event_id?: string; // set for 'update' and 'skip' actions
}

/** Per-source scrape result summary. */
export interface ScrapeResult {
  source_id: string;
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
  api_url?: string;
  api_cal_ids?: string;
  geo_filter?: GeoFilter | null;
  default_organization?: string | null;
  default_location?: string | null;
  default_tag?: string | null;
  exclude?: ExcludeRules | null;
}

/** Top-level sources.yaml structure. */
export interface SourcesConfig {
  sources: SourceConfig[];
}
