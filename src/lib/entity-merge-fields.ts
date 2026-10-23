// Field-by-field merge rules for locations and organizations. Pure (no Supabase import) so the
// merge page, the merge API, and tests can all share it.

export type MergeEntityType = 'location' | 'organization';
export type MergeChoice = 'primary' | 'secondary';
export type MergeChoices = Partial<Record<string, MergeChoice>>;
type EntityRow = Record<string, unknown>;

export interface MergeFieldSpec {
  key: string;
  label: string;
  // Columns that move together, e.g. latitude + longitude form one map pin.
  columns: readonly string[];
}

export interface MergeEntitySpec {
  table: 'locations' | 'organizations';
  noun: string;
  parentColumn: 'parent_location_id' | 'parent_organization_id';
  fields: readonly MergeFieldSpec[];
}

export const MERGE_SPECS: Record<MergeEntityType, MergeEntitySpec> = {
  location: {
    table: 'locations',
    noun: 'location',
    parentColumn: 'parent_location_id',
    fields: [
      { key: 'name', label: 'Name', columns: ['name'] },
      { key: 'address', label: 'Address', columns: ['address'] },
      { key: 'phone', label: 'Phone', columns: ['phone'] },
      { key: 'website', label: 'Website', columns: ['website'] },
      { key: 'coordinates', label: 'Map pin', columns: ['latitude', 'longitude'] },
      { key: 'parent_location_id', label: 'Parent location', columns: ['parent_location_id'] },
    ],
  },
  organization: {
    table: 'organizations',
    noun: 'organization',
    parentColumn: 'parent_organization_id',
    fields: [
      { key: 'name', label: 'Name', columns: ['name'] },
      { key: 'description', label: 'Description', columns: ['description'] },
      { key: 'email', label: 'Email', columns: ['email'] },
      { key: 'phone', label: 'Phone', columns: ['phone'] },
      { key: 'website', label: 'Website', columns: ['website'] },
      { key: 'location_id', label: 'Location', columns: ['location_id'] },
      {
        key: 'parent_organization_id',
        label: 'Parent organization',
        columns: ['parent_organization_id'],
      },
    ],
  },
};

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function isFieldEmpty(field: MergeFieldSpec, row: EntityRow): boolean {
  return field.columns.every((column) => isBlank(row[column]));
}

// Keep the primary's value unless it is empty and the secondary has one.
export function defaultChoice(
  field: MergeFieldSpec,
  primary: EntityRow,
  secondary: EntityRow
): MergeChoice {
  return isFieldEmpty(field, primary) && !isFieldEmpty(field, secondary) ? 'secondary' : 'primary';
}

/**
 * Column values to write onto the primary record. Fields without an explicit choice keep the
 * primary's value. A parent pointing at either merged record would become a self-reference once
 * the secondary is folded in, so it is cleared.
 */
export function buildMergedValues(
  spec: MergeEntitySpec,
  primary: EntityRow,
  secondary: EntityRow,
  choices: MergeChoices
): EntityRow {
  const merged: EntityRow = {};
  for (const field of spec.fields) {
    const source = choices[field.key] === 'secondary' ? secondary : primary;
    for (const column of field.columns) {
      merged[column] = source[column] ?? null;
    }
  }

  const parentId = merged[spec.parentColumn];
  if (parentId === primary.id || parentId === secondary.id) {
    merged[spec.parentColumn] = null;
  }
  return merged;
}
