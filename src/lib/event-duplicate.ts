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

  if (event.location_id && candidate.location_id && event.location_id === candidate.location_id) {
    score += 0.06;
  }
  if (event.organization_id && candidate.organization_id && event.organization_id === candidate.organization_id) {
    score += 0.06;
  }

  return Math.min(score, 1);
}

export function findEventDuplicateHint(
  event: EventDuplicateCandidate,
  approvedCandidates: EventDuplicateCandidate[]
): EventDuplicateHint | null {
  let best: EventDuplicateHint | null = null;

  for (const candidate of approvedCandidates) {
    if (!candidate.id || candidate.id === event.id) continue;

    // Skip same-series siblings/parent unless they share the same date —
    // children of the same series are expected to have similar titles.
    if (event.parent_event_id && candidate.parent_event_id &&
        event.parent_event_id === candidate.parent_event_id &&
        event.start_date !== candidate.start_date) {
      continue;
    }
    // Also skip if the candidate IS the parent of this event
    if (event.parent_event_id && candidate.id === event.parent_event_id) {
      continue;
    }

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
