/**
 * Pure logic for the "group pending events as a series" admin action.
 * Kept free of Supabase so it can be tested with plain tsx scripts.
 */

export type ChildTable = 'events' | 'events_staged';

export interface ChildRef {
  id: string;
  table: ChildTable;
}

export interface ExistingParentRef {
  id: string;
}

export interface NewParentFields {
  title: string;
  primary_tag_id: string;
  description: string | null;
  secondary_tag_id: string | null;
  location_id: string | null;
  organization_id: string | null;
  website: string | null;
  external_image_url: string | null;
  cost: string | null;
}

export type ParentSpec = ExistingParentRef | NewParentFields;

export interface GroupSeriesRequest {
  children: ChildRef[];
  parent: ParentSpec;
}

export type ParseResult = { ok: true; request: GroupSeriesRequest } | { ok: false; error: string };

/** A selected child as loaded from its table, plus whether anything already points at it. */
export interface ChildRow {
  id: string;
  table: ChildTable;
  title: string;
  status: string | null;
  organization_id: string | null;
  start_date: string;
  comments: string | null;
  hasChildren: boolean;
}

export interface OrgScope {
  isSuperAdmin: boolean;
  organizationIds: string[];
}

export interface EligibilityError {
  status: 400 | 403;
  message: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function optionalUuid(value: unknown): string | null {
  return isUuid(value) ? value : null;
}

export function isExistingParentRef(parent: ParentSpec): parent is ExistingParentRef {
  return 'id' in parent;
}

export function parseGroupSeriesRequest(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  const { children, parent } = body;
  if (!Array.isArray(children) || children.length === 0) {
    return { ok: false, error: 'Select at least one event to group' };
  }

  const parsedChildren: ChildRef[] = [];
  const seen = new Set<string>();
  for (const child of children) {
    if (!isRecord(child) || !isUuid(child.id)) {
      return { ok: false, error: 'Each child needs a valid id' };
    }
    if (child.table !== 'events' && child.table !== 'events_staged') {
      return { ok: false, error: 'Each child table must be "events" or "events_staged"' };
    }
    const key = `${child.table}:${child.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parsedChildren.push({ id: child.id, table: child.table });
  }

  if (!isRecord(parent)) return { ok: false, error: 'Parent is required' };

  if ('id' in parent) {
    if (!isUuid(parent.id)) return { ok: false, error: 'Parent id is not a valid id' };
    return { ok: true, request: { children: parsedChildren, parent: { id: parent.id } } };
  }

  const title = optionalText(parent.title);
  if (!title) return { ok: false, error: 'Parent title is required' };
  if (!isUuid(parent.primary_tag_id)) {
    return { ok: false, error: 'Parent primary tag is required' };
  }

  const fields: NewParentFields = {
    title,
    primary_tag_id: parent.primary_tag_id,
    description: optionalText(parent.description),
    secondary_tag_id: optionalUuid(parent.secondary_tag_id),
    location_id: optionalUuid(parent.location_id),
    organization_id: optionalUuid(parent.organization_id),
    website: optionalText(parent.website),
    external_image_url: optionalText(parent.external_image_url),
    cost: optionalText(parent.cost),
  };
  return { ok: true, request: { children: parsedChildren, parent: fields } };
}

export function findChildEligibilityError(
  rows: ChildRow[],
  scope: OrgScope
): EligibilityError | null {
  for (const row of rows) {
    if (row.status !== 'pending') {
      return { status: 400, message: `"${row.title}" is not pending and cannot be grouped` };
    }
    if (row.hasChildren) {
      return { status: 400, message: `"${row.title}" is already a series parent` };
    }
    const inScope =
      scope.isSuperAdmin ||
      (row.organization_id !== null && scope.organizationIds.includes(row.organization_id));
    if (!inScope) {
      return {
        status: 403,
        message: `"${row.title}" belongs to an organization you cannot edit`,
      };
    }
  }
  return null;
}

/** ISO dates sort correctly as strings, so min/max is a plain sort. */
export function deriveParentDateRange(startDates: string[]): {
  start_date: string;
  end_date: string | null;
} {
  const sorted = startDates.filter(Boolean).sort();
  if (sorted.length === 0) throw new Error('deriveParentDateRange needs at least one date');
  const start_date = sorted[0];
  const last = sorted[sorted.length - 1];
  return { start_date, end_date: last !== start_date ? last : null };
}
