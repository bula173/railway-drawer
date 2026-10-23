/**
 * @file rule-settings-dialog.ts
 * @brief Railway > Rule settings…: the configurable rule checks of the active diagram (on/off,
 *        severity, thresholds; English and Polish labels). Save stores them on the diagram
 *        (rule-settings.ts, one undoable edit); the live checks then run again.
 */
import type { GraphDataModel } from '@maxgraph/core';
import { openModal } from '../core/modal';
import './interlocking.css';
import type { RailwayNotifier } from './install-railway-data';
import type { RuleParamDef, RuleSettings, RuleSeverity } from './rule-settings';
import { RULE_DEFS, defaultRuleSettings, normalizeParam, readRuleSettings, setRuleSettings } from './rule-settings';

export interface RuleSettingsDialogOptions {
  model: GraphDataModel;
  notify: RailwayNotifier;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Opens the dialog; returns a function that closes it. */
export function openRuleSettingsDialog(options: RuleSettingsDialogOptions): () => void {
  document.querySelector('.rd-route-dialog-overlay')?.remove();
  const overlay = el('div', 'rd-route-dialog-overlay');
  const dialog = el('div', 'rd-route-dialog rd-rules-dialog');
  dialog.dataset.testid = 'rule-settings-dialog';
  overlay.append(dialog);
  const content = el('div', 'rd-route-dialog-content');
  content.append(
    el(
      'p',
      'rd-il-note',
      'Saved in this diagram. Distances are metres along the track: they need the tracks\' length or km start/end (else the rule is skipped with a note). Ustawienia reguł zapisywane w rysunku.'
    ),
    el(
      'p',
      'rd-il-note rd-rules-defaults-note',
      'The default thresholds are placeholders, not PKP PLK (or other) norms: set the values of your project and its regulations. Domyślne progi są przykładowe, nie są normami PKP PLK: ustaw wartości obowiązujące w projekcie.'
    )
  );
  const table = el('table', 'rd-rules-table');
  const head = el('tr');
  for (const h of ['On', 'Rule / Reguła', 'Severity', 'Thresholds / Progi']) head.append(el('th', undefined, h));
  table.append(el('thead'), el('tbody'));
  table.tHead!.append(head);
  const body = table.tBodies[0];

  interface Row {
    enabled: HTMLInputElement;
    severity: HTMLSelectElement;
    params: Map<string, { def: RuleParamDef; input: HTMLInputElement | HTMLSelectElement }>;
  }
  const rows = new Map<string, Row>();
  for (const d of RULE_DEFS) {
    const tr = el('tr');
    tr.dataset.rule = d.id;
    const enabled = el('input');
    enabled.type = 'checkbox';
    enabled.dataset.field = 'enabled';
    enabled.setAttribute('aria-label', `${d.label.en}: enabled`);
    const cell1 = el('td');
    cell1.append(enabled);
    const cell2 = el('td');
    cell2.append(el('div', 'rd-rules-label', d.label.en), el('div', 'rd-rules-pl', d.label.pl), el('div', 'rd-rules-help', d.help.en));
    const severity = el('select', 'rd-rules-severity');
    severity.dataset.field = 'severity';
    severity.setAttribute('aria-label', `${d.label.en}: severity`);
    for (const [v, t] of [['error', 'Error / błąd'], ['warning', 'Warning / ostrzeżenie']]) {
      const o = el('option', undefined, t);
      o.value = v;
      severity.append(o);
    }
    const cell3 = el('td');
    cell3.append(severity);
    const cell4 = el('td');
    const params = new Map<string, { def: RuleParamDef; input: HTMLInputElement | HTMLSelectElement }>();
    for (const p of d.params) {
      const wrap = el('label', 'rd-rules-param');
      wrap.append(el('span', undefined, `${p.label.en} / ${p.label.pl}`));
      let input: HTMLInputElement | HTMLSelectElement;
      if (p.options) {
        const sel = el('select');
        for (const opt of p.options) {
          const o = el('option', undefined, `${opt.label.en} / ${opt.label.pl}`);
          o.value = opt.value;
          sel.append(o);
        }
        input = sel;
      } else {
        const inp = el('input');
        inp.type = 'number';
        inp.step = 'any';
        if (p.min !== undefined) inp.min = String(p.min);
        if (p.max !== undefined) inp.max = String(p.max);
        input = inp;
      }
      input.dataset.param = p.key;
      wrap.append(input);
      if (p.unit) wrap.append(el('span', undefined, p.unit));
      cell4.append(wrap);
      params.set(p.key, { def: p, input });
    }
    if (d.params.length === 0) cell4.append(el('span', 'rd-rules-pl', '—'));
    tr.append(cell1, cell2, cell3, cell4);
    body.append(tr);
    rows.set(d.id, { enabled, severity, params });
  }
  const error = el('p', 'rd-rules-error');
  error.setAttribute('role', 'alert');
  content.append(table, error);

  const fill = (s: RuleSettings): void => {
    for (const d of RULE_DEFS) {
      const row = rows.get(d.id)!;
      row.enabled.checked = s[d.id].enabled;
      row.severity.value = s[d.id].severity;
      for (const [key, { input }] of row.params) input.value = String(s[d.id].params[key]);
    }
  };
  fill(readRuleSettings(options.model));

  const actions = el('div', 'rd-route-dialog-actions');
  const reset = el('button', 'rd-route-btn rd-rules-reset', 'Reset to defaults');
  reset.type = 'button';
  reset.addEventListener('click', () => fill(defaultRuleSettings()));
  const cancel = el('button', 'rd-route-btn rd-route-dialog-close', 'Cancel');
  cancel.type = 'button';
  const save = el('button', 'rd-route-btn rd-route-create rd-rules-save', 'Save');
  save.type = 'button';
  actions.append(reset, cancel, save);
  dialog.append(el('h3', 'rd-route-dialog-title', 'Rule settings'), content, actions);

  const modal = openModal({ overlay, dialog, label: 'Rule settings', backdropEvent: 'click' });
  const close = (): void => modal.close();
  cancel.addEventListener('click', close);
  save.addEventListener('click', () => {
    const next = defaultRuleSettings();
    const bad: string[] = [];
    for (const d of RULE_DEFS) {
      const row = rows.get(d.id)!;
      next[d.id].enabled = row.enabled.checked;
      next[d.id].severity = row.severity.value as RuleSeverity;
      for (const [key, { def, input }] of row.params) {
        const v = normalizeParam(def, input.value);
        if (v === null) bad.push(`${d.label.en}: ${def.label.en}`);
        else next[d.id].params[key] = v;
      }
      const { min, max } = next[d.id].params;
      if (typeof min === 'number' && typeof max === 'number' && min > max) bad.push(`${d.label.en}: min > max`);
    }
    if (bad.length > 0) {
      error.textContent = `Invalid value: ${bad.join('; ')}`;
      return;
    }
    const changed = setRuleSettings(options.model, next);
    options.notify.success(changed ? 'Rule settings saved in the diagram' : 'Rule settings unchanged');
    close();
  });
  save.focus();
  return close;
}
