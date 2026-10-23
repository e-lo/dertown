import { supabaseAdmin } from '@/lib/supabase';
import { withSuperAdminAuth, jsonError, jsonResponse } from '@/lib/api-utils';
import type { Database } from '@/types/database';
import {
  MERGE_SPECS,
  buildMergedValues,
  type MergeChoices,
  type MergeEntityType,
} from '@/lib/entity-merge-fields';

type TableName = keyof Database['public']['Tables'];

interface Reference {
  table: TableName;
  column: string;
  // Plural noun used when a delete is refused, e.g. "still used by 3 events".
  label: string;
}

// Join tables with a UNIQUE(<memberColumn>, organization_id) constraint: a member already linked
// to the primary would collide when re-pointed, so their secondary link is dropped instead.
interface Membership {
  table: 'org_users' | 'allowlisted_org_emails';
  memberColumn: 'user_id' | 'email';
  label: string;
}

const REFERENCES: Record<MergeEntityType, readonly Reference[]> = {
  location: [
    { table: 'events', column: 'location_id', label: 'events' },
    { table: 'events_staged', column: 'location_id', label: 'staged events' },
    { table: 'organizations', column: 'location_id', label: 'organizations' },
    { table: 'activities', column: 'location_id', label: 'activities' },
  ],
  organization: [
    { table: 'events', column: 'organization_id', label: 'events' },
    { table: 'events_staged', column: 'organization_id', label: 'staged events' },
    { table: 'announcements', column: 'organization_id', label: 'announcements' },
    { table: 'source_sites', column: 'organization_id', label: 'scraper sources' },
    { table: 'activities', column: 'sponsoring_organization_id', label: 'activities' },
  ],
};

const MEMBERSHIPS: Record<MergeEntityType, readonly Membership[]> = {
  location: [],
  organization: [
    { table: 'org_users', memberColumn: 'user_id', label: 'editors' },
    { table: 'allowlisted_org_emails', memberColumn: 'email', label: 'approved emails' },
  ],
};

export class MergeError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function repointReferences(
  type: MergeEntityType,
  fromId: string,
  toId: string
): Promise<void> {
  for (const { table, column } of REFERENCES[type]) {
    const { error } = await supabaseAdmin
      .from(table)
      // Table and column are chosen at runtime from the list above, so the payload
      // cannot be checked against a single table's Update type.
      .update({ [column]: toId } as never)
      .eq(column, fromId);
    if (error) throw new Error(`Failed to update ${table}.${column}: ${error.message}`);
  }

  // Children of the secondary become children of the primary, except the primary itself.
  // The parent column differs per table, so it is cast like the payloads above.
  const { table, parentColumn } = MERGE_SPECS[type];
  const { error } = await supabaseAdmin
    .from(table)
    .update({ [parentColumn]: toId } as never)
    .eq(parentColumn as never, fromId)
    .neq('id', toId);
  if (error) throw new Error(`Failed to update ${table}.${parentColumn}: ${error.message}`);
}

async function repointMembership(
  { table, memberColumn }: Membership,
  fromId: string,
  toId: string
): Promise<void> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from(table)
    .select(memberColumn)
    .eq('organization_id', toId);
  if (selectError) throw new Error(`Failed to read ${table}: ${selectError.message}`);

  // memberColumn is one of two per-table columns, which the typed select can't follow.
  const alreadyMembers = ((existing ?? []) as unknown as Array<Record<string, string>>).map(
    (row) => row[memberColumn]
  );
  if (alreadyMembers.length > 0) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('organization_id', fromId)
      .in(memberColumn, alreadyMembers);
    if (error) throw new Error(`Failed to remove overlapping ${table} rows: ${error.message}`);
  }

  const { error } = await supabaseAdmin
    .from(table)
    .update({ organization_id: toId })
    .eq('organization_id', fromId);
  if (error) throw new Error(`Failed to update ${table}.organization_id: ${error.message}`);
}

