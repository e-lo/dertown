import type { ScrapedEvent, ExcludeRules, GeoFilter } from './types';

/** Check if an event should be excluded based on source exclusion rules. */
export function shouldExclude(
  event: ScrapedEvent,
  rules: ExcludeRules | null | undefined,
  verbose: boolean
): boolean {
  if (!rules) return false;

  const titleLower = (event.title || '').toLowerCase();
  const locationLower = (event.location_name || '').toLowerCase();

  // Title keyword exclusion
  if (rules.title_keywords) {
    for (const keyword of rules.title_keywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        if (verbose) console.log(`    EXCLUDED "${event.title}" (title keyword: "${keyword}")`);
        return true;
      }
    }
  }

  // Location keyword exclusion
  if (rules.location_keywords) {
    for (const keyword of rules.location_keywords) {
      if (locationLower.includes(keyword.toLowerCase())) {
        if (verbose)
          console.log(`    EXCLUDED "${event.title}" (location keyword: "${keyword}")`);
        return true;
      }
    }
  }

  // Title regex pattern exclusion
  if (rules.title_patterns) {
    for (const pattern of rules.title_patterns) {
      try {
        if (new RegExp(pattern, 'i').test(event.title)) {
          if (verbose)
            console.log(`    EXCLUDED "${event.title}" (title pattern: "${pattern}")`);
          return true;
        }
      } catch {
        // Invalid regex — skip
      }
    }
  }

  return false;
}

/** Check if an event passes the geo filter (i.e. is in the target area). */
export function passesGeoFilter(
  event: ScrapedEvent,
  filter: GeoFilter | null | undefined,
  verbose: boolean
): boolean {
  if (!filter) return true; // No filter = all pass

  const locationLower = (event.location_name || '').toLowerCase();
  const titleLower = (event.title || '').toLowerCase();
  const descLower = (event.description || '').toLowerCase();

  // Check if any geo keyword matches location, title, or description
  for (const keyword of filter.location_keywords) {
    const kw = keyword.toLowerCase();
    if (locationLower.includes(kw) || titleLower.includes(kw) || descLower.includes(kw)) {
      return true;
    }
  }

  if (verbose)
    console.log(`    FILTERED "${event.title}" (geo: no match for ${filter.location_keywords.join(', ')})`);
  return false;
}
