import { similarityScore } from './entity-matching';

export const EVENT_LIKELY_DUPLICATE_THRESHOLD = 0.82;
export const EVENT_POSSIBLE_DUPLICATE_THRESHOLD = 0.68;

export interface EventDuplicateCandidate {
  id: string;
  title: string | null;
  start_date: string | null;
  start_time?: string | null;
  location_id?: string | null;
  organization_id?: string | null;
  parent_event_id?: string | null;
  source_id?: string | null;
}

export interface EventDuplicateHint {
  id: string;
  title: string | null;
  start_date: string | null;
  score: number;
  match_level: 'likely' | 'possible';
}

function dateDistanceDays(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const aDate = new Date(`${a}T00:00:00Z`).getTime();
  const bDate = new Date(`${b}T00:00:00Z`).getTime();
  if (Number.isNaN(aDate) || Number.isNaN(bDate)) return null;
  return Math.abs(aDate - bDate) / (1000 * 60 * 60 * 24);
}

function eventDuplicateScore(event: EventDuplicateCandidate, candidate: EventDuplicateCandidate): number {
  const titleScore = similarityScore(event.title || '', candidate.title || '');
  let score = titleScore;

  const dayDelta = dateDistanceDays(event.start_date, candidate.start_date);
  if (dayDelta === 0) score += 0.12;
  else if (dayDelta !== null && dayDelta <= 1) score += 0.06;

  if (event.location_id && candidate.location_id) {
    if (event.location_id === candidate.location_id) {
      score += 0.06;
    } else {
      // Different known locations — likely different events with a generic title
      score -= 0.25;
    }
  }
  if (event.organization_id && candidate.organization_id) {
    if (event.organization_id === candidate.organization_id) {
      score += 0.06;
    } else {
      // Different known orgs — likely different events with a generic title
      score -= 0.25;
    }
  }

  return Math.max(0, Math.min(score, 1));
}

export function findEventDuplicateHint(
  event: EventDuplicateCandidate,
  approvedCandidates: EventDuplicateCandidate[]
): EventDuplicateHint | null {
  let best: EventDuplicateHint | null = null;

  for (const candidate of approvedCandidates) {
    if (!candidate.id || candidate.id === event.id) continue;

    // Events that belong to a series (have a parent) should only match as
    // duplicates of events on the exact same date — otherwise every child
    // instance flags as a duplicate of siblings or the parent itself.
    if (event.parent_event_id && event.start_date !== candidate.start_date) {
      continue;
    }

    // Same source + different date = recurring event from same scraper, not a duplicate.
    // The scraper's own dedup handles same-source matches.
    if (event.source_id && candidate.source_id &&
        event.source_id === candidate.source_id &&
        event.start_date !== candidate.start_date) {
      continue;
    }

    // Only consider candidates within 30 days — same title in a different
    // season/year is not a duplicate, it's a recurring event.
    const dayDelta = dateDistanceDays(event.start_date, candidate.start_date);
    if (dayDelta !== null && dayDelta > 30) continue;

    const score = eventDuplicateScore(event, candidate);
    if (!best || score > best.score) {
      const roundedScore = Math.round(score * 100) / 100;
      best = {
        id: candidate.id,
        title: candidate.title,
        start_date: candidate.start_date,
        score: roundedScore,
        match_level:
          roundedScore >= EVENT_LIKELY_DUPLICATE_THRESHOLD ? 'likely' : 'possible',
      };
    }
  }

  if (!best) return null;
  if (best.score < EVENT_POSSIBLE_DUPLICATE_THRESHOLD) return null;
  return best;
}
