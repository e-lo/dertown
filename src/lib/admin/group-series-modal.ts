/**
 * Client logic for "Group as series" in the admin Approve Events queue.
 *
 * The dashboard renders one `.group-series-checkbox` per selectable row with
 * data-group-id / data-group-table / data-group-title / data-group-date attributes,
 * and dispatches `group-series:queue-rendered` on document after each render.
 * This module keeps the selection, renders the selection bar into #group-series-bar,
 * and drives #groupSeriesModal. On success it dispatches `group-series:done` on window.
 */

type ChildTable = 'events' | 'events_staged';

interface SelectedChild {
  id: string;
  table: ChildTable;
  title: string;
  date: string;
  /** Title of the parent this row is already linked to, if any. */
  currentParent: string;
}

interface NamedRef {
  id: string;
  name: string;
}

interface ParentOption {
  id: string;
  title: string;
  start_date?: string | null;
  parent_source?: string;
}

interface ReferenceData {
  tags: NamedRef[];
  locations: NamedRef[];
  organizations: NamedRef[];
  parents: ParentOption[];
}

interface QueueEventDetails {
  description?: string | null;
  primary_tag_id?: string | null;
  secondary_tag_id?: string | null;
  location_id?: string | null;
  organization_id?: string | null;
  website?: string | null;
  external_image_url?: string | null;
  cost?: string | null;
  location?: { name?: string } | null;
  organization?: { name?: string } | null;
}

const selection = new Map<string, SelectedChild>();
let referenceData: ReferenceData | null = null;
/** Set after a partial failure so a retry reuses the parent that was already created. */
let retryParent: ParentOption | null = null;

function keyFor(table: string, id: string): string {
  return `${table}:${id}`;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Selection + bar
// ---------------------------------------------------------------------------

function renderBar(): void {
  const bar = document.getElementById('group-series-bar');
  if (!bar) return;
  const count = selection.size;
  if (count === 0) {
    bar.classList.add('hidden');
    bar.style.display = '';
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  bar.style.display = 'flex';
  bar.innerHTML =
    `<span>${count} selected</span>` +
    '<button type="button" id="groupSeriesOpen" class="btn-save" style="margin-left:0.75rem;">Group as series</button>' +
    '<button type="button" id="groupSeriesClear" class="btn-cancel" style="margin-left:0.5rem;">Clear</button>';
  byId('groupSeriesOpen').addEventListener('click', openModal);
  byId('groupSeriesClear').addEventListener('click', clearSelection);
}

function clearSelection(): void {
  selection.clear();
  document
    .querySelectorAll<HTMLInputElement>('.group-series-checkbox')
    .forEach((box) => (box.checked = false));
  renderBar();
}

function onCheckboxChange(event: Event): void {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || !box.classList.contains('group-series-checkbox'))
    return;
  const { groupId, groupTable, groupTitle, groupDate, groupParent } = box.dataset;
  if (!groupId || (groupTable !== 'events' && groupTable !== 'events_staged')) return;
  const key = keyFor(groupTable, groupId);
  if (box.checked) {
    selection.set(key, {
      id: groupId,
      table: groupTable,
      title: groupTitle || '',
      date: groupDate || '',
      currentParent: groupParent || '',
    });
  } else {
    selection.delete(key);
  }
  renderBar();
}

/** After the queue re-renders, re-check surviving rows and drop selections that vanished. */
function onQueueRendered(): void {
  const present = new Set<string>();
  document.querySelectorAll<HTMLInputElement>('.group-series-checkbox').forEach((box) => {
    const key = keyFor(box.dataset.groupTable || '', box.dataset.groupId || '');
    present.add(key);
    box.checked = selection.has(key);
  });
  for (const key of [...selection.keys()]) {
    if (!present.has(key)) selection.delete(key);
  }
  renderBar();
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

async function loadReferenceData(): Promise<ReferenceData> {
  if (referenceData) return referenceData;
  const [tags, locations, organizations, parents] = await Promise.all([
    fetchJson<NamedRef[]>('/api/admin/tags'),
    fetchJson<NamedRef[]>('/api/admin/locations'),
    fetchJson<NamedRef[]>('/api/admin/organizations'),
    fetchJson<ParentOption[]>('/api/admin/parent-events'),
  ]);
  referenceData = {
    tags,
    locations,
    organizations,
    parents: parents.filter((p) => p.parent_source === 'events'),
  };
  return referenceData;
}

function fillSelect(select: HTMLSelectElement, items: NamedRef[], placeholder: string): void {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  }
}

function fillDatalist(list: HTMLDataListElement, values: string[]): void {
  list.innerHTML = '';
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    list.appendChild(option);
  }
}

function parentLabel(p: ParentOption): string {
  return p.start_date ? `${p.title} (${p.start_date})` : p.title;
}

