/**
 * @file scenario-view.ts
 * @brief Read-only presentation of scenario steps on the canvas.
 *
 * The step is shown in a separate, disabled Graph (configured like a tab graph, see
 * diagram-graph-setup.ts) inside `#graph-container`, in place of the active tab's graph div, which
 * is only hidden: its model, selection, view and undo history are never touched, so "Back to
 * editing" shows the live drawing exactly as it was. A banner names the scenario and the step and
 * has Prev/Next, "Replace drawing with this step…" and "Back to editing". While the view is open
 * `body.rd-scenario-viewing` disables the menus, toolbar, left panel and properties (they act on
 * the hidden live drawing); the keyboard is routed by legacy-main.ts through scenario-keys.ts.
 */
import { Graph, GraphDataModel } from '@maxgraph/core';
import { importModelXml, sanitizeXmlText } from '../services/drawio-xml';
import { configureDiagramRendering } from '../ui/diagram-graph-setup';
import { installStencilAutoload } from '../ui/drawio-stencil-autoload';
import type { ScenarioData, ScenarioSet, ScenarioStepData } from './scenario-model';
import './scenarios.css';

export interface ScenarioViewState {
  tabId: string;
  scenarioId: string;
  /** 0-based index of the shown step. */
  index: number;
}

export interface ScenarioViewerOptions {
  /** `#graph-container`: the view is mounted in it, next to the tab graph divs. */
  graphContainer: HTMLElement;
  getActiveTabId(): string | null;
  /** The scenarios of a tab (null: tab gone). */
  getScenarios(tabId: string): ScenarioSet | null;
  /** The live graph of a tab, for copying its zoom and scroll position. */
  getLiveGraph(tabId: string): Graph | null;
  /** Called after every open/step change/close (null = closed). */
  onStateChange?(state: ScenarioViewState | null): void;
  /** Banner action "Replace drawing with this step…" (the caller confirms and replaces). */
  onReplaceDrawing?(state: ScenarioViewState, step: ScenarioStepData): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function liveGraphDiv(tabId: string): HTMLElement | null {
  return document.getElementById(`graph-${tabId}`);
}

export class ScenarioViewer {
  private state: ScenarioViewState | null = null;
  private wrapper: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private graph: Graph | null = null;
  private titleEl: HTMLElement | null = null;
  private descEl: HTMLElement | null = null;
  private errorEl: HTMLElement | null = null;
  private prevBtn: HTMLButtonElement | null = null;
  private nextBtn: HTMLButtonElement | null = null;
  /** Unsubscribes from the viewed tab's ScenarioSet. */
  private unsubscribe: (() => void) | null = null;
  /** Xml currently rendered (re-render only when the step's snapshot changed). */
  private renderedXml: string | null = null;

  constructor(private readonly options: ScenarioViewerOptions) {}

  isActive(): boolean {
    return this.state !== null;
  }

  getState(): ScenarioViewState | null {
    return this.state ? { ...this.state } : null;
  }

  /** The graph showing the step (tests); null before the first open. */
  getViewGraph(): Graph | null {
    return this.graph;
  }

  /** Shows step `index` of a scenario of the active tab. Returns false when there is nothing to show. */
  open(tabId: string, scenarioId: string, index = 0): boolean {
    const set = this.options.getScenarios(tabId);
    const scenario = set?.get(scenarioId);
    if (!set || !scenario || scenario.steps.length === 0) return false;
    if (this.state && this.state.tabId !== tabId) this.close();
    const wasOpen = this.state !== null;
    this.state = { tabId, scenarioId, index: Math.max(0, Math.min(scenario.steps.length - 1, index)) };
    if (!wasOpen) {
      this.mount(tabId);
      this.unsubscribe = set.subscribe(() => this.refresh());
    }
    this.render();
    return true;
  }

  /** Moves by `delta` steps (clamped). */
  go(delta: number): void {
    if (!this.state) return;
    this.show(this.state.index + delta);
  }

  show(index: number): void {
    const scenario = this.currentScenario();
    if (!this.state || !scenario) return;
    const next = Math.max(0, Math.min(scenario.steps.length - 1, index));
    if (next === this.state.index) return;
    this.state.index = next;
    this.render();
  }

  first(): void {
    this.show(0);
  }

  last(): void {
    const scenario = this.currentScenario();
    if (scenario) this.show(scenario.steps.length - 1);
  }

  /** Back to editing: removes the view and shows the (untouched) live drawing again. */
  close(): void {
    if (!this.state) return;
    const { tabId } = this.state;
    this.state = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.renderedXml = null;
    if (this.wrapper) this.wrapper.hidden = true;
    this.graph?.getDataModel().clear();
    // Only the active tab's div is shown: after a tab switch the switch has shown the new one
    const liveDiv = liveGraphDiv(tabId);
    if (liveDiv && this.options.getActiveTabId() === tabId) liveDiv.style.display = 'block';
    document.body.classList.remove('rd-scenario-viewing');
    this.options.onStateChange?.(null);
  }

  /** Follows changes of the scenarios (step removed, reordered, snapshot updated, scenario deleted). */
  refresh(): void {
    if (!this.state) return;
    const scenario = this.currentScenario();
    if (!scenario || scenario.steps.length === 0) {
      this.close();
      return;
    }
    this.state.index = Math.min(this.state.index, scenario.steps.length - 1);
    this.render();
  }

