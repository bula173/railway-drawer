/**
 * @file data-panel.ts
 * @brief Right-panel "Data" view: railway object kind and typed fields of the selected cells.
 *
 * - Kind selector (any shape can become a railway object; "none" removes the data).
 * - Fields by type: text, number/km with unit and range, enum select, references with
 *   autocomplete (a datalist of the IDs of the allowed kinds).
 * - Several selected cells of the same kind are edited together: fields with different values
 *   show "(mixed)", a change sets the value on all of them (the ID only for a single cell).
 * - Every change is one undoable model edit (object-data.ts `setRailwayData`).
 * - Problems the checks find for a field are shown under it.
 */
import type { Cell, Graph } from '@maxgraph/core';
import type { FieldDef, KindDef, KindId } from './catalogue';
import { KINDS, getKind, normalizeFieldInput } from './catalogue';
import { getCellKind, getRawKind, labelIdChange, labelShowsId, readField, readObjectId, setRailwayData } from './object-data';
import type { Issue } from './validation';
import { collectObjects } from './validation';

export interface RailwayDataPanelOptions {
  container: HTMLElement;
  getGraph: () => Graph | null;
  /** Current check results (for problems under the fields). */
  getIssues?: () => Issue[];
}

export interface RailwayDataPanel {
  /** Re-reads the selection and the values (keeps the field being edited). */
  refresh(): void;
  /** Focuses a field (`key`) or the first editable one. */
  focusField(key?: string): void;
  destroy(): void;
}

const MIXED = '(mixed)';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The cells the panel edits: the selected vertices and edges. */
function selectedCells(graph: Graph): Cell[] {
  return graph.getSelectionCells().filter((c) => c.isVertex() || c.isEdge());
}

/** The common kind of the cells: a kind, null (none), or 'mixed'. */
function commonKind(cells: Cell[]): KindId | null | 'mixed' {
  let kind: KindId | null | undefined;
  for (const c of cells) {
    const k = getCellKind(c);
    if (kind === undefined) kind = k;
    else if (kind !== k) return 'mixed';
  }
  return kind ?? null;
}

/** The common value of a field, or null when the cells differ. */
function commonValue(cells: Cell[], f: FieldDef): string | null {
  let value: string | null = null;
  for (const [i, c] of cells.entries()) {
    const v = readField(c, f);
    if (i === 0) value = v;
    else if (v !== value) return null;
  }
  return value ?? '';
}