function populateReferenceInputs(data: ReferenceData): void {
  fillSelect(byId<HTMLSelectElement>('groupSeriesPrimaryTag'), data.tags, 'Select primary tag…');
  fillSelect(byId<HTMLSelectElement>('groupSeriesSecondaryTag'), data.tags, 'None');
  fillDatalist(
    byId<HTMLDataListElement>('groupSeriesLocationOptions'),
    data.locations.map((l) => l.name)
  );
  fillDatalist(
    byId<HTMLDataListElement>('groupSeriesOrganizationOptions'),
    data.organizations.map((o) => o.name)
  );
  fillDatalist(
    byId<HTMLDataListElement>('groupSeriesParentOptions'),
    data.parents.map(parentLabel)
  );
}

function lookupIdByName(items: NamedRef[], typed: string): string | null {
  const needle = typed.trim().toLowerCase();
  if (!needle) return null;
  return items.find((item) => item.name.trim().toLowerCase() === needle)?.id ?? null;
}

function lookupParentId(parents: ParentOption[], typed: string): string | null {
  const needle = typed.trim().toLowerCase();
  if (!needle) return null;
  return parents.find((p) => parentLabel(p).toLowerCase() === needle)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function earliestSelected(): SelectedChild | null {
  const items = [...selection.values()].sort((a, b) => a.date.localeCompare(b.date));
  return items[0] ?? null;
}

async function fetchQueueEventDetails(child: SelectedChild): Promise<QueueEventDetails> {
  if (child.table === 'events') {
    const data = await fetchJson<{ event?: QueueEventDetails }>(`/api/admin/events/${child.id}`);
    return data.event ?? {};
  }
  const data = await fetchJson<{ events?: Array<QueueEventDetails & { id: string }> }>(
    '/api/admin/events-staged'
  );
  return data.events?.find((e) => e.id === child.id) ?? {};
}

function setParentMode(mode: 'new' | 'existing'): void {
  byId('groupSeriesNewFields').classList.toggle('hidden', mode !== 'new');
  byId('groupSeriesExistingFields').classList.toggle('hidden', mode !== 'existing');
}

function showError(message: string | null): void {
  const el = byId('groupSeriesError');
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

function renderChildrenList(): void {
  const items = [...selection.values()].sort((a, b) => a.date.localeCompare(b.date));
  byId('groupSeriesChildren').innerHTML = items
    .map((c) => {
      const moveNote = c.currentParent
        ? ` <span class="text-amber-700">— currently child of “${escapeHtml(c.currentParent)}”; will be moved</span>`
        : '';
      return (
        `<li>${escapeHtml(c.title)} <span class="text-gray-500">${escapeHtml(c.date)}</span>` +
        ` <span class="text-gray-400 italic">(${c.table === 'events_staged' ? 'staged' : 'pending'})</span>` +
        moveNote +
        '</li>'
      );
    })
    .join('');
}

/** Make sure a prefilled name resolves on submit even if the row's location/org is not in the approved list. */
function ensureKnown(items: NamedRef[], id: string | null | undefined, name: string): void {
  if (!id || !name) return;
  if (!items.some((item) => item.id === id)) items.push({ id, name });
}

async function prefillFromEarliest(data: ReferenceData): Promise<void> {
  const first = earliestSelected();
  if (!first) return;
  byId<HTMLInputElement>('groupSeriesTitle').value = first.title;
  let details: QueueEventDetails = {};
  try {
    details = await fetchQueueEventDetails(first);
  } catch (error) {
    console.error('[group-series] could not load event details for prefill:', error);
  }
  byId<HTMLTextAreaElement>('groupSeriesDescription').value = details.description || '';
  byId<HTMLSelectElement>('groupSeriesPrimaryTag').value = details.primary_tag_id || '';
  byId<HTMLSelectElement>('groupSeriesSecondaryTag').value = details.secondary_tag_id || '';
  byId<HTMLInputElement>('groupSeriesWebsite').value = details.website || '';
  byId<HTMLInputElement>('groupSeriesImageUrl').value = details.external_image_url || '';
  byId<HTMLInputElement>('groupSeriesCost').value = details.cost || '';
  const locationName =
    details.location?.name || data.locations.find((l) => l.id === details.location_id)?.name || '';
  const orgName =
    details.organization?.name ||
    data.organizations.find((o) => o.id === details.organization_id)?.name ||
    '';
  ensureKnown(data.locations, details.location_id, locationName);
  ensureKnown(data.organizations, details.organization_id, orgName);
  byId<HTMLInputElement>('groupSeriesLocation').value = locationName;
  byId<HTMLInputElement>('groupSeriesOrganization').value = orgName;
}

async function openModal(): Promise<void> {
  if (selection.size === 0) return;
  const modal = byId('groupSeriesModal');
  retryParent = null;
  showError(null);
  byId<HTMLFormElement>('groupSeriesForm').reset();
  byId<HTMLInputElement>('groupSeriesModeNew').checked = true;
  setParentMode('new');
  renderChildrenList();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const data = await loadReferenceData();
    populateReferenceInputs(data);
    await prefillFromEarliest(data);
  } catch (error) {
    showError(
      'Could not load reference data: ' + (error instanceof Error ? error.message : String(error))
    );
  }
}

function closeModal(): void {
  const modal = byId('groupSeriesModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function buildParentPayload(data: ReferenceData): Record<string, unknown> | { error: string } {
  const mode = byId<HTMLInputElement>('groupSeriesModeExisting').checked ? 'existing' : 'new';
  if (mode === 'existing') {
    const typed = byId<HTMLInputElement>('groupSeriesExistingParent').value;
    const id = lookupParentId(data.parents, typed);
    if (!id) return { error: 'Pick an existing parent from the list' };
    return { id };
  }
  const title = byId<HTMLInputElement>('groupSeriesTitle').value.trim();
  if (!title) return { error: 'Parent title is required' };
  const primaryTagId = byId<HTMLSelectElement>('groupSeriesPrimaryTag').value;
  if (!primaryTagId) return { error: 'Primary tag is required' };
  const locationTyped = byId<HTMLInputElement>('groupSeriesLocation').value;
  const orgTyped = byId<HTMLInputElement>('groupSeriesOrganization').value;
  const locationId = lookupIdByName(data.locations, locationTyped);
  const organizationId = lookupIdByName(data.organizations, orgTyped);
  if (locationTyped.trim() && !locationId) {
    return { error: 'Location must match an existing location (or leave it blank)' };
  }
  if (orgTyped.trim() && !organizationId) {
    return { error: 'Organization must match an existing organization (or leave it blank)' };
  }
  return {
    title,
    primary_tag_id: primaryTagId,
    secondary_tag_id: byId<HTMLSelectElement>('groupSeriesSecondaryTag').value || null,
    description: byId<HTMLTextAreaElement>('groupSeriesDescription').value,
    location_id: locationId,
    organization_id: organizationId,
    website: byId<HTMLInputElement>('groupSeriesWebsite').value,
    external_image_url: byId<HTMLInputElement>('groupSeriesImageUrl').value,
    cost: byId<HTMLInputElement>('groupSeriesCost').value,
  };
}

async function onSubmit(event: Event): Promise<void> {
  event.preventDefault();
  showError(null);
  const submit = byId<HTMLButtonElement>('groupSeriesSubmit');
  const data = referenceData;
  if (!data) {
    showError('Reference data is still loading; try again in a moment');
    return;
  }
  const parent = buildParentPayload(data);
  if ('error' in parent) {
    showError(parent.error as string);
    return;
  }
  const children = [...selection.values()].map((c) => ({ id: c.id, table: c.table }));

  submit.disabled = true;
  try {
    const res = await fetch('/api/admin/events/group-series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ children, parent }),
    });
    const result = (await res.json().catch(() => ({}))) as {
      error?: string;
      parent?: { id: string; title: string };
      linked?: number;
      failed?: string[];
    };
    if (!res.ok) {
      if (result.parent && result.linked && result.failed?.length) {
        prepareRetry(result.parent, result.failed, result.linked, data);
      }
      showError(result.error || `Request failed (${res.status})`);
      return;
    }
    closeModal();
    clearSelection();
    window.dispatchEvent(
      new CustomEvent('group-series:done', {
        detail: { parentTitle: result.parent?.title || '', linked: result.linked || 0 },
      })
    );
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Request failed');
  } finally {
    submit.disabled = false;
  }
}

/**
 * Some children were linked before the route hit an error. Drop the linked ones from the
 * selection, refresh the queue so their badges update, and switch the modal to "existing parent"
 * pointing at the parent that already exists, so resubmitting does not create a second parent.
 */
function prepareRetry(
  parent: { id: string; title: string },
  failedIds: string[],
  linkedCount: number,
  data: ReferenceData
): void {
  const failed = new Set(failedIds);
  for (const [key, child] of [...selection.entries()]) {
    if (!failed.has(child.id)) selection.delete(key);
  }
  retryParent = { id: parent.id, title: parent.title, parent_source: 'events' };
  if (!data.parents.some((p) => p.id === parent.id)) data.parents.unshift(retryParent);
  fillDatalist(
    byId<HTMLDataListElement>('groupSeriesParentOptions'),
    data.parents.map(parentLabel)
  );
  byId<HTMLInputElement>('groupSeriesModeExisting').checked = true;
  setParentMode('existing');
  byId<HTMLInputElement>('groupSeriesExistingParent').value = parentLabel(retryParent);
  renderChildrenList();
  window.dispatchEvent(
    new CustomEvent('group-series:done', {
      detail: { parentTitle: parent.title, linked: linkedCount },
    })
  );
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

export function initGroupSeries(): void {
  document.addEventListener('change', onCheckboxChange);
  document.addEventListener('group-series:queue-rendered', onQueueRendered);
  byId('groupSeriesForm').addEventListener('submit', onSubmit);
  byId('groupSeriesClose').addEventListener('click', closeModal);
  byId('groupSeriesCancel').addEventListener('click', closeModal);
  byId('groupSeriesModeNew').addEventListener('change', () => setParentMode('new'));
  byId('groupSeriesModeExisting').addEventListener('change', () => setParentMode('existing'));
}
