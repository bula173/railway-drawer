/**
 * @file scenarios-panel.ts
 * @brief "Scenarios" view of the right panel (next to Properties) for the ACTIVE tab.
 *
 * Lists the tab's scenarios; each expands to its ordered steps (thumbnail, number, name,
 * description, UML/Text badges). Scenario actions: new, edit (name/description), duplicate, export
 * as HTML, delete (confirmed), present from step 1. Step actions: add / edit in the step editor
 * (step-editor.ts: name, description, drawing capture/keep, PlantUML, Markdown), update from the
 * current drawing (confirmed), duplicate, delete (confirmed), reorder (drag, or ↑/↓). Clicking a
 * step shows it read-only on the canvas (ScenarioViewer). Other dialogs are the template dialogs.
 */
import { emit } from '../core/event-bus';
import { promptTemplateDetails, confirmTemplateDialog } from '../ui/templates/template-dialogs';
import type { TemplateDetails, TemplateDetailsOptions } from '../ui/templates/template-dialogs';
import type { PaletteEntry } from '../ui/drawio-palette/contracts';
import { extractShapeNames } from '../ui/drawio-palette/library-adapter';
import type { ScenarioData, ScenarioSet, ScenarioStepData } from './scenario-model';
import type { ScenarioViewState } from './scenario-view';
import { openStepEditor } from './step-editor';
import type { StepEditorOptions, StepEditorResult } from './step-editor';
import './scenarios.css';
import { onDrawioColorModeChange } from '../drawio-shapes/engine/graph-compat';

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
  /** Step editor (name, description, drawing, PlantUML, Markdown); default: openStepEditor. */
  stepEditor?: (opts: StepEditorOptions) => Promise<StepEditorResult | null>;
  /** "Export as HTML" of a scenario (button hidden when missing). */
  onExportScenario?(tabId: string, scenarioId: string): void;
  /** "Export as PDF" / "Export as slides" of a scenario (buttons hidden when missing). */
  onExportScenarioDoc?(tabId: string, scenarioId: string, format: 'pdf' | 'slides'): void;
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

interface MenuAction {
  className: string;
  label: string;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
}

/** The menu currently open (one at a time). */
let openActionMenu: { menu: HTMLElement; button: HTMLButtonElement } | null = null;

function closeActionMenu(focusButton = false): void {
  const open = openActionMenu;
  if (!open) return;
  openActionMenu = null;
  open.menu.hidden = true;
  open.button.setAttribute('aria-expanded', 'false');
  if (focusButton) open.button.focus();
}

function onDocumentPointerDown(e: Event): void {
  const open = openActionMenu;
  if (open && !open.menu.contains(e.target as Node) && !open.button.contains(e.target as Node)) closeActionMenu();
}

/**
 * A "⋯" button with a text menu of actions (role=menu). The items keep their own classes
 * (e.g. `rd-scn-edit`), so they stay addressable; the menu is position: fixed under the button,
 * so the panel's scrolling does not clip it. Esc closes it, ↑/↓ move between items.
 */
