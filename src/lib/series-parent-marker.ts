/**
 * Staged events cannot hold a foreign key to an approved parent (events_staged.parent_event_id
 * only references events_staged). The link is carried in `comments` as a marker until approval,
 * when the staged approve route turns it into a real parent_event_id.
 */
const MARKER_SOURCE = '\\[SCRAPER_APPROVED_PARENT_ID:([0-9a-f-]{36})\\]';

export function buildApprovedParentMarker(parentId: string): string {
  return `[SCRAPER_APPROVED_PARENT_ID:${parentId}]`;
}

export function extractApprovedParentId(comments: string | null | undefined): string | null {
  if (!comments) return null;
  const match = new RegExp(MARKER_SOURCE, 'i').exec(comments);
  return match?.[1] ?? null;
}

export function stripApprovedParentMarker(comments: string | null | undefined): string | null {
  const cleaned = (comments || '').replace(new RegExp(MARKER_SOURCE, 'gi'), '').trim();
  return cleaned || null;
}

export function applyApprovedParentMarker(
  comments: string | null | undefined,
  parentId: string
): string {
  const cleaned = stripApprovedParentMarker(comments);
  const marker = buildApprovedParentMarker(parentId);
  return cleaned ? `${cleaned}\n${marker}` : marker;
}
