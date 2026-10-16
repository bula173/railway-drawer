/**
 * @file scenarios-panel.ts
 * @brief "Scenarios" view of the right panel (next to Properties) for the ACTIVE tab.
 *
 * Lists the tab's scenarios; each expands to its ordered steps (thumbnail, number, name,
 * description). Scenario actions: new, edit (name/description), duplicate, delete (confirmed),
 * present from step 1. Step actions: add (captures the current drawing), update from the current
 * drawing (confirmed), edit, duplicate, delete (confirmed), reorder (drag, or ↑/↓). Clicking a step
 * shows it read-only on the canvas (ScenarioViewer). Dialogs are the app's template dialogs.
 */
import { promptTemplateDetails, confirmTemplateDialog } from '../ui/templates/template-dialogs';
import type { TemplateDetails, TemplateDetailsOptions } from '../ui/templates/template-dialogs';
import type { PaletteEntry } from '../ui/drawio-palette/contracts';
import { extractShapeNames } from '../ui/drawio-palette/library-adapter';
import type { ScenarioData, ScenarioSet, ScenarioStepData } from './scenario-model';
import type { ScenarioViewState } from './scenario-view';
import './scenarios.css';

export interface ScenarioTabRef {
  id: string;
  name: string;
  scenarios: ScenarioSet;
  /** The tab's current drawing as a draw.io `<mxGraphModel>`. */
  captureDrawing(): string;
}

/** The part of ScenarioViewer the panel uses. */
export interface ScenarioViewControl {
  open(tabId: string, scenarioId: string, index?: number): boolean;
  getState(): ScenarioViewState | null;
}

export interface ScenarioDialogs {
  prompt(opts: TemplateDetailsOptions): Promise<TemplateDetails | null>;
  confirm(message: string, confirmLabel?: string): Promise<boolean>;
}