function actionMenu(label: string, actions: MenuAction[], extraClass = ''): HTMLElement {
  const wrap = el('div', 'rd-scn-menu-wrap');
  const button = el('button', `rd-scn-more ${extraClass}`.trim(), '⋯');
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const menu = el('div', 'rd-scn-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  const items: HTMLButtonElement[] = [];
  for (const action of actions) {
    const item = el('button', `rd-scn-menu-item ${action.className}${action.danger ? ' rd-scn-danger' : ''}`, action.label);
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    if (action.title) item.title = action.title;
    item.disabled = !!action.disabled;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActionMenu();
      action.run();
    });
    items.push(item);
    menu.appendChild(item);
  }
  const enabled = (): HTMLButtonElement[] => items.filter((i) => !i.disabled);
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (openActionMenu?.menu === menu) {
      closeActionMenu();
      return;
    }
    closeActionMenu();
    const r = button.getBoundingClientRect();
    menu.hidden = false;
    const w = menu.offsetWidth || 160;
    menu.style.left = `${Math.max(4, Math.min(r.right - w, window.innerWidth - w - 4))}px`;
    const h = menu.offsetHeight || 0;
    menu.style.top = `${r.bottom + 2 + h > window.innerHeight ? Math.max(4, r.top - h - 2) : r.bottom + 2}px`;
    button.setAttribute('aria-expanded', 'true');
    openActionMenu = { menu, button };
    enabled()[0]?.focus();
  });
  menu.addEventListener('keydown', (e) => {
    const list = enabled();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeActionMenu(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length];
      next?.focus();
    } else if (e.key === 'Tab') {
      closeActionMenu();
    }
  });
  // clicks inside the menu must not reach the row (present / expand)
  menu.addEventListener('click', (e) => e.stopPropagation());
  wrap.append(button, menu);
  return wrap;
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
  const stepEditor = options.stepEditor ?? openStepEditor;
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
  document.addEventListener('mousedown', onDocumentPointerDown, true);
  const onPanelScroll = (): void => {
    if (openActionMenu && root.contains(openActionMenu.menu)) closeActionMenu();
  };
  container.addEventListener('scroll', onPanelScroll);

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
  // Step thumbnails follow the app theme like the canvas: rebuild them when the colour mode changes
  const stopColorModeWatch = onDrawioColorModeChange(() => render());

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
    const details = await stepEditor({
      heading: 'Add step',
      hint: `Step ${scenario.steps.length + 1} of "${scenario.name}": the current drawing, plus an optional UML diagram and text.`,
      name: `Step ${scenario.steps.length + 1}`,
      mode: 'add',
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
    t.scenarios.addStep(scenario.id, { name: details.name, description: details.description, xml, uml: details.uml, text: details.text });
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
    const details = await stepEditor({
      heading: `Edit step ${index + 1}`,
      name: step.name,
      description: step.description,
      uml: step.uml,
      text: step.text,
      mode: 'edit',
      confirmLabel: 'Save',
    });
    if (!details || !t.scenarios.get(scenario.id)) return;
    let xml: string | undefined;
    if (details.captureDrawing) {
      try {
        xml = t.captureDrawing();
      } catch (error) {
        notify.error(`Could not capture the drawing: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }
    try {
      t.scenarios.updateStep(scenario.id, step.id, {
        name: details.name,
        description: details.description,
        uml: details.uml,
        text: details.text,
        ...(xml !== undefined ? { xml } : {}),
      });
    } catch {
      // the step was deleted meanwhile
      return;
    }
    options.onStepsChanged?.();
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
    const stepName = el('span', 'rd-scn-step-name', step.name);
    stepName.title = step.name;
    title.append(el('span', 'rd-scn-step-num', `${index + 1}.`), stepName);
    text.appendChild(title);
    if (step.description) text.appendChild(el('div', 'rd-scn-step-desc', step.description));
    if (step.uml || step.text) {
      const badges = el('div', 'rd-scn-step-badges');
      if (step.uml) badges.appendChild(el('span', 'rd-scn-badge-small rd-scn-badge-uml', 'UML'));
      if (step.text) badges.appendChild(el('span', 'rd-scn-badge-small rd-scn-badge-text', 'Text'));
      text.appendChild(badges);
    }

    const actions = el('div', 'rd-scn-step-actions');
    actions.appendChild(
      actionMenu(`Step ${index + 1} actions`, [
        { className: 'rd-scn-step-edit', label: 'Edit…', title: 'Edit step: name, drawing, UML, text', run: () => run(() => editStep(t, scenario, index, step)) },
        { className: 'rd-scn-step-update', label: 'Update from drawing', title: 'Replace the snapshot with the current drawing', run: () => run(() => updateStepDrawing(t, scenario, index, step)) },
        { className: 'rd-scn-step-duplicate', label: 'Duplicate', run: () => t.scenarios.duplicateStep(scenario.id, step.id) },
        { className: 'rd-scn-step-up', label: 'Move up', disabled: index === 0, run: () => t.scenarios.moveStep(scenario.id, step.id, index - 1) },
        { className: 'rd-scn-step-down', label: 'Move down', disabled: index === scenario.steps.length - 1, run: () => t.scenarios.moveStep(scenario.id, step.id, index + 1) },
        { className: 'rd-scn-step-delete', label: 'Delete…', danger: true, run: () => run(() => deleteStep(t, scenario, index, step)) },
      ]),
    );
    actions.addEventListener('click', (e) => e.stopPropagation());
    actions.addEventListener('keydown', (e) => e.stopPropagation());
    item.append(thumb, text, actions);

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
    name.title = scenario.name;
    const n = scenario.steps.length;
    const count = el('span', 'rd-scn-count', `${n} step${n === 1 ? '' : 's'}`);
    label.append(name, count);
    if (scenario.description) label.appendChild(el('div', 'rd-scn-desc', scenario.description));
    const actions = el('div', 'rd-scn-actions');
    const play = el('button', 'rd-scn-play', '▶ Present');
    play.type = 'button';
    play.title = n === 0 ? 'Add a step first' : 'Present from step 1';
    play.disabled = n === 0;
    const menuActions: MenuAction[] = [
      { className: 'rd-scn-edit', label: 'Edit…', title: 'Rename / edit description', run: () => run(() => editScenario(t, scenario)) },
      {
        className: 'rd-scn-duplicate',
        label: 'Duplicate',
        run: () => {
          const copy = t.scenarios.duplicate(scenario.id);
          expanded.add(xkey(t.id, copy.id));
          render();
        },
      },
    ];
    if (options.onExportScenario) {
      menuActions.push({ className: 'rd-scn-export', label: 'Export HTML', title: 'Export scenario as HTML (drawings, UML, text)', disabled: n === 0, run: () => options.onExportScenario?.(t.id, scenario.id) });
    }
    if (options.onExportScenarioDoc) {
      menuActions.push(
        { className: 'rd-scn-export-pdf', label: 'Export PDF', title: 'Title page, one or more pages per step', disabled: n === 0, run: () => options.onExportScenarioDoc?.(t.id, scenario.id, 'pdf') },
        { className: 'rd-scn-export-slides', label: 'Export Slides', title: 'HTML slideshow, one step per slide', disabled: n === 0, run: () => options.onExportScenarioDoc?.(t.id, scenario.id, 'slides') },
      );
    }
    menuActions.push({ className: 'rd-scn-delete', label: 'Delete…', danger: true, run: () => run(() => deleteScenario(t, scenario)) });
    actions.append(play, actionMenu(`${scenario.name}: more actions`, menuActions));
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
      add.title = 'Add the current drawing (plus optional UML and text) as the next step';
      add.addEventListener('click', () => run(() => addStep(t, scenario)));
      body.appendChild(add);
      item.appendChild(body);
    }
    return item;
  }

  function render(): void {
    if (openActionMenu && root.contains(openActionMenu.menu)) closeActionMenu();
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
      closeActionMenu();
      document.removeEventListener('mousedown', onDocumentPointerDown, true);
      container.removeEventListener('scroll', onPanelScroll);
      stopColorModeWatch();
      unsubscribe?.();
      unsubscribe = null;
      observer?.disconnect();
      root.remove();
    },
  };
}

/** Views of the right panel (one switch button each, `data-right-panel`). */
export type RightPanelView = 'properties' | 'data' | 'checks' | 'scenarios' | 'ai';

/** Bus event (core/event-bus.ts) whenever the right panel shows a view (`{ view }`). */
export const RIGHT_PANEL_EVENT = 'right-panel-view' as const;

/**
 * The "Properties | Data | Checks | Scenarios" switch at the top of the right panel. Each button's
 * `aria-controls` names the panel it shows; Properties is the default. Returns a function that
 * selects a view; every change is also announced as a `right-panel-view` window event.
 */
export function installRightPanelSwitch(onShow?: (view: RightPanelView) => void): (view: RightPanelView) => void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.right-panel-switch-btn[data-right-panel]'));
  const viewOf = (btn: HTMLButtonElement): RightPanelView => (btn.dataset.rightPanel ?? 'properties') as RightPanelView;
  const panelOf = (btn: HTMLButtonElement): HTMLElement | null => {
    const id = btn.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  };
  const select = (view: RightPanelView): void => {
    if (!buttons.some((b) => viewOf(b) === view)) view = 'properties';
    for (const btn of buttons) {
      const active = viewOf(btn) === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
      const panel = panelOf(btn);
      if (panel) panel.hidden = !active;
    }
    onShow?.(view);
    emit(RIGHT_PANEL_EVENT, { view });
  };
  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => select(viewOf(btn)));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      select(viewOf(next));
      next.focus();
    });
  });
  select('properties');
  return select;
}
