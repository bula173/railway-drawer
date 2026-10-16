/**
 * @file checks-panel.ts
 * @brief Right-panel "Checks" view: railway data issues (click selects the cell), object counts,
 *        and the CSV/xlsx reports.
 */
import type { Issue } from './validation';
import { countIssues } from './validation';
import type { ReportId } from './report';
import { REPORTS } from './report';

export interface ChecksPanelOptions {
  container: HTMLElement;
  /** Run the checks now. */
  onRun: () => void;
  /** Live checks on/off changed. */
  onLiveChange: (live: boolean) => void;
  live: boolean;
  /** Select the issue's cell (and, with `edit`, open the Data panel on its field). */
  onSelect: (issue: Issue, edit: boolean) => void;
  onExport: (report: ReportId | 'xlsx') => void;
}

export interface ChecksResult {
  issues: Issue[];
  /** Object count by kind name (singular for 1, plural otherwise), for the summary. */
  objectCounts: Array<[string, number]>;
  /** Time of the run. */
  at: Date;
}

export interface ChecksPanel {
  show(result: ChecksResult | null): void;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function summaryText(issues: Issue[]): string {
  const { errors, warnings } = countIssues(issues);
  if (errors === 0 && warnings === 0) return 'No problems found';
  const parts: string[] = [];
  if (errors) parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
  if (warnings) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export function createChecksPanel(options: ChecksPanelOptions): ChecksPanel {
  const root = el('div', 'rd-rw-checks');
  const bar = el('div', 'rd-rw-checks-bar');
  const run = el('button', 'rd-rw-btn rd-rw-btn-primary', 'Run checks');
  run.type = 'button';
  run.dataset.action = 'run-checks';
  run.addEventListener('click', () => options.onRun());
  const liveLabel = el('label', 'rd-rw-check');
  const live = el('input');
  live.type = 'checkbox';
  live.checked = options.live;
  live.dataset.action = 'live-checks';
  live.addEventListener('change', () => options.onLiveChange(live.checked));
  liveLabel.append(live, el('span', undefined, 'Live'));
  liveLabel.title = 'Run the checks while you edit';
  bar.append(run, liveLabel);

  const summary = el('div', 'rd-rw-summary');
  summary.setAttribute('role', 'status');
  const objects = el('div', 'rd-rw-muted rd-rw-objects');
  const list = el('ul', 'rd-rw-issues');
  list.setAttribute('aria-label', 'Railway data issues');

  const reports = el('div', 'rd-rw-reports');
  reports.append(el('div', 'rd-rw-section-title', 'Reports (sorted by km)'));
  const buttons = el('div', 'rd-rw-report-buttons');
  for (const r of REPORTS) {
    const b = el('button', 'rd-rw-btn', `${r.title} (CSV)`);
    b.type = 'button';
    b.dataset.report = r.id;
    b.addEventListener('click', () => options.onExport(r.id));
    buttons.append(b);
  }
  const xlsx = el('button', 'rd-rw-btn', 'Workbook, all lists (.xlsx)');
  xlsx.type = 'button';
  xlsx.dataset.report = 'xlsx';
  xlsx.addEventListener('click', () => options.onExport('xlsx'));
  buttons.append(xlsx);
  reports.append(buttons);

  root.append(bar, summary, objects, list, reports);
  options.container.replaceChildren(root);

  function show(result: ChecksResult | null): void {
    list.replaceChildren();
    if (!result) {
      summary.textContent = 'Checks have not run yet.';
      summary.className = 'rd-rw-summary';
      objects.textContent = '';
      return;
    }
    const { errors } = countIssues(result.issues);
    summary.textContent = summaryText(result.issues);
    summary.className = `rd-rw-summary ${errors ? 'rd-rw-summary-error' : result.issues.length ? 'rd-rw-summary-warning' : 'rd-rw-summary-ok'}`;
    const total = result.objectCounts.reduce((n, [, c]) => n + c, 0);
    objects.textContent =
      total === 0
        ? 'No railway objects yet: insert ERTMS elements or give a shape a kind in the Data panel.'
        : `${total} railway object${total === 1 ? '' : 's'}: ${result.objectCounts.map(([k, c]) => `${c} ${k.toLowerCase()}`).join(', ')}`;
    for (const issue of result.issues) {
      const li = el('li', `rd-rw-issue rd-rw-issue-${issue.severity}`);
      li.dataset.rule = issue.rule;
      li.dataset.cellId = issue.cellId;
      const main = el('button', 'rd-rw-issue-main');
      main.type = 'button';
      main.title = 'Select this object';
      main.append(el('span', 'rd-rw-sev', issue.severity === 'error' ? 'Error' : 'Warning'), el('span', 'rd-rw-msg', issue.message));
      main.addEventListener('click', () => options.onSelect(issue, false));
      const edit = el('button', 'rd-rw-issue-edit', 'Edit');
      edit.type = 'button';
      edit.title = 'Select this object and edit its data';
      edit.addEventListener('click', () => options.onSelect(issue, true));
      li.append(main, edit);
      list.append(li);
    }
  }

  show(null);
  return {
    show,
    destroy() {
      root.remove();
    },
  };
}
