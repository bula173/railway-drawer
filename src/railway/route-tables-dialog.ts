/**
 * @file route-tables-dialog.ts
 * @brief Dialog with the route table, the interlocking table ("tablica zależności") and the
 *        conflict matrix of the active diagram (Railway > Route Table… / Interlocking Table… /
 *        Conflict Matrix…): CSV export of the shown table, an .xlsx workbook with the
 *        interlocking table and the matrix in a PKP-style layout (Polish headers; "English
 *        headers" switches the exports), the route table and the conflicting pairs
 *        (interlocking.ts, report.ts, xlsx.ts).
 */
import { openModal } from '../core/modal';
import './interlocking.css';
import type { Table } from './report';
import { tableToCsv } from './report';
import type { Interlocking, Lang } from './interlocking';
import { CONFLICT_CODE_LABELS, MATRIX_SELF, buildConflictMatrixTable, buildConflictPairsTable, buildInterlockingTable, codeLegend, conflictMatrix } from './interlocking';
import { buildXlsx } from './xlsx';

export type RouteTableTab = 'routes' | 'interlocking' | 'conflicts';

export interface RouteTablesDialogOptions {
  routes: Table;
  interlocking: Interlocking;
  tab: RouteTableTab;
  /** File name base (diagram name). */
  baseName: string;
  download: (blob: Blob, fileName: string) => void;
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NO_ROUTES = 'No routes yet: use the Route tool (Railway > Route Tool) to create one.';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTable(table: Table, empty: string, className = 'rd-route-table'): HTMLElement {
  if (table.rows.length === 0) return el('p', 'rd-route-empty', empty);
  const t = el('table', className);
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

function renderMatrix(il: Interlocking): HTMLElement {
  const m = conflictMatrix(il);
  const t = el('table', 'rd-il-matrix');
  t.setAttribute('aria-label', 'Conflict matrix');
  const head = el('thead');
  const hr = el('tr');
  hr.append(el('th', 'rd-il-corner', 'Route'));
  for (const r of il.routes) {
    const th = el('th', undefined, r.id);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = el('tbody');
  il.routes.forEach((r, i) => {
    const tr = el('tr');
    const th = el('th', undefined, r.id);
    th.scope = 'row';
    tr.append(th);
    il.routes.forEach((q, j) => {
      const codes = m[i][j];
      const td = el('td', codes === null ? 'rd-il-self' : codes.length > 0 ? 'rd-il-conflict' : 'rd-il-free', codes === null ? MATRIX_SELF : codes.join(' '));
      td.dataset.row = r.id;
      td.dataset.col = q.id;
      if (codes && codes.length > 0) {
        td.dataset.codes = codes.join('');
        td.title = `${r.id} / ${q.id}: ${codes.map((c) => CONFLICT_CODE_LABELS[c].en).join(', ')}`;
      }
      tr.append(td);
    });
    body.append(tr);
  });
  t.append(head, body);
  return t;
}

/** Opens the dialog; returns a function that closes it. */
export function openRouteTablesDialog(options: RouteTablesDialogOptions): () => void {
  document.querySelector('.rd-route-dialog-overlay')?.remove();
  const il = options.interlocking;
  let tab = options.tab;
  const overlay = el('div', 'rd-route-dialog-overlay');
  const dialog = el('div', 'rd-route-dialog');
  dialog.dataset.testid = 'route-tables-dialog';
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
  const buttons = [
    tabBtn('routes', `Route table (${options.routes.rows.length})`),
    tabBtn('interlocking', `Interlocking table (${il.routes.length})`),
    tabBtn('conflicts', `Conflicts (${il.conflicts.length})`),
  ];
  tabs.append(...buttons);

  const content = el('div', 'rd-route-dialog-content');
  const actions = el('div', 'rd-route-dialog-actions');
  const englishLabel = el('label', 'rd-il-english');
  const english = el('input');
  english.type = 'checkbox';
  english.dataset.action = 'english-headers';
  englishLabel.append(english, el('span', undefined, 'English headers'));
  englishLabel.title = 'Exports with English headers (default: Polish, PKP-style "Tablica zależności")';
  const lang = (): Lang => (english.checked ? 'en' : 'pl');

  const csv = el('button', 'rd-route-btn rd-route-export-csv', 'Export CSV');
  csv.type = 'button';
  csv.addEventListener('click', () => {
    const [table, suffix] =
      tab === 'routes' ? [options.routes, 'routes'] : tab === 'interlocking' ? [buildInterlockingTable(il, lang()), 'interlocking'] : [buildConflictMatrixTable(il, lang()), 'conflict-matrix'];
    options.download(new Blob([tableToCsv(table)], { type: 'text/csv;charset=utf-8' }), `${options.baseName}-${suffix}.csv`);
  });
  const xlsx = el('button', 'rd-route-btn rd-route-export-xlsx', 'Export XLSX');
  xlsx.type = 'button';
  xlsx.addEventListener('click', () => {
    const l = lang();
    const bytes = buildXlsx([buildInterlockingTable(il, l), buildConflictMatrixTable(il, l), options.routes, buildConflictPairsTable(il, l)]);
    options.download(new Blob([bytes as BlobPart], { type: XLSX_TYPE }), `${options.baseName}-routes.xlsx`);
  });
  const closeBtn = el('button', 'rd-route-btn rd-route-dialog-close', 'Close');
  closeBtn.type = 'button';
  actions.append(englishLabel, csv, xlsx, closeBtn);

  dialog.append(el('h3', 'rd-route-dialog-title', 'Routes and interlocking'), tabs, content, actions);

  function render(): void {
    for (const b of buttons) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    content.dataset.tab = tab;
    if (tab === 'routes') {
      content.replaceChildren(renderTable(options.routes, NO_ROUTES));
    } else if (tab === 'interlocking') {
      const parts: HTMLElement[] = [renderTable(buildInterlockingTable(il, 'en'), NO_ROUTES, 'rd-route-table rd-il-table')];
      const missing = il.routes.filter((r) => !r.pathFound);
      if (missing.length > 0) parts.push(el('p', 'rd-il-note', `No path in the drawing for ${missing.map((r) => `${r.id} (${r.problem ?? 'no path'})`).join(', ')}: their stored data is shown, without flank protection.`));
      content.replaceChildren(...parts);
    } else if (il.routes.length === 0) {
      content.replaceChildren(el('p', 'rd-route-empty', NO_ROUTES));
    } else {
      content.replaceChildren(
        el('p', 'rd-il-legend', codeLegend('en')),
        renderMatrix(il),
        el('h4', 'rd-il-subtitle', 'Conflicting routes'),
        renderTable(buildConflictPairsTable(il, 'en'), 'No conflicting routes.')
      );
    }
  }

  render();
  // Esc / backdrop / Close, focus trap and return: the app's modal primitive (core/modal.ts)
  const modal = openModal({ overlay, dialog, label: 'Route and interlocking tables', backdropEvent: 'click' });
  const close = (): void => modal.close();
  closeBtn.addEventListener('click', close);
  closeBtn.focus();
  return close;
}
