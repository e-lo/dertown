/**
 * Shared sortable table logic for admin list pages.
 * Pages specify: data, columns, initial sort, max rows, expandable.
 */

import Tablesort from 'tablesort';

const escapeHtml = (s: string) => String(s ?? '').replace(/</g, '&lt;');

export function formatLastEdited(updatedAt: string | null | undefined): string {
  if (!updatedAt) return '—';
  const d = new Date(updatedAt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface SortableTableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  headerClass?: string;
  /** Used for initial sort; if absent, uses sortValue from render */
  getSortValue?: (row: T) => string | number;
  render: (row: T) => { html: string; sortValue?: string };
}

export interface SortableTableConfig<T = Record<string, unknown>> {
  data: T[];
  columns: SortableTableColumn<T>[];
  initialSortColumn: string;
  initialSortDesc?: boolean;
  maxRows?: number;
  expandable?: boolean;
  emptyMessage?: string;
  rowIdPrefix?: string;
}

export function renderSortableTable<T extends Record<string, unknown>>(
  container: HTMLElement | null,
  config: SortableTableConfig<T>
): void {
  if (!container) return;

  const {
    data,
    columns,
    initialSortColumn,
    initialSortDesc = false,
    maxRows,
    expandable = false,
    emptyMessage = 'No data.',
    rowIdPrefix,
  } = config;

  if (data.length === 0) {
    container.innerHTML = `<p class="text-gray-600">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  const sortCol = columns.find((c) => c.key === initialSortColumn);
  const sortedData = sortCol
    ? [...data].sort((a, b) => {
        const getVal = sortCol.getSortValue ?? ((r) => sortCol.render(r).sortValue ?? '');
        const va = String(getVal(a) ?? '');
        const vb = String(getVal(b) ?? '');
        const cmp = va.localeCompare(vb, undefined, { numeric: true });
        return initialSortDesc ? -cmp : cmp;
      })
    : data;

  const hasMore = expandable && maxRows != null && sortedData.length > maxRows;
  const visibleData = hasMore ? sortedData.slice(0, maxRows) : sortedData;

  const thClass = 'p-3 cursor-pointer hover:bg-gray-200 select-none';
  const alignClass = (align?: string) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  const headerCells = columns
    .map((col) => {
      const align = alignClass(col.align);
      const extraClass = col.headerClass ?? '';
      const sortable = col.sortable !== false;
      const title = sortable ? ` title="Sort by ${col.label.toLowerCase()}"` : '';
      const dataAttr = !sortable ? ' data-sort-method="none"' : '';
      return `<th class="${align} ${thClass} ${extraClass}"${title}${dataAttr}>${escapeHtml(col.label)}</th>`;
    })
    .join('');

  const rows = visibleData
    .map((row, idx) => {
      const rowId = rowIdPrefix && row.id ? ` id="${rowIdPrefix}${escapeHtml(String(row.id))}"` : '';
      const cells = columns
        .map((col) => {
          const { html, sortValue } = col.render(row);
          const dataSort = sortValue != null ? ` data-sort="${escapeHtml(String(sortValue))}"` : '';
          const align = alignClass(col.align);
          return `<td class="p-3 ${align}"${dataSort}>${html}</td>`;
        })
        .join('');
      return `<tr class="border-t border-gray-200 hover:bg-gray-50"${rowId}>${cells}</tr>`;
    })
    .join('');

  let tableHtml =
    '<table class="w-full border border-gray-200 rounded-lg overflow-hidden sortable-table">' +
    `<thead class="bg-gray-100"><tr>${headerCells}</tr></thead>` +
    `<tbody>${rows}</tbody></table>`;

  if (hasMore) {
    const moreCount = data.length - (maxRows ?? 0);
    tableHtml +=
      `<div class="mt-3"><button type="button" class="text-sm text-blue-600 hover:underline" data-sortable-show-more>Show ${moreCount} more</button></div>`;
  }

  container.innerHTML = tableHtml;

  const tableEl = container.querySelector('table');
  if (tableEl instanceof HTMLTableElement) {
    const TS = Tablesort as unknown as new (el: HTMLTableElement, opts?: { descending?: boolean }) => { refresh: () => void };
    const sortColIdx = columns.findIndex((c) => c.key === initialSortColumn);
    const defaultSort = sortColIdx >= 0 ? initialSortDesc : false;
    new TS(tableEl, { descending: defaultSort });
  }

  const showMoreBtn = container.querySelector('[data-sortable-show-more]');
  if (showMoreBtn && hasMore) {
    showMoreBtn.addEventListener('click', () => {
      const fullConfig: SortableTableConfig<T> = { ...config, maxRows: undefined, expandable: false };
      renderSortableTable(container, fullConfig);
    });
  }
}

/** Helper: text column from a path */
export function textColumn<T>(key: string, label: string, path: keyof T | ((row: T) => unknown)): SortableTableColumn<T> {
  const getVal = (row: T) => (typeof path === 'function' ? path(row) : (row as Record<string, unknown>)[path as string]);
  return {
    key,
    label,
    getSortValue: (row) => String(getVal(row) ?? ''),
    render: (row) => {
      const val = getVal(row);
      const s = val != null ? String(val) : '—';
      return { html: escapeHtml(s), sortValue: s };
    },
  };
}

/** Helper: status column with color (approved=green, cancelled=red, else amber) */
export function statusColumn<T>(key: string, label: string, path: keyof T | ((row: T) => string | undefined)): SortableTableColumn<T> {
  const getVal = (row: T) => (typeof path === 'function' ? path(row) : (row as Record<string, unknown>)[path as string]);
  return {
    key,
    label,
    getSortValue: (row) => String(getVal(row) ?? ''),
    render: (row) => {
      const val = getVal(row);
      const s = val != null ? String(val) : '—';
      const cls = s === 'approved' ? 'text-green-600' : s === 'cancelled' ? 'text-red-600' : 'text-amber-600';
      return { html: `<span class="text-sm ${cls}">${escapeHtml(s)}</span>`, sortValue: s };
    },
  };
}

/** Helper: last-edited column using updated_at */
export function lastEditedColumn<T extends { updated_at?: string | null }>(key: string, label: string): SortableTableColumn<T> {
  return {
    key,
    label,
    headerClass: 'whitespace-nowrap',
    getSortValue: (row) => row.updated_at ?? '0000-00-00',
    render: (row) => {
      const raw = row.updated_at ?? '';
      const display = formatLastEdited(raw);
      const sortVal = raw || '0000-00-00';
      const title = raw ? ` title="${escapeHtml(new Date(raw).toISOString())}"` : '';
      return {
        html: `<span class="text-gray-600 text-sm whitespace-nowrap"${title}>${escapeHtml(display || '—')}</span>`,
        sortValue: sortVal,
      };
    },
  };
}

/** Helper: icon badge column (yes/no icon with sort value 1/0) */
export function iconBadgeColumn<T>(
  key: string,
  label: string,
  getHas: (row: T) => boolean,
  yesIcon: string,
  noIcon: string,
  yesTitle: string,
  noTitle: string
): SortableTableColumn<T> {
  return {
    key,
    label,
    align: 'center',
    headerClass: 'w-20',
    getSortValue: (row) => (getHas(row) ? '1' : '0'),
    render: (row) => {
      const has = getHas(row);
      const sortVal = has ? '1' : '0';
      const cls = has ? 'text-green-600' : 'text-amber-600';
      const title = has ? yesTitle : noTitle;
      const icon = has ? yesIcon : noIcon;
      const html = `<span class="${cls}" title="${escapeHtml(title)}"><span class="material-symbols-outlined" style="font-size:1.1rem;">${escapeHtml(icon)}</span></span>`;
      return { html, sortValue: sortVal };
    },
  };
}

/** Helper: derived text column with optional custom sort value */
export function derivedColumn<T>(
  key: string,
  label: string,
  getDisplay: (row: T) => string,
  getSortValue?: (row: T) => string
): SortableTableColumn<T> {
  return {
    key,
    label,
    getSortValue: getSortValue ?? ((row) => getDisplay(row)),
    render: (row) => {
      const s = getDisplay(row) || '—';
      return { html: escapeHtml(s), sortValue: getSortValue ? getSortValue(row) : s };
    },
  };
}

/** Helper: actions column (View + Edit links/buttons) */
export function actionsColumn<T extends { id: string }>(
  key: string,
  getViewHref: (row: T) => string,
  getEditAction: (row: T) => { href?: string; onclick?: string }
): SortableTableColumn<T> {
  return {
    key,
    label: '',
    sortable: false,
    headerClass: 'w-24',
    render: (row) => {
      const viewHref = getViewHref(row);
      const edit = getEditAction(row);
      const viewLink = `<a href="${escapeHtml(viewHref)}" class="icon-btn btn-edit" style="padding:0.5rem;min-width:auto;margin-right:0.25rem;text-decoration:none;" target="_blank" aria-label="View"><span class="material-symbols-outlined" style="font-size:1.25rem;">visibility</span><span class="tooltip">View</span></a>`;
      let editEl: string;
      if (edit.href) {
        editEl = `<a href="${escapeHtml(edit.href)}" class="icon-btn btn-edit" style="padding:0.5rem;min-width:auto;" aria-label="Edit"><span class="material-symbols-outlined" style="font-size:1.25rem;">edit</span><span class="tooltip">Edit</span></a>`;
      } else {
        editEl = `<button type="button" onclick="${escapeHtml(edit.onclick ?? '')}" class="icon-btn btn-edit" style="padding:0.5rem;min-width:auto;" aria-label="Edit"><span class="material-symbols-outlined" style="font-size:1.25rem;">edit</span><span class="tooltip">Edit</span></button>`;
      }
      return { html: `<span style="white-space:nowrap;">${viewLink}${editEl}</span>` };
    },
  };
}
