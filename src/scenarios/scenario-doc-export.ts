/**
 * @file scenario-doc-export.ts
 * @brief Options dialog of "Export Scenario (PDF)…" and "Export Scenario (Slides)…": which scenario
 *        (when there is a choice), A4 portrait/landscape (PDF) and "Highlight changes".
 */
import type { ScenarioData } from './scenario-model';
import type { PdfOrientation } from './scenario-pdf';
import './scenario-doc.css';

export type ScenarioDocFormat = 'pdf' | 'slides';

export interface ScenarioDocChoice {
  scenarioId: string;
  orientation: PdfOrientation;
  showChanges: boolean;
}

export interface ScenarioDocDialogOptions {
  format: ScenarioDocFormat;
  /** Scenarios offered (those without steps are disabled). */
  scenarios: ScenarioData[];
  /** Preselected scenario (null: the first with steps). */
  initialScenarioId: string | null;
  /** Initial "Highlight changes" state (e.g. the view's "Show changes"). */
  showChanges: boolean;
}

/** localStorage key of the last PDF orientation. */
export const PDF_ORIENTATION_KEY = 'rd.scenario.pdfOrientation';

function readOrientation(): PdfOrientation {
  try {
    return localStorage.getItem(PDF_ORIENTATION_KEY) === 'landscape' ? 'landscape' : 'portrait';
  } catch {
    return 'portrait';
  }
}

function writeOrientation(value: PdfOrientation): void {
  try {
    localStorage.setItem(PDF_ORIENTATION_KEY, value);
  } catch {
    // storage blocked
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Modal with the export options; resolves null when cancelled. */
export function openScenarioDocDialog(opts: ScenarioDocDialogOptions): Promise<ScenarioDocChoice | null> {
  return new Promise((resolve) => {
    const withSteps = opts.scenarios.filter((s) => s.steps.length > 0);
    const overlay = el('div', 'rd-tpl-modal-overlay');
    const dialog = el('div', 'rd-tpl-modal rd-scn-export-options');
    dialog.dataset.testid = 'scenario-doc-export-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const titleText = opts.format === 'pdf' ? 'Export scenario as PDF' : 'Export scenario as slides';
    dialog.setAttribute('aria-label', titleText);
    dialog.appendChild(el('h2', 'rd-tpl-modal-title', titleText));

    let select: HTMLSelectElement | null = null;
    if (opts.scenarios.length > 1) {
      select = el('select', 'rd-scn-export-scenario');
      select.name = 'scenario';
      select.setAttribute('aria-label', 'Scenario');
      for (const s of opts.scenarios) {
        const option = el('option', undefined, `${s.name} (${s.steps.length} step${s.steps.length === 1 ? '' : 's'})`);
        option.value = s.id;
        option.disabled = s.steps.length === 0;
        select.appendChild(option);
      }
      select.value = opts.initialScenarioId ?? withSteps[0]?.id ?? '';
      dialog.appendChild(select);
    }

    const orientationRadios: HTMLInputElement[] = [];
    if (opts.format === 'pdf') {
      const fs = el('fieldset');
      fs.appendChild(el('legend', undefined, 'Page (A4)'));
      const current = readOrientation();
      for (const [value, label] of [
        ['portrait', 'Portrait'],
        ['landscape', 'Landscape'],
      ] as const) {
        const row = el('label');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = 'orientation';
        radio.value = value;
        radio.checked = value === current;
        orientationRadios.push(radio);
        row.append(radio, document.createTextNode(label));
        fs.appendChild(row);
      }
      dialog.appendChild(fs);
    }
    const fsChanges = el('fieldset');
    fsChanges.appendChild(el('legend', undefined, 'Content'));
    const changesRow = el('label');
    const changes = el('input');
    changes.type = 'checkbox';
    changes.name = 'showChanges';
    changes.checked = opts.showChanges;
    changesRow.append(changes, document.createTextNode('Highlight changes to the previous step (and list them)'));
    fsChanges.appendChild(changesRow);
    dialog.appendChild(fsChanges);

    const actions = el('div', 'rd-tpl-modal-actions');
    const cancel = el('button', 'rd-tpl-btn', 'Cancel');
    cancel.type = 'button';
    const ok = el('button', 'rd-tpl-btn rd-tpl-btn-primary', opts.format === 'pdf' ? 'Export PDF' : 'Export slides');
    ok.type = 'button';
    actions.append(cancel, ok);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    const finish = (value: ScenarioDocChoice | null): void => {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(value);
    };
    const submit = (): void => {
      const scenarioId = select ? select.value : (opts.initialScenarioId ?? withSteps[0]?.id ?? '');
      if (!scenarioId) return;
      const orientation: PdfOrientation = orientationRadios.find((r) => r.checked)?.value === 'landscape' ? 'landscape' : 'portrait';
      if (opts.format === 'pdf') writeOrientation(orientation);
      finish({ scenarioId, orientation, showChanges: changes.checked });
    };
    const onKey = (evt: KeyboardEvent): void => {
      // keep keys away from the editor's shortcut dispatcher while the dialog is open
      evt.stopPropagation();
      if (evt.key === 'Escape') {
        evt.preventDefault();
        finish(null);
      } else if (evt.key === 'Enter' && !(evt.target instanceof HTMLButtonElement)) {
        evt.preventDefault();
        submit();
      }
    };
    cancel.addEventListener('click', () => finish(null));
    ok.addEventListener('click', submit);
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    ok.focus();
  });
}