function describeSelection(cells: Cell[]): string {
  if (cells.length === 1) {
    const kind = getKind(getCellKind(cells[0]));
    if (!kind) return getRawKind(cells[0]) ? `Unknown kind "${getRawKind(cells[0])}"` : 'Shape without railway data';
    const id = readObjectId(cells[0]);
    return id ? `${kind.label} ${id}` : `${kind.label} (no ID)`;
  }
  const counts = new Map<KindDef | null, number>();
  for (const c of cells) {
    const kind = getKind(getCellKind(c));
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const names = [...counts].map(([kind, n]) => {
    const name = kind ? (n === 1 ? kind.label : kind.plural) : n === 1 ? 'other shape' : 'other shapes';
    return `${n} ${name.toLowerCase()}`;
  });
  return `${cells.length} selected: ${names.join(', ')}`;
}

export function createRailwayDataPanel(options: RailwayDataPanelOptions): RailwayDataPanel {
  const root = el('div', 'rd-rw-data');
  options.container.replaceChildren(root);
  let signature = '';
  let destroyed = false;
  // Field controls of the current render, by key
  let controls = new Map<string, { field: FieldDef; input: HTMLInputElement | HTMLSelectElement; problem: HTMLElement }>();
  let kindSelect: HTMLSelectElement | null = null;
  let labelToggle: HTMLInputElement | null = null;

  const cellsNow = (): { graph: Graph; cells: Cell[] } | null => {
    const graph = options.getGraph();
    if (!graph) return null;
    return { graph, cells: selectedCells(graph) };
  };

  /**
   * Edits go to the graph and cells the fields were rendered for (`Target`, captured per render),
   * not to the current selection: a field loses focus (and fires its change event) only after a
   * click on the canvas has already selected another cell.
   */
  type Target = { graph: Graph; cells: Cell[] };

  const commit = (t: Target, change: Parameters<typeof setRailwayData>[2], autoId = false): void => {
    const model = t.graph.getDataModel();
    const cells = t.cells.filter((c) => model.contains(c));
    if (cells.length === 0) return;
    setRailwayData(model, cells, change, { autoId });
    refresh();
  };

  function renderEmpty(text: string): void {
    controls = new Map();
    kindSelect = null;
    labelToggle = null;
    const hint = el('div', 'rd-rw-empty');
    hint.append(el('p', undefined, text));
    hint.append(
      el(
        'p',
        'rd-rw-muted',
        'Railway objects (signals, balises, track sections, points, …) carry typed data that is saved in the .drawio file as draw.io object attributes.'
      )
    );
    root.replaceChildren(hint);
  }

  function renderFields(graph: Graph, cells: Cell[]): void {
    const t: Target = { graph, cells: [...cells] };
    controls = new Map();
    const frag = document.createDocumentFragment();
    frag.append(el('div', 'rd-rw-title', describeSelection(cells)));

    // Kind
    const kindRow = el('label', 'rd-rw-row');
    kindRow.append(el('span', 'rd-rw-label', 'Object kind'));
    const select = el('select', 'rd-rw-input');
    select.id = 'rd-rw-kind';
    select.dataset.field = 'kind';
    const common = commonKind(cells);
    if (common === 'mixed') {
      const mixed = el('option', undefined, MIXED);
      mixed.value = '__mixed';
      mixed.disabled = true;
      select.append(mixed);
    }
    const none = el('option', undefined, '— none (plain shape) —');
    none.value = '';
    select.append(none);
    for (const k of KINDS) {
      const o = el('option', undefined, k.label);
      o.value = k.id;
      select.append(o);
    }
    select.value = common === 'mixed' ? '__mixed' : common ?? '';
    select.addEventListener('change', () => {
      if (select.value === '__mixed') return;
      commit(t, { kind: select.value === '' ? null : (select.value as KindId) }, true);
    });
    kindRow.append(select);
    frag.append(kindRow);
    kindSelect = select;

    const kind = common !== 'mixed' ? getKind(common) : null;
    if (common === 'mixed') {
      frag.append(el('p', 'rd-rw-muted', 'The selected shapes have different kinds: choose one kind to edit them together.'));
    } else if (!kind) {
      frag.append(el('p', 'rd-rw-muted', 'Choose a kind to turn this shape into a railway object.'));
    } else {
      frag.append(renderKindFields(t, kind));
    }
    root.replaceChildren(frag);
  }

  function renderKindFields(t: Target, kind: KindDef): HTMLElement {
    const { graph, cells } = t;
    const form = el('div', 'rd-rw-fields');
    const objects = collectObjects(graph.getDataModel());
    for (const f of kind.fields) {
      const row = el('div', 'rd-rw-row');
      const id = `rd-rw-f-${f.key}`;
      const label = el('label', 'rd-rw-label', f.unit ? `${f.label} [${f.unit}]` : f.label);
      label.htmlFor = id;
      row.append(label);
      let input: HTMLInputElement | HTMLSelectElement;
      if (f.type === 'enum') {
        const s = el('select', 'rd-rw-input');
        const empty = el('option', undefined, '—');
        empty.value = '';
        s.append(empty);
        for (const o of f.options ?? []) {
          const opt = el('option', undefined, o.label);
          opt.value = o.value;
          s.append(opt);
        }
        input = s;
      } else {
        const i = el('input', 'rd-rw-input');
        i.type = 'text';
        i.autocomplete = 'off';
        i.spellcheck = false;
        if (f.type === 'number' || f.type === 'integer' || f.type === 'km') i.inputMode = 'decimal';
        if (f.type === 'ref' || f.type === 'refList') {
          const list = el('datalist');
          list.id = `${id}-list`;
          const ids = objects.filter((o) => f.refKinds?.includes(o.kind.id) && o.id).map((o) => o.id);
          for (const refId of [...new Set(ids)].sort()) {
            const opt = el('option');
            opt.value = refId;
            list.append(opt);
          }
          row.append(list);
          i.setAttribute('list', list.id);
        }
        const range = f.min !== undefined && f.max !== undefined ? `${f.min}–${f.max}` : '';
        i.title = [f.help, range && `Range ${range}${f.unit ? ` ${f.unit}` : ''}`].filter(Boolean).join(' · ');
        input = i;
      }
      input.id = id;
      input.dataset.field = f.key;
      if (f.key === 'id' && cells.length > 1) {
        input.disabled = true;
        input.title = 'Select a single object to change its ID';
      }
      input.addEventListener('change', () => {
        const value = input.value === '__mixed' ? null : input.value;
        if (value === null) return;
        commit(t, { values: { [f.key]: normalizeFieldInput(f, value) } });
      });
      if (input instanceof HTMLInputElement) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.dispatchEvent(new Event('change'));
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setControlValue(f, input, t.cells);
            input.blur();
          }
        });
      }
      row.append(input);
      const hint = el('div', 'rd-rw-hint');
      const problem = el('div', 'rd-rw-problem');
      if (f.help && f.type !== 'ref') hint.textContent = f.help;
      row.append(problem, hint);
      form.append(row);
      controls.set(f.key, { field: f, input, problem });
    }

    // Label shows the ID (draw.io placeholder %rdId%)
    const toggleRow = el('label', 'rd-rw-row rd-rw-check');
    const toggle = el('input');
    toggle.type = 'checkbox';
    toggle.id = 'rd-rw-label-id';
    toggle.addEventListener('change', () => {
      const show = toggle.checked;
      commit(t, (cell: Cell) => labelIdChange(cell, show));
    });
    toggleRow.append(toggle, el('span', undefined, 'Show ID in label (%rdId%)'));
    form.append(toggleRow);
    labelToggle = toggle;
    return form;
  }

  function setControlValue(f: FieldDef, input: HTMLInputElement | HTMLSelectElement, cells: Cell[]): void {
    const value = commonValue(cells, f);
    if (input instanceof HTMLSelectElement) {
      input.querySelector('option[value="__mixed"]')?.remove();
      if (value === null) {
        const mixed = el('option', undefined, MIXED);
        mixed.value = '__mixed';
        mixed.disabled = true;
        input.prepend(mixed);
        input.value = '__mixed';
      } else if (value !== '' && !f.options?.some((o) => o.value === value)) {
        // a value the catalogue does not know (e.g. edited in draw.io): show it as it is
        if (!Array.from(input.options).some((o) => o.value === value)) {
          const unknown = el('option', undefined, `${value} (unknown)`);
          unknown.value = value;
          input.append(unknown);
        }
        input.value = value;
      } else {
        input.value = value;
      }
    } else {
      input.value = value ?? '';
      input.placeholder = value === null ? MIXED : '';
    }
  }

  function update(cells: Cell[]): void {
    const issues = options.getIssues?.() ?? [];
    const ids = new Set(cells.map((c) => String(c.getId())));
    const title = root.querySelector('.rd-rw-title');
    if (title) title.textContent = describeSelection(cells);
    for (const { field: f, input, problem } of controls.values()) {
      if (document.activeElement !== input) setControlValue(f, input, cells);
      const messages = issues.filter((i) => ids.has(i.cellId) && i.field === f.key);
      problem.replaceChildren(
        ...messages.slice(0, 3).map((m) => el('div', `rd-rw-problem-${m.severity}`, m.message))
      );
      input.classList.toggle('rd-rw-invalid', messages.some((m) => m.severity === 'error'));
    }
    if (labelToggle) {
      const states = cells.map((c) => labelShowsId(c));
      labelToggle.checked = states.every(Boolean);
      labelToggle.indeterminate = !labelToggle.checked && states.some(Boolean);
    }
  }

  function refresh(): void {
    if (destroyed) return;
    const now = cellsNow();
    if (!now) {
      signature = '';
      renderEmpty('No diagram is open.');
      return;
    }
    const { graph, cells } = now;
    if (cells.length === 0) {
      if (signature !== 'empty') renderEmpty('Select a shape to edit its railway data.');
      signature = 'empty';
      return;
    }
    const next = cells.map((c) => `${String(c.getId())}:${getRawKind(c) ?? ''}`).join('|');
    if (next !== signature || !kindSelect || !root.contains(kindSelect)) {
      // Rebuild unless the user is typing in this panel (the edit triggered this refresh)
      signature = next;
      renderFields(graph, cells);
    }
    update(cells);
  }

  function focusField(key?: string): void {
    refresh();
    const target =
      (key ? controls.get(key)?.input : undefined) ??
      [...controls.values()].map((c) => c.input).find((i) => !i.disabled) ??
      kindSelect;
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  }

  refresh();
  return {
    refresh,
    focusField,
    destroy() {
      destroyed = true;
      root.remove();
    },
  };
}
