/**
 * @file scenario-view.ts
 * @brief Read-only presentation of scenario steps on the canvas.
 *
 * The step is shown in a separate, disabled Graph (configured like a tab graph, see
 * setup-graph.ts, profile 'view') inside `#graph-container`, in place of the active tab's graph div, which
 * is only hidden: its model, selection, view and undo history are never touched, so "Back to
 * editing" shows the live drawing exactly as it was. A banner names the scenario and the step and
 * has Prev/Next, "Replace drawing with this step…" and "Back to editing". A collapsible side panel
 * on the right shows the step's UML diagram (top) and Markdown text (bottom); Prev/Next switch all
 * three together; the collapsed state is kept in localStorage `rd.scenario.sidePanel`. While the view is open
 * `body.rd-scenario-viewing` disables the menus, toolbar, left panel and properties (they act on
 * the hidden live drawing); the keyboard is routed by main-editor.ts through scenario-keys.ts.
 */
import { Graph, GraphDataModel, Rectangle } from '@maxgraph/core';
import { importModelXml, sanitizeXmlText } from '../services/drawio-xml';
import { setupGraph } from '../ui/setup-graph';

import type { ScenarioData, ScenarioSet, ScenarioStepData } from './scenario-model';
import { renderStepUml, showUmlResult } from './step-uml';
import type { UmlRenderResult } from './step-uml';
import { showMarkdown } from './markdown';
import { ScenarioAutoplay, AUTOPLAY_INTERVALS } from './scenario-autoplay';
import { buildDiffHighlightXml, diffSnapshots, diffCountsText, DIFF_COLORS, DIFF_LABELS } from './scenario-diff';
import type { CellChangeKind, SnapshotDiff } from './scenario-diff';
import './scenarios.css';
import './scenario-doc.css';

/** localStorage key of the side panel state ('collapsed' | 'open'). */
export const SIDE_PANEL_KEY = 'rd.scenario.sidePanel';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDE_PANEL_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** localStorage key of the "Show changes" toggle ('1' | '0'). */
export const SHOW_CHANGES_KEY = 'rd.scenario.showChanges';

function readShowChanges(): boolean {
  try {
    return localStorage.getItem(SHOW_CHANGES_KEY) === '1';
  } catch {
    return false;
  }
}

