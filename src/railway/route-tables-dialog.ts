/**
 * @file route-tables-dialog.ts
 * @brief Dialog with the route table and the interlocking (conflict) table of the active diagram
 *        (Extras > Route Table… / Interlocking Table…), with CSV export of the shown table and an
 *        .xlsx workbook with both (report.ts / xlsx.ts).
 */
import type { Table } from './report';
import { tableToCsv } from './report';
import { buildXlsx } from './xlsx';

export type RouteTableTab = 'routes' | 'conflicts';

export interface RouteTablesDialogOptions {
  routes: Table;
  conflicts: Table;
  tab: RouteTableTab;
  /** File name base (diagram name). */
  baseName: string;
  download: (blob: Blob, fileName: string) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTable(table: Table, empty: string): HTMLElement {
  if (table.rows.length === 0) return el('p', 'rd-route-empty', empty);
  const t = el('table', 'rd-route-table');
  const head = el('thead');
  const hr = el('tr');
  for (const c of table.columns) hr.append(el('th', undefined, c));
  head.append(hr);
  const body = el('tbody');
  for (const row of table.rows) {
    const tr = el('tr');
    for (const v of row) tr.append(el('td', undefined, String(v)));
    body.append(tr);
  }
  t.append(head, body);
  return t;
}

/** Opens the dialog; returns a function that closes it. */
export function openRouteTablesDialog(options: RouteTablesDialogOptions): () => void {
  document.querySelector('.rd-route-dialog-overlay')?.remove();
  let tab = options.tab;
  const overlay = el('div', 'rd-route-dialog-overlay');
  const dialog = el('div', 'rd-route-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Route and interlocking tables');
  overlay.append(dialog);

  const tabs = el('div', 'rd-route-tabs');
  tabs.setAttribute('role', 'tablist');
  const tabBtn = (id: RouteTableTab, label: string): HTMLButtonElement => {
    const b = el('button', 'rd-route-tab', label);
    b.type = 'button';
    b.dataset.tab = id;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => {
      tab = id;
      render();
    });
    return b;
  };
  const routesBtn = tabBtn('routes', `Route table (${options.routes.rows.length})`);
  const conflictsBtn = tabBtn('conflicts', `Interlocking / conflicts (${options.conflicts.rows.length})`);
  tabs.append(routesBtn, conflictsBtn);

  const content = el('div', 'rd-route-dialog-content');
  const actions = el('div', 'rd-route-dialog-actions');
  const csv = el('button', 'rd-route-btn rd-route-export-csv', 'Export CSV');
  csv.type = 'button';
  csv.addEventListener('click', () => {
    const table = tab === 'routes' ? options.routes : options.conflicts;
    const suffix = tab === 'routes' ? 'routes' : 'interlocking';
    options.download(new Blob([tableToCsv(table)], { type: 'text/csv;charset=utf-8' }), `${options.baseName}-${suffix}.csv`);
  });
  const xlsx = el('button', 'rd-route-btn rd-route-export-xlsx', 'Export XLSX');
  xlsx.type = 'button';
  xlsx.addEventListener('click', () => {
    const bytes = buildXlsx([options.routes, options.conflicts]);
    options.download(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${options.baseName}-routes.xlsx`);
  });
  const closeBtn = el('button', 'rd-route-btn rd-route-dialog-close', 'Close');
  closeBtn.type = 'button';
  actions.append(csv, xlsx, closeBtn);

  dialog.append(el('h3', 'rd-route-dialog-title', 'Routes and interlocking'), tabs, content, actions);

  function render(): void {
    routesBtn.setAttribute('aria-selected', String(tab === 'routes'));
    conflictsBtn.setAttribute('aria-selected', String(tab === 'conflicts'));
    content.dataset.tab = tab;
    content.replaceChildren(
      tab === 'routes'
        ? renderTable(options.routes, 'No routes yet: use the Route tool (Extras > Route Tool) to create one.')
        : renderTable(options.conflicts, 'No conflicting routes.')
    );
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    e.stopPropagation();
  };
  function close(): void {
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
  }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('keydown', onKey, true);
  render();
  document.body.append(overlay);
  closeBtn.focus();
  return close;
}
