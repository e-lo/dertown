import { shouldExclude } from '../scraper/filter';
import type { ScrapedEvent, ExcludeRules } from '../scraper/types';

export function screenEvent(
  event: Pick<ScrapedEvent, 'title' | 'location_name'>,
  rules: ExcludeRules | null
): { pass: true } | { pass: false; reason: string } {
  if (!rules) return { pass: true };

  const excluded = shouldExclude(event as ScrapedEvent, rules, false);
  return excluded ? { pass: false, reason: 'Matched global exclusion rule' } : { pass: true };
}
