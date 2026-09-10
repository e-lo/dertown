import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { applyApprovedParentMarker } from '@/lib/series-parent-marker';
import {
  deriveParentDateRange,
  findChildEligibilityError,
  isExistingParentRef,
  parseGroupSeriesRequest,
  type ChildRef,
  type ChildRow,
  type ChildTable,
} from '@/lib/group-series';

export const prerender = false;

const CHILD_COLUMNS = 'id, title, status, organization_id, start_date, comments';

type LoadResult = { rows: ChildRow[] } | { missingId: string };

/** Load every selected child from its own table and note which are already parents. */
async function loadChildRows(refs: ChildRef[]): Promise<LoadResult> {
  const idsByTable: Record<ChildTable, string[]> = { events: [], events_staged: [] };
  for (const ref of refs) idsByTable[ref.table].push(ref.id);

  const rows: ChildRow[] = [];
  for (const table of ['events', 'events_staged'] as const) {
    const ids = idsByTable[table];
    if (ids.length === 0) continue;

    const [{ data, error }, { data: dependents, error: dependentsError }] = await Promise.all([
      supabaseAdmin.from(table).select(CHILD_COLUMNS).in('id', ids),
      supabaseAdmin.from(table).select('parent_event_id').in('parent_event_id', ids),
    ]);
    if (error) throw new Error(error.message);
    if (dependentsError) throw new Error(dependentsError.message);

    const alreadyParents = new Set((dependents || []).map((d) => d.parent_event_id));
    const byId = new Map((data || []).map((r) => [r.id, r]));
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) return { missingId: id };
      rows.push({
        id: row.id,
        table,
        title: row.title,
        status: row.status,
        organization_id: row.organization_id,
        start_date: row.start_date,
        comments: row.comments,
        hasChildren: alreadyParents.has(id),
      });
    }
  }
  return { rows };
}

function inOrgScope(
  auth: { isSuperAdmin: boolean; organizationIds: string[] },
  organizationId: string | null
): boolean {
  return auth.isSuperAdmin || (!!organizationId && auth.organizationIds.includes(organizationId));
}

export const POST = withAdminAuth(async ({ request, auth }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  const parsed = parseGroupSeriesRequest(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { children, parent } = parsed.request;

  let rows: ChildRow[];
  try {
    const loaded = await loadChildRows(children);
    if ('missingId' in loaded) return jsonError(`Event ${loaded.missingId} was not found`, 404);
    rows = loaded.rows;
  } catch (error) {
    console.error('[GROUP SERIES] Failed to load selected events:', error);
    return jsonError('Failed to load selected events');
  }

  const eligibility = findChildEligibilityError(rows, auth);
  if (eligibility) return jsonError(eligibility.message, eligibility.status);

  let parentId: string;
  let parentTitle: string;

  if (isExistingParentRef(parent)) {
    const { data: existing, error } = await supabaseAdmin
      .from('events')
      .select('id, title, organization_id')
      .eq('id', parent.id)
      .eq('status', 'approved')
      .is('parent_event_id', null)
      .maybeSingle();
    if (error) {
      console.error('[GROUP SERIES] Failed to load parent:', error);
      return jsonError('Failed to load parent event');
    }
    if (!existing) return jsonError('Parent must be an approved top-level event', 400);
    if (!inOrgScope(auth, existing.organization_id)) {
      return jsonError('Forbidden: parent belongs to another organization', 403);
    }
    parentId = existing.id;
    parentTitle = existing.title;
  } else {
    if (!inOrgScope(auth, parent.organization_id)) {
      return jsonError('Forbidden: cannot create a parent for this organization', 403);
    }
    const range = deriveParentDateRange(rows.map((r) => r.start_date));
    const { data: created, error } = await supabaseAdmin
      .from('events')
      .insert({
        ...parent,
        ...range,
        status: 'approved',
        exclude_from_calendar: true,
      })
      .select('id, title')
      .single();
    if (error || !created) {
      console.error('[GROUP SERIES] Failed to create parent:', error);
      return jsonError('Failed to create parent event');
    }
    parentId = created.id;
    parentTitle = created.title;
  }

  const linked: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { error } =
      row.table === 'events'
        ? await supabaseAdmin.from('events').update({ parent_event_id: parentId }).eq('id', row.id)
        : await supabaseAdmin
            .from('events_staged')
            .update({
              parent_event_id: null,
              comments: applyApprovedParentMarker(row.comments, parentId),
            })
            .eq('id', row.id);
    if (error) {
      console.error(`[GROUP SERIES] Failed to link ${row.table} ${row.id}:`, error);
      failed.push(...rows.slice(i).map((r) => r.id));
      break;
    }
    linked.push(row.id);
  }

  const parentSummary = { id: parentId, title: parentTitle };
  if (failed.length > 0) {
    return jsonResponse(
      {
        error: `Linked ${linked.length} of ${rows.length} events; the rest failed. Select the remaining events and choose this parent as an existing parent to retry.`,
        parent: parentSummary,
        linked: linked.length,
        failed,
      },
      500
    );
  }

  return jsonResponse({ parent: parentSummary, linked: linked.length });
});
