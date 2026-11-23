/**
 * Series children often leave display fields blank and rely on the parent
 * event. The site's event page fills them in (src/pages/events/[id].astro);
 * this does the same for the newsletter so an issue shows what the site shows.
 */
export interface InheritableFields {
  description: string | null;
  external_image_url: string | null;
  image_alt_text: string | null;
  cost: string | null;
  location_id: string | null;
}

/** Columns to load for each parent from the base `events` table. */
export const INHERITABLE_COLUMNS =
  'id, description, external_image_url, image_alt_text, cost, location_id';

const isBlank = (value: string | null | undefined) => !value || value.trim() === '';

export function inheritParentFields<
  T extends InheritableFields & { parent_event_id: string | null },
>(rows: T[], parents: Map<string, InheritableFields>): T[] {
  return rows.map((row) => {
    const parent = row.parent_event_id ? parents.get(row.parent_event_id) : undefined;
    if (!parent) return row;
    // The image moves as a unit, so an own image never borrows the parent's alt text.
    const image = isBlank(row.external_image_url)
      ? { external_image_url: parent.external_image_url, image_alt_text: parent.image_alt_text }
      : {};
    return {
      ...row,
      ...image,
      description: isBlank(row.description) ? parent.description : row.description,
      cost: isBlank(row.cost) ? parent.cost : row.cost,
      location_id: row.location_id ?? parent.location_id,
    };
  });
}