export interface ScenarioNotifier {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export interface ScenarioThumbnails {
  thumbnail(entry: PaletteEntry, width: number, height: number): Promise<SVGSVGElement>;
}

export interface ScenariosPanelOptions {
  container: HTMLElement;
  getActiveTab(): ScenarioTabRef | null;
  viewer: ScenarioViewControl;
  notify: ScenarioNotifier;
  /** Step thumbnails (the palette's shared renderer); null: no thumbnails. */
  thumbnails?: ScenarioThumbnails | null;
  dialogs?: ScenarioDialogs;
  /** After a step was added or updated (e.g. write the tab cache now and report a full storage). */
  onStepsChanged?(): void;
}

export interface ScenariosPanel {
  /** Re-reads the active tab (call on tab switch/close). */
  refresh(): void;
  /** Highlights the step shown by the scenario view. */
  setViewState(state: ScenarioViewState | null): void;
  destroy(): void;
}

const THUMB_W = 64;
const THUMB_H = 40;

const defaultDialogs: ScenarioDialogs = {
  prompt: promptTemplateDetails,
  confirm: confirmTemplateDialog,
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(className: string, text: string, title: string): HTMLButtonElement {
  const btn = el('button', `rd-scn-icon ${className}`, text);
  btn.type = 'button';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  return btn;
}

/** Short stable hash of a snapshot, so a thumbnail is re-rendered when the step's drawing changes. */
function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function stepThumbnailEntry(step: ScenarioStepData): PaletteEntry {
  return {
    id: `scenario-step-${step.id}-${hashText(step.xml)}`,
    title: step.name,
    kind: 'cells',
    width: THUMB_W,
    height: THUMB_H,
    xml: step.xml,
    shapeNames: extractShapeNames(step.xml),
    cls: 'a',
    source: 'scenario-step',
  } as PaletteEntry;
}

export function createScenariosPanel(options: ScenariosPanelOptions): ScenariosPanel {
  const { container, viewer, notify } = options;
  const dialogs = options.dialogs ?? defaultDialogs;
  const thumbnails = options.thumbnails ?? null;
  /** Expanded scenarios, per tab (`<tab id> <scenario id>`). */
  const expanded = new Set<string>();
  const xkey = (tabId: string, scenarioId: string): string => `${tabId} ${scenarioId}`;
  let subscribedSet: ScenarioSet | null = null;
  let unsubscribe: (() => void) | null = null;
  let viewState: ScenarioViewState | null = viewer.getState();
  let dragging: { scenarioId: string; stepId: string } | null = null;

  const root = el('div', 'rd-scn-panel');
  container.replaceChildren(root);

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              observer?.unobserve(entry.target);
              loadThumb(entry.target as HTMLElement);
            }
          },
          { rootMargin: '100px' }
        )
      : null;
  const thumbSteps = new WeakMap<HTMLElement, ScenarioStepData>();

  function loadThumb(host: HTMLElement): void {
    const step = thumbSteps.get(host);
    if (!step || !thumbnails) return;
    thumbnails
      .thumbnail(stepThumbnailEntry(step), THUMB_W, THUMB_H)
      .then((svg) => {
        host.replaceChildren(svg);
        host.classList.add('rd-scn-thumb-ready');
      })
      .catch(() => host.classList.add('rd-scn-thumb-error'));
  }

  function tab(): ScenarioTabRef | null {
    return options.getActiveTab();
  }

  function follow(set: ScenarioSet | null): void {
    if (set === subscribedSet) return;
    unsubscribe?.();
    subscribedSet = set;
    unsubscribe = set ? set.subscribe(() => render()) : null;
  }

  // ------------------------------------------------------------------ actions

  async function newScenario(): Promise<void> {
    const t = tab();
    if (!t) return;
    const details = await dialogs.prompt({
      heading: 'New scenario',
      hint: `For "${t.name}". Add steps afterwards: each step is a snapshot of the drawing.`,
      name: `Scenario ${t.scenarios.size + 1}`,
      namePlaceholder: 'e.g. Train enters the station',
      confirmLabel: 'Create',
    });
    if (!details) return;
    const scenario = t.scenarios.create(details.name, details.description);
    expanded.add(xkey(t.id, scenario.id));
    render();
  }

  async function editScenario(t: ScenarioTabRef, scenario: ScenarioData): Promise<void> {
    const details = await dialogs.prompt({
      heading: 'Edit scenario',
      name: scenario.name,
      description: scenario.description,
      namePlaceholder: 'e.g. Train enters the station',
      confirmLabel: 'Save',
    });
    if (!details || !t.scenarios.get(scenario.id)) return;
    t.scenarios.update(scenario.id, details);
  }

  async function deleteScenario(t: ScenarioTabRef, scenario: ScenarioData): Promise<void> {
    const steps = scenario.steps.length;
    const ok = await dialogs.confirm(
      `Delete scenario "${scenario.name}"${steps > 0 ? ` and its ${steps} step${steps === 1 ? '' : 's'}` : ''}?`
    );
    if (ok) t.scenarios.remove(scenario.id);
  }

  async function addStep(t: ScenarioTabRef, scenario: ScenarioData): Promise<void> {
    const details = await dialogs.prompt({
      heading: 'Add step',
      hint: `Step ${scenario.steps.length + 1} of "${scenario.name}": a snapshot of the current drawing.`,
      name: `Step ${scenario.steps.length + 1}`,
      namePlaceholder: 'e.g. Route set',
      confirmLabel: 'Add step',
    });
    if (!details || !t.scenarios.get(scenario.id)) return;
    let xml: string;
    try {
      xml = t.captureDrawing();
    } catch (error) {
      notify.error(`Could not capture the drawing: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    t.scenarios.addStep(scenario.id, { name: details.name, description: details.description, xml });
    expanded.add(xkey(t.id, scenario.id));
    render();
    options.onStepsChanged?.();
  }

  async function updateStepDrawing(t: ScenarioTabRef, scenario: ScenarioData, index: number, step: ScenarioStepData): Promise<void> {
    const ok = await dialogs.confirm(
      `Replace the snapshot of step ${index + 1} "${step.name}" with the current drawing?`,
      'Update step'
    );
    if (!ok || !t.scenarios.get(scenario.id)) return;
    t.scenarios.updateStep(scenario.id, step.id, { xml: t.captureDrawing() });
    notify.success(`Step ${index + 1} "${step.name}" updated from the drawing`);
    options.onStepsChanged?.();
  }

  async function editStep(t: ScenarioTabRef, scenario: ScenarioData, index: number, step: ScenarioStepData): Promise<void> {
    const details = await dialogs.prompt({
      heading: `Edit step ${index + 1}`,
      name: step.name,
      description: step.description,
      namePlaceholder: 'e.g. Route set',
      confirmLabel: 'Save',
    });
    if (!details || !t.scenarios.get(scenario.id)) return;
    try {
      t.scenarios.updateStep(scenario.id, step.id, details);
    } catch {
      // the step was deleted meanwhile
    }
  }

  async function deleteStep(t: ScenarioTabRef, scenario: ScenarioData, index: number, step: ScenarioStepData): Promise<void> {
    const ok = await dialogs.confirm(`Delete step ${index + 1} "${step.name}" of "${scenario.name}"?`);
    if (!ok) return;
    try {
      t.scenarios.removeStep(scenario.id, step.id);
    } catch {
      // already gone
    }
  }

  function present(t: ScenarioTabRef, scenario: ScenarioData, index: number): void {
    if (scenario.steps.length === 0) {
      notify.warning(`"${scenario.name}" has no steps yet: use "+ Add step" to capture the drawing.`);
      return;
    }
    viewer.open(t.id, scenario.id, index);
  }

  const run = (action: () => Promise<void> | void): void => {
    Promise.resolve()
      .then(action)
      .catch((error: unknown) => {
        console.error('[Scenarios] Action failed:', error);
        notify.error(`Scenario action failed: ${error instanceof Error ? error.message : String(error)}`);
      });
  };

  // ------------------------------------------------------------------ rendering

  function renderStep(t: ScenarioTabRef, scenario: ScenarioData, step: ScenarioStepData, index: number): HTMLElement {
    const item = el('li', 'rd-scn-step');
    item.dataset.stepId = step.id;
    item.draggable = true;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Show step ${index + 1}: ${step.name}`);
    item.title = 'Show this step on the canvas (read-only). Drag to reorder.';

    const thumb = el('div', 'rd-scn-thumb');
    thumb.setAttribute('aria-hidden', 'true');
    if (thumbnails) {
      thumbSteps.set(thumb, step);
      if (observer) observer.observe(thumb);
      else loadThumb(thumb);
    } else {
      thumb.hidden = true;
    }

    const text = el('div', 'rd-scn-step-text');
    const title = el('div', 'rd-scn-step-title');
    title.append(el('span', 'rd-scn-step-num', `${index + 1}.`), el('span', 'rd-scn-step-name', step.name));
    text.appendChild(title);
    if (step.description) text.appendChild(el('div', 'rd-scn-step-desc', step.description));

    const actions = el('div', 'rd-scn-step-actions');
    const up = iconButton('rd-scn-step-up', '↑', 'Move step up');
    up.disabled = index === 0;
    const down = iconButton('rd-scn-step-down', '↓', 'Move step down');
    down.disabled = index === scenario.steps.length - 1;
    const update = iconButton('rd-scn-step-update', '⟳', 'Update step from the current drawing');
    const edit = iconButton('rd-scn-step-edit', '✎', 'Rename / edit description');
    const dup = iconButton('rd-scn-step-duplicate', '⧉', 'Duplicate step');
    const del = iconButton('rd-scn-step-delete rd-scn-danger', '×', 'Delete step');
    actions.append(up, down, update, edit, dup, del);
    item.append(thumb, text, actions);

    up.addEventListener('click', (e) => {
      e.stopPropagation();
      t.scenarios.moveStep(scenario.id, step.id, index - 1);
    });
    down.addEventListener('click', (e) => {
      e.stopPropagation();
      t.scenarios.moveStep(scenario.id, step.id, index + 1);
    });
    update.addEventListener('click', (e) => {
      e.stopPropagation();
      run(() => updateStepDrawing(t, scenario, index, step));
    });
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      run(() => editStep(t, scenario, index, step));
    });
    dup.addEventListener('click', (e) => {
      e.stopPropagation();
      t.scenarios.duplicateStep(scenario.id, step.id);
    });
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      run(() => deleteStep(t, scenario, index, step));
    });
    item.addEventListener('click', () => present(t, scenario, index));
    item.addEventListener('keydown', (e) => {
      if (e.target !== item || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      present(t, scenario, index);
    });

    // drag to reorder, within the scenario
    item.addEventListener('dragstart', (e) => {
      dragging = { scenarioId: scenario.id, stepId: step.id };
      item.classList.add('rd-scn-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-rd-scenario-step', step.id);
      }
    });
    item.addEventListener('dragend', () => {
      dragging = null;
      item.classList.remove('rd-scn-dragging');
      root.querySelectorAll('.rd-scn-drop-before, .rd-scn-drop-after').forEach((n) =>
        n.classList.remove('rd-scn-drop-before', 'rd-scn-drop-after')
      );
    });
    const dropAfter = (e: DragEvent): boolean => {
      const rect = item.getBoundingClientRect();
      return e.clientY > rect.top + rect.height / 2;
    };
    item.addEventListener('dragover', (e) => {
      if (!dragging || dragging.scenarioId !== scenario.id || dragging.stepId === step.id) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const after = dropAfter(e);
      item.classList.toggle('rd-scn-drop-after', after);
      item.classList.toggle('rd-scn-drop-before', !after);
    });
    item.addEventListener('dragleave', () => item.classList.remove('rd-scn-drop-before', 'rd-scn-drop-after'));
    item.addEventListener('drop', (e) => {
      if (!dragging || dragging.scenarioId !== scenario.id) return;
      e.preventDefault();
      e.stopPropagation();
      const moved = dragging;
      dragging = null;
      const from = scenario.steps.findIndex((s) => s.id === moved.stepId);
      if (from < 0 || moved.stepId === step.id) return;
      let to = index + (dropAfter(e) ? 1 : 0);
      if (from < to) to -= 1;
      t.scenarios.moveStep(scenario.id, moved.stepId, to);
    });
    return item;
  }

  function renderScenario(t: ScenarioTabRef, scenario: ScenarioData): HTMLElement {
    const item = el('li', 'rd-scn-item');
    item.dataset.scenarioId = scenario.id;
    const isOpen = expanded.has(xkey(t.id, scenario.id));

    const head = el('div', 'rd-scn-head');
    const toggle = el('button', 'rd-scn-toggle', '▶');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', `${isOpen ? 'Collapse' : 'Expand'} ${scenario.name}`);
    const label = el('div', 'rd-scn-label');
    const name = el('span', 'rd-scn-name', scenario.name);
    const n = scenario.steps.length;
    const count = el('span', 'rd-scn-count', `${n} step${n === 1 ? '' : 's'}`);
    label.append(name, count);
    if (scenario.description) label.appendChild(el('div', 'rd-scn-desc', scenario.description));
    const actions = el('div', 'rd-scn-actions');
    const play = iconButton('rd-scn-play', '▷', 'Present from step 1');
    play.disabled = n === 0;
    const edit = iconButton('rd-scn-edit', '✎', 'Rename / edit description');
    const dup = iconButton('rd-scn-duplicate', '⧉', 'Duplicate scenario');
    const del = iconButton('rd-scn-delete rd-scn-danger', '×', 'Delete scenario');
    actions.append(play, edit, dup, del);
    head.append(toggle, label, actions);
    item.appendChild(head);

    const flip = (): void => {
      if (expanded.has(xkey(t.id, scenario.id))) expanded.delete(xkey(t.id, scenario.id));
      else expanded.add(xkey(t.id, scenario.id));
      render();
    };
    toggle.addEventListener('click', flip);
    label.addEventListener('click', flip);
    play.addEventListener('click', () => present(t, scenario, 0));
    edit.addEventListener('click', () => run(() => editScenario(t, scenario)));
    dup.addEventListener('click', () => {
      const copy = t.scenarios.duplicate(scenario.id);
      expanded.add(xkey(t.id, copy.id));
      render();
    });
    del.addEventListener('click', () => run(() => deleteScenario(t, scenario)));

    if (isOpen) {
      const body = el('div', 'rd-scn-body');
      if (n === 0) {
        body.appendChild(el('p', 'rd-scn-steps-empty', 'No steps yet. "+ Add step" captures the current drawing as step 1.'));
      } else {
        const list = el('ol', 'rd-scn-steps');
        scenario.steps.forEach((step, index) => list.appendChild(renderStep(t, scenario, step, index)));
        body.appendChild(list);
      }
      const add = el('button', 'rd-tpl-btn rd-tpl-btn-small rd-scn-add-step', '+ Add step');
      add.type = 'button';
      add.title = 'Add the current drawing as the next step';
      add.addEventListener('click', () => run(() => addStep(t, scenario)));
      body.appendChild(add);
      item.appendChild(body);
    }
    return item;
  }

  function render(): void {
    const t = tab();
    follow(t?.scenarios ?? null);
    const scrollTop = container.scrollTop;
    root.replaceChildren();

    const toolbar = el('div', 'rd-scn-toolbar');
    const tabName = el('span', 'rd-scn-tabname', t ? t.name : '');
    tabName.title = t ? `Scenarios of "${t.name}" (saved in its file)` : '';
    const add = el('button', 'rd-tpl-btn rd-tpl-btn-small rd-tpl-btn-primary rd-scn-new', '+ New scenario');
    add.type = 'button';
    add.disabled = !t;
    add.addEventListener('click', () => run(newScenario));
    toolbar.append(tabName, add);
    root.appendChild(toolbar);

    if (!t) return;
    const scenarios = t.scenarios.list();
    if (scenarios.length === 0) {
      root.appendChild(
        el(
          'p',
          'rd-scn-empty',
          'No scenarios in this diagram. A scenario is a sequence of steps, each a snapshot of the drawing, ' +
            'that you can step through on the canvas. They are saved in the .drawio file as extra pages.'
        )
      );
    } else {
      const list = el('ul', 'rd-scn-list');
      for (const scenario of scenarios) list.appendChild(renderScenario(t, scenario));
      root.appendChild(list);
    }
    highlight();
    container.scrollTop = scrollTop;
  }

  function highlight(): void {
    const t = tab();
    root.querySelectorAll<HTMLElement>('.rd-scn-step').forEach((stepEl) => {
      const scenarioEl = stepEl.closest<HTMLElement>('.rd-scn-item');
      const active =
        !!viewState &&
        !!t &&
        viewState.tabId === t.id &&
        scenarioEl?.dataset.scenarioId === viewState.scenarioId &&
        stepEl.parentElement?.children[viewState.index] === stepEl;
      stepEl.classList.toggle('rd-scn-step-active', active);
      if (active) stepEl.setAttribute('aria-current', 'step');
      else stepEl.removeAttribute('aria-current');
    });
  }

  render();

  return {
    refresh: render,
    setViewState(state) {
      viewState = state;
      if (state && !expanded.has(xkey(state.tabId, state.scenarioId))) {
        expanded.add(xkey(state.tabId, state.scenarioId));
        render();
      } else {
        highlight();
      }
    },
    destroy() {
      unsubscribe?.();
      unsubscribe = null;
      observer?.disconnect();
      root.remove();
    },
  };
}

/**
 * The "Properties | Scenarios" switch at the top of the right panel. Properties is the default;
 * returns a function that selects a view.
 */
export function installRightPanelSwitch(onShow?: (view: 'properties' | 'scenarios') => void): (view: 'properties' | 'scenarios') => void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.right-panel-switch-btn[data-right-panel]'));
  const properties = document.getElementById('property-content');
  const scenarios = document.getElementById('scenarios-panel');
  const select = (view: 'properties' | 'scenarios'): void => {
    for (const btn of buttons) {
      const active = btn.dataset.rightPanel === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    }
    if (properties) properties.hidden = view !== 'properties';
    if (scenarios) scenarios.hidden = view !== 'scenarios';
    onShow?.(view);
  };
  for (const btn of buttons) {
    btn.addEventListener('click', () => select(btn.dataset.rightPanel === 'scenarios' ? 'scenarios' : 'properties'));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      const next = btn.dataset.rightPanel === 'scenarios' ? 'properties' : 'scenarios';
      select(next);
      buttons.find((b) => b.dataset.rightPanel === next)?.focus();
    });
  }
  select('properties');
  return select;
}