  destroy(): void {
    this.close();
    this.graph?.destroy();
    this.graph = null;
    this.wrapper?.remove();
    this.wrapper = null;
  }

  private currentScenario(): ScenarioData | null {
    if (!this.state) return null;
    return this.options.getScenarios(this.state.tabId)?.get(this.state.scenarioId) ?? null;
  }

  private ensureDom(): void {
    if (this.wrapper) return;
    const wrapper = el('div', 'rd-scn-view');
    wrapper.dataset.testid = 'scenario-view';
    wrapper.hidden = true;
    const banner = el('div', 'rd-scn-banner');
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Scenario view');
    const badge = el('span', 'rd-scn-badge', 'Scenario view');
    const prev = el('button', 'rd-scn-banner-btn rd-scn-prev', '← Prev');
    prev.type = 'button';
    prev.title = 'Previous step (←)';
    const next = el('button', 'rd-scn-banner-btn rd-scn-next', 'Next →');
    next.type = 'button';
    next.title = 'Next step (→)';
    const text = el('div', 'rd-scn-banner-text');
    const title = el('div', 'rd-scn-banner-title');
    title.setAttribute('aria-live', 'polite');
    const desc = el('div', 'rd-scn-banner-desc');
    const error = el('div', 'rd-scn-banner-error');
    error.hidden = true;
    text.append(title, desc, error);
    const replace = el('button', 'rd-scn-banner-btn rd-scn-replace', 'Replace drawing with this step…');
    replace.type = 'button';
    replace.title = 'Replace the live drawing with this snapshot (undoable with Ctrl+Z)';
    const exit = el('button', 'rd-scn-banner-btn rd-scn-banner-primary rd-scn-exit', 'Back to editing');
    exit.type = 'button';
    exit.title = 'Back to the live drawing (Esc)';
    banner.append(badge, prev, text, next, replace, exit);
    const host = el('div', 'rd-scn-view-host');
    wrapper.append(banner, host);
    this.options.graphContainer.appendChild(wrapper);

    prev.addEventListener('click', () => this.go(-1));
    next.addEventListener('click', () => this.go(1));
    exit.addEventListener('click', () => this.close());
    replace.addEventListener('click', () => {
      const scenario = this.currentScenario();
      if (!this.state || !scenario) return;
      const step = scenario.steps[this.state.index];
      if (step) this.options.onReplaceDrawing?.({ ...this.state }, step);
    });

    this.wrapper = wrapper;
    this.host = host;
    this.titleEl = title;
    this.descEl = desc;
    this.errorEl = error;
    this.prevBtn = prev;
    this.nextBtn = next;
  }

  private ensureGraph(): Graph {
    if (this.graph) return this.graph;
    const graph = new Graph(this.host!);
    graph.setEnabled(false);
    graph.setTooltips(false);
    graph.gridEnabled = false;
    configureDiagramRendering(graph);
    installStencilAutoload(graph);
    this.graph = graph;
    return graph;
  }

  private mount(tabId: string): void {
    this.ensureDom();
    const graph = this.ensureGraph();
    const live = this.options.getLiveGraph(tabId);
    const liveDiv = liveGraphDiv(tabId);
    // Same zoom and scroll as the live drawing, so steps line up with it
    if (live) {
      const { scale, translate } = live.view;
      graph.view.scaleAndTranslate(scale, translate.x, translate.y);
    }
    const scrollLeft = liveDiv?.scrollLeft ?? 0;
    const scrollTop = liveDiv?.scrollTop ?? 0;
    if (liveDiv) liveDiv.style.display = 'none';
    this.wrapper!.hidden = false;
    document.body.classList.add('rd-scenario-viewing');
    const restoreScroll = (): void => {
      if (!this.host) return;
      this.host.scrollLeft = scrollLeft;
      this.host.scrollTop = scrollTop;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restoreScroll);
    else setTimeout(restoreScroll, 0);
  }

  private render(): void {
    const scenario = this.currentScenario();
    if (!this.state || !scenario) return;
    const step = scenario.steps[this.state.index];
    const total = scenario.steps.length;
    this.titleEl!.textContent = `${scenario.name} — step ${this.state.index + 1}/${total}: ${step.name}`;
    this.descEl!.textContent = step.description;
    this.descEl!.hidden = !step.description;
    this.prevBtn!.disabled = this.state.index === 0;
    this.nextBtn!.disabled = this.state.index >= total - 1;
    if (step.xml !== this.renderedXml) {
      this.renderedXml = step.xml;
      this.loadSnapshot(step.xml);
    }
    this.options.onStateChange?.({ ...this.state });
  }

  private loadSnapshot(xml: string): void {
    const graph = this.ensureGraph();
    this.errorEl!.hidden = true;
    try {
      const scratch = new GraphDataModel();
      const emptyRoot = scratch.getRoot();
      importModelXml(sanitizeXmlText(xml), scratch);
      const root = scratch.getRoot();
      if (!root || root === emptyRoot) throw new Error('The step contains no cells');
      graph.getDataModel().setRoot(root);
    } catch (error) {
      console.error('[Scenarios] Could not show the step:', error);
      graph.getDataModel().clear();
      this.errorEl!.textContent = `This step cannot be shown: ${error instanceof Error ? error.message : String(error)}`;
      this.errorEl!.hidden = false;
    }
    graph.refresh();
  }
}