function writeShowChanges(on: boolean): void {
  try {
    localStorage.setItem(SHOW_CHANGES_KEY, on ? '1' : '0');
  } catch {
    // storage blocked
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDE_PANEL_KEY, collapsed ? 'collapsed' : 'open');
  } catch {
    // storage blocked: remembered for this page only
  }
}

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
  /** UML renderer of the side panel (default: renderStepUml). */
  renderUml?(source: string): Promise<UmlRenderResult>;
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
  /** Side panel: UML (top) and Markdown text (bottom) of the shown step. */
  private side: HTMLElement | null = null;
  private sideToggle: HTMLButtonElement | null = null;
  private umlEl: HTMLElement | null = null;
  private textEl: HTMLElement | null = null;
  private renderedUml: string | null = null;
  private renderedText: string | null = null;
  private umlSeq = 0;
  private collapsed = readCollapsed();
  /** "Show changes": highlights the differences to the previous step (a copy of the snapshot is shown). */
  private showChanges = readShowChanges();
  private diffToggle: HTMLInputElement | null = null;
  private legendEl: HTMLElement | null = null;
  private changesSection: HTMLElement | null = null;
  private changesEl: HTMLElement | null = null;
  private lastDiff: SnapshotDiff | null = null;
  private playBtn: HTMLButtonElement | null = null;
  private intervalSelect: HTMLSelectElement | null = null;
  private loopBox: HTMLInputElement | null = null;
  private readonly autoplay: ScenarioAutoplay;

  constructor(private readonly options: ScenarioViewerOptions) {
    this.autoplay = new ScenarioAutoplay({
      position: () => {
        const scenario = this.currentScenario();
        return this.state && scenario ? { index: this.state.index, total: scenario.steps.length } : null;
      },
      show: (index) => this.show(index),
      onChange: (playing) => this.applyPlayState(playing),
    });
  }

  /** Autoplay (banner ▶ button, Space). */
  isPlaying(): boolean {
    return this.autoplay.isPlaying();
  }

  play(): void {
    this.autoplay.play();
  }

  pause(): void {
    this.autoplay.pause();
  }

  toggleAutoplay(): void {
    this.autoplay.toggle();
  }

  setAutoplaySettings(settings: { seconds?: number; loop?: boolean }): void {
    this.autoplay.setSettings(settings);
    this.syncAutoplayControls();
  }

  getAutoplaySettings(): { seconds: number; loop: boolean } {
    return this.autoplay.getSettings();
  }

  /** "Show changes" toggle (remembered in localStorage `rd.scenario.showChanges`). */
  setShowChanges(on: boolean): void {
    this.showChanges = on;
    writeShowChanges(on);
    if (this.diffToggle) this.diffToggle.checked = on;
    if (this.state) this.render();
  }

  isShowingChanges(): boolean {
    return this.showChanges;
  }

  /** Differences of the shown step to the previous one (null: off, first step or closed). */
  getShownDiff(): SnapshotDiff | null {
    return this.state && this.showChanges ? this.lastDiff : null;
  }

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
    this.autoplay.restartInterval();
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
    this.autoplay.restartInterval();
  }

  last(): void {
    const scenario = this.currentScenario();
    if (scenario) this.show(scenario.steps.length - 1);
    this.autoplay.restartInterval();
  }

  /** Back to editing: removes the view and shows the (untouched) live drawing again. */
  close(): void {
    if (!this.state) return;
    const { tabId } = this.state;
    this.autoplay.pause();
    this.state = null;
    this.lastDiff = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.renderedXml = null;
    this.renderedUml = null;
    this.renderedText = null;
    this.umlSeq++;
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
    // Autoplay: ▶/⏸, interval, loop
    const play = el('button', 'rd-scn-banner-btn rd-scn-play-btn', '▶ Play');
    play.type = 'button';
    play.title = 'Play the steps automatically (Space)';
    play.setAttribute('aria-pressed', 'false');
    const interval = el('select', 'rd-scn-autoplay-interval');
    interval.title = 'Autoplay interval';
    interval.setAttribute('aria-label', 'Autoplay interval');
    const seconds = this.autoplay.getSettings().seconds;
    const values: number[] = [...AUTOPLAY_INTERVALS];
    if (!values.includes(seconds)) values.push(seconds);
    for (const v of values.sort((a, b) => a - b)) {
      const opt = el('option', undefined, `${v} s`);
      opt.value = String(v);
      interval.appendChild(opt);
    }
    const loopLabel = el('label', 'rd-scn-banner-check rd-scn-autoplay-loop-label');
    loopLabel.title = 'Start again at step 1 after the last step';
    const loop = el('input', 'rd-scn-autoplay-loop');
    loop.type = 'checkbox';
    loopLabel.append(loop, document.createTextNode(' Loop'));
    const autoplayGroup = el('div', 'rd-scn-autoplay');
    autoplayGroup.append(play, interval, loopLabel);
    // Show changes against the previous step
    const diffLabel = el('label', 'rd-scn-banner-check rd-scn-diff-label');
    diffLabel.title = 'Highlight what changed since the previous step';
    const diffToggle = el('input', 'rd-scn-diff-toggle');
    diffToggle.type = 'checkbox';
    diffToggle.checked = this.showChanges;
    diffLabel.append(diffToggle, document.createTextNode(' Show changes'));
    banner.append(badge, prev, text, next, autoplayGroup, diffLabel, replace, exit);
    const host = el('div', 'rd-scn-view-host');
    const side = el('aside', 'rd-scn-side');
    side.dataset.testid = 'scenario-side-panel';
    side.setAttribute('aria-label', 'Step UML and text');
    const sideHead = el('div', 'rd-scn-side-head');
    const sideTitle = el('span', 'rd-scn-side-title', 'UML & text');
    const sideToggle = el('button', 'rd-scn-side-toggle');
    sideToggle.type = 'button';
    sideHead.append(sideTitle, sideToggle);
    const sideBody = el('div', 'rd-scn-side-body');
    const umlSection = el('section', 'rd-scn-side-section');
    umlSection.appendChild(el('h3', 'rd-scn-side-heading', 'UML'));
    const umlEl = el('div', 'rd-scn-side-uml');
    umlEl.setAttribute('aria-live', 'polite');
    umlSection.appendChild(umlEl);
    const textSection = el('section', 'rd-scn-side-section');
    textSection.appendChild(el('h3', 'rd-scn-side-heading', 'Text'));
    const textEl = el('div', 'rd-scn-side-text rd-scn-markdown');
    textSection.appendChild(textEl);
    const changesSection = el('section', 'rd-scn-side-section rd-scn-side-changes-section');
    changesSection.appendChild(el('h3', 'rd-scn-side-heading', 'Changes'));
    const changesEl = el('div', 'rd-scn-side-changes');
    changesEl.setAttribute('aria-live', 'polite');
    changesSection.appendChild(changesEl);
    changesSection.hidden = true;
    sideBody.append(changesSection, umlSection, textSection);
    side.append(sideHead, sideBody);
    const legend = el('div', 'rd-scn-diff-legend');
    legend.dataset.testid = 'scenario-diff-legend';
    legend.setAttribute('aria-label', 'Legend of the change highlights');
    for (const kind of ['added', 'removed', 'moved', 'changed'] as CellChangeKind[]) {
      const item = el('span', `rd-scn-diff-legend-item rd-scn-diff-${kind}`);
      const swatch = el('span', 'rd-scn-diff-swatch');
      swatch.style.borderColor = DIFF_COLORS[kind];
      if (kind === 'removed') swatch.style.background = `${DIFF_COLORS[kind]}2e`;
      item.append(swatch, document.createTextNode(DIFF_LABELS[kind]));
      legend.appendChild(item);
    }
    legend.hidden = true;
    const hostWrap = el('div', 'rd-scn-view-canvas');
    hostWrap.append(host, legend);
    const body = el('div', 'rd-scn-view-body');
    body.append(hostWrap, side);
    wrapper.append(banner, body);
    this.options.graphContainer.appendChild(wrapper);
    sideToggle.addEventListener('click', () => this.setSideCollapsed(!this.collapsed));

    prev.addEventListener('click', () => this.go(-1));
    next.addEventListener('click', () => this.go(1));
    exit.addEventListener('click', () => this.close());
    play.addEventListener('click', () => this.toggleAutoplay());
    interval.addEventListener('change', () => this.setAutoplaySettings({ seconds: Number(interval.value) }));
    loop.addEventListener('change', () => this.setAutoplaySettings({ loop: loop.checked }));
    diffToggle.addEventListener('change', () => this.setShowChanges(diffToggle.checked));
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
    this.side = side;
    this.sideToggle = sideToggle;
    this.umlEl = umlEl;
    this.textEl = textEl;
    this.playBtn = play;
    this.intervalSelect = interval;
    this.loopBox = loop;
    this.diffToggle = diffToggle;
    this.legendEl = legend;
    this.changesSection = changesSection;
    this.changesEl = changesEl;
    this.syncAutoplayControls();
    this.applySideState();
  }

  /** Collapses/expands the UML & text panel (remembered in localStorage). */
  setSideCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    writeCollapsed(collapsed);
    this.applySideState();
  }

  isSideCollapsed(): boolean {
    return this.collapsed;
  }

  private syncAutoplayControls(): void {
    const settings = this.autoplay.getSettings();
    if (this.intervalSelect) {
      const value = String(settings.seconds);
      if (!Array.from(this.intervalSelect.options).some((o) => o.value === value)) {
        const opt = el('option', undefined, `${value} s`);
        opt.value = value;
        this.intervalSelect.appendChild(opt);
      }
      this.intervalSelect.value = value;
    }
    if (this.loopBox) this.loopBox.checked = settings.loop;
  }

  private applyPlayState(playing: boolean): void {
    if (!this.playBtn) return;
    this.playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
    this.playBtn.title = playing ? 'Pause autoplay (Space)' : 'Play the steps automatically (Space)';
    this.playBtn.setAttribute('aria-pressed', String(playing));
    this.wrapper?.classList.toggle('rd-scn-playing', playing);
  }

  private applySideState(): void {
    if (!this.side || !this.sideToggle) return;
    this.side.classList.toggle('rd-scn-side-collapsed', this.collapsed);
    this.sideToggle.textContent = this.collapsed ? '‹' : '›';
    const label = this.collapsed ? 'Show the UML and text panel' : 'Hide the UML and text panel';
    this.sideToggle.title = label;
    this.sideToggle.setAttribute('aria-label', label);
    this.sideToggle.setAttribute('aria-expanded', String(!this.collapsed));
  }

  private ensureGraph(): Graph {
    if (this.graph) return this.graph;
    const graph = new Graph(this.host!);
    // read-only: rendering compat as in the tabs + stencil autoload (setup-graph.ts)
    setupGraph(graph, 'view');
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
      // The live graph's scrollable extent (canvas-scroll.ts: padding around the content), so its
      // scroll position below is reachable here too
      graph.minimumGraphSize = liveDiv && liveDiv.scrollWidth > 0
        ? new Rectangle(0, 0, liveDiv.scrollWidth / scale, liveDiv.scrollHeight / scale)
        : null;
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
    if (this.playBtn) this.playBtn.disabled = total < 2;
    const prevStep = this.state.index > 0 ? scenario.steps[this.state.index - 1] : null;
    let shownXml = step.xml;
    this.lastDiff = null;
    if (this.showChanges && prevStep) {
      try {
        this.lastDiff = diffSnapshots(prevStep.xml, step.xml);
        shownXml = buildDiffHighlightXml(prevStep.xml, step.xml, this.lastDiff);
      } catch (error) {
        console.error('[Scenarios] Could not compare the steps:', error);
      }
    }
    if (shownXml !== this.renderedXml) {
      this.renderedXml = shownXml;
      this.loadSnapshot(shownXml);
    }
    this.renderChanges(prevStep !== null);
    this.renderSide(step);
    this.options.onStateChange?.({ ...this.state });
  }

  /** Legend, the side panel's "Changes" list and the counts on the view (data-diff-*). */
  private renderChanges(hasPrevious: boolean): void {
    const on = this.showChanges;
    const diff = this.lastDiff;
    this.legendEl!.hidden = !on || !hasPrevious;
    this.changesSection!.hidden = !on;
    const wrapper = this.wrapper!;
    for (const kind of ['added', 'removed', 'moved', 'changed'] as CellChangeKind[]) {
      if (diff) wrapper.dataset[`diff${kind.charAt(0).toUpperCase()}${kind.slice(1)}`] = String(diff.counts[kind]);
      else delete wrapper.dataset[`diff${kind.charAt(0).toUpperCase()}${kind.slice(1)}`];
    }
    wrapper.classList.toggle('rd-scn-showing-changes', on && hasPrevious);
    if (!on) return;
    const host = this.changesEl!;
    host.textContent = '';
    if (!hasPrevious) {
      host.appendChild(el('p', 'rd-scn-side-empty', 'First step: nothing to compare with.'));
      return;
    }
    if (!diff) {
      host.appendChild(el('p', 'rd-scn-side-empty', 'The steps could not be compared.'));
      return;
    }
    if (diff.changes.length === 0) {
      host.appendChild(el('p', 'rd-scn-side-empty', 'No changes since the previous step.'));
      return;
    }
    host.appendChild(el('p', 'rd-scn-diff-counts', diffCountsText(diff.counts)));
    const list = el('ul', 'rd-scn-diff-list');
    for (const change of diff.changes) {
      const li = el('li', `rd-scn-diff-item rd-scn-diff-${change.kind}`);
      li.dataset.kind = change.kind;
      li.dataset.cellId = change.id;
      const dot = el('span', 'rd-scn-diff-dot');
      dot.style.background = DIFF_COLORS[change.kind];
      li.append(dot, document.createTextNode(change.summary));
      list.appendChild(li);
    }
    host.appendChild(list);
  }

  /** UML (async: a server rendering may take a while; stale answers are dropped) and Markdown. */
  private renderSide(step: ScenarioStepData): void {
    if (step.text !== this.renderedText) {
      this.renderedText = step.text;
      showMarkdown(this.textEl!, step.text, 'No text for this step.');
    }
    if (step.uml === this.renderedUml) return;
    this.renderedUml = step.uml;
    const seq = ++this.umlSeq;
    const host = this.umlEl!;
    host.classList.add('rd-scn-busy');
    const render = this.options.renderUml ?? ((source: string) => renderStepUml(source));
    void render(step.uml).then((result) => {
      if (seq !== this.umlSeq) return;
      host.classList.remove('rd-scn-busy');
      showUmlResult(host, result, 'No UML diagram for this step.');
    });
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