async function fetchRecord(type: MergeEntityType, id: string, role: string) {
  const { data, error } = await supabaseAdmin
    .from(MERGE_SPECS[type].table)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load ${role} ${MERGE_SPECS[type].noun}: ${error.message}`);
  if (!data)
    throw new MergeError(
      `${role[0].toUpperCase()}${role.slice(1)} ${MERGE_SPECS[type].noun} not found`,
      404
    );
  return data as Record<string, unknown>;
}

/**
 * Folds the secondary location/organization into the primary: writes the chosen field values onto
 * the primary, re-points every reference to the secondary, then deletes the secondary. A foreign
 * key missing from REFERENCES makes the delete fail rather than orphan rows.
 *
 * Not atomic: if a step fails midway, re-running the same merge finishes it.
 */
export async function mergeEntities(
  type: MergeEntityType,
  primaryId: string,
  secondaryId: string,
  choices: MergeChoices = {}
): Promise<void> {
  if (primaryId === secondaryId) {
    throw new MergeError('Cannot merge a record with itself', 400);
  }

  const spec = MERGE_SPECS[type];
  const [primary, secondary] = await Promise.all([
    fetchRecord(type, primaryId, 'primary'),
    fetchRecord(type, secondaryId, 'secondary'),
  ]);
  if (primary.status === 'archived' || primary.status === 'duplicate') {
    throw new MergeError(
      `The ${spec.noun} being kept is archived; choose a different one to keep`,
      400
    );
  }

  const merged = buildMergedValues(spec, primary, secondary, choices);
  const { error: updateError } = await supabaseAdmin
    .from(spec.table)
    .update(merged as never)
    .eq('id', primaryId);
  if (updateError) throw new Error(`Failed to update ${spec.noun}: ${updateError.message}`);

  await repointReferences(type, secondaryId, primaryId);
  for (const membership of MEMBERSHIPS[type]) {
    await repointMembership(membership, secondaryId, primaryId);
  }

  const { error: deleteError } = await supabaseAdmin
    .from(spec.table)
    .delete()
    .eq('id', secondaryId);
  if (deleteError)
    throw new Error(`Failed to delete duplicate ${spec.noun}: ${deleteError.message}`);
}

async function countRows(table: TableName, column: string, id: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })
    // Column is chosen at runtime from REFERENCES/MEMBERSHIPS, so it is cast.
    .eq(column as never, id);
  if (error) throw new Error(`Failed to check ${table}.${column}: ${error.message}`);
  return count ?? 0;
}

/**
 * Deletes a location/organization that nothing uses. Refuses (409) while any events, children,
 * editors, etc. still point at it, naming them so the admin can merge it away instead.
 */
export async function deleteEntity(type: MergeEntityType, id: string): Promise<void> {
  const spec = MERGE_SPECS[type];
  await fetchRecord(type, id, 'this');

  const childLabel = type === 'location' ? 'sub-locations' : 'child organizations';
  const checks = [
    ...REFERENCES[type],
    { table: spec.table, column: spec.parentColumn, label: childLabel },
    ...MEMBERSHIPS[type].map((m) => ({
      table: m.table,
      column: 'organization_id',
      label: m.label,
    })),
  ];
  const counts = await Promise.all(checks.map((c) => countRows(c.table, c.column, id)));
  const inUse = checks
    .map((check, i) => ({ label: check.label, count: counts[i] }))
    .filter(({ count }) => count > 0);
  if (inUse.length > 0) {
    const usage = inUse.map(({ count, label }) => `${count} ${label}`).join(', ');
    throw new MergeError(
      `This ${spec.noun} is still used by ${usage}. Use "Merge with…" to move them to another ${spec.noun} instead.`,
      409
    );
  }

  const { error } = await supabaseAdmin.from(spec.table).delete().eq('id', id);
  if (error) throw new Error(`Failed to delete ${spec.noun}: ${error.message}`);
}

function parseChoices(value: unknown): MergeChoices {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const choices: MergeChoices = {};
  for (const [key, choice] of Object.entries(value)) {
    if (choice === 'primary' || choice === 'secondary') choices[key] = choice;
  }
  return choices;
}

/** POST { primaryId, secondaryId, mergedFields? } → merges secondary into primary (super-admin only). */
export function createMergeRoute(type: MergeEntityType) {
  return withSuperAdminAuth(async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const primaryId = typeof body.primaryId === 'string' ? body.primaryId : '';
    const secondaryId = typeof body.secondaryId === 'string' ? body.secondaryId : '';
    if (!primaryId || !secondaryId) {
      return jsonError('primaryId and secondaryId are required', 400);
    }

    try {
      await mergeEntities(type, primaryId, secondaryId, parseChoices(body.mergedFields));
    } catch (error) {
      if (error instanceof MergeError) return jsonError(error.message, error.status);
      console.error(`Error merging ${MERGE_SPECS[type].noun}:`, error);
      return jsonError(error instanceof Error ? error.message : 'Merge failed', 500);
    }
    return jsonResponse({ success: true });
  });
}

/** DELETE /api/admin/<table>/<id> → deletes an unused location/organization (super-admin only). */
export function createDeleteRoute(type: MergeEntityType) {
  return withSuperAdminAuth(async ({ params }) => {
    if (!params.id) return jsonError('Missing id', 400);
    try {
      await deleteEntity(type, params.id);
    } catch (error) {
      if (error instanceof MergeError) return jsonError(error.message, error.status);
      console.error(`Error deleting ${MERGE_SPECS[type].noun}:`, error);
      return jsonError(error instanceof Error ? error.message : 'Delete failed', 500);
    }
    return jsonResponse({ success: true });
  });
}
