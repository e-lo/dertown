// The canonical list of fields that can be chosen field-by-field during an event merge.
// Both the merge API (src/pages/api/admin/events/merge.ts) and the merge page
// (src/pages/admin/events/merge.astro) import from here to stay in sync.
export const MERGEABLE_FIELDS = [
  'title', 'description', 'start_date', 'end_date', 'start_time', 'end_time',
  'location_id', 'organization_id', 'primary_tag_id', 'secondary_tag_id',
  'email', 'website', 'registration_link', 'cost',
  'external_image_url', 'image_id', 'image_alt_text',
  'featured', 'registration', 'exclude_from_calendar',
] as const;

export type MergeableField = typeof MERGEABLE_FIELDS[number];
