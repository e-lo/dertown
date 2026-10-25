/** Admin API collections that support DELETE /api/admin/<kind>/<id>. */
type DeletableKind = 'locations' | 'organizations';

/**
 * Asks the user to confirm, then deletes the record. Returns true only when the
 * record was deleted; failures are reported to the user with an alert.
 */
export async function confirmAndDelete(
  kind: DeletableKind,
  id: string,
  name: string
): Promise<boolean> {
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return false;
  const res = await fetch(`/api/admin/${kind}/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || `Failed to delete ${name}`);
    return false;
  }
  return true;
}
