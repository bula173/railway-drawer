/**
 * @file run-view.ts
 * @brief The "Train run" view (Railway > Train Run…, lazy chunk): a docked panel over the canvas
 *        with the run settings (routes, train, speed, section limits, length, dwell, overlap timer),
 *        playback (play / pause, previous / next event, speed multiplier 1× 2× 5× 10×, timeline
 *        scrubber), the event list and "Create scenario from run" / "Keep final state" / "Close".
 *
 * Like the scenario view, the run is shown on a separate graph (made by the boot code like a tab
 * graph, profile 'view') loaded with a copy of the active tab's drawing, mounted in
 * `#graph-container` while the tab's graph div is only hidden: the animation (states via
 * RunRenderer, the train cell moving along the path, a translucent overlay of the train's length)
 * never touches the live model or its undo history, so Close shows the drawing exactly as it was.
 * "Keep final state" puts the end state on the live drawing as ONE undoable edit, then closes.
 */
import { GraphDataModel, Rectangle } from '@maxgraph/core';
import type { Cell, Graph } from '@maxgraph/core';
import { importModelXml, sanitizeXmlText } from '../../services/drawio-xml';
import { formatChainage } from '../km';
import { GraphOverlay, pointsAttr, svgEl } from '../graph-overlay';
import { allCells, getCellKind, readAttr, readObjectId } from '../object-data';
import { buildRunPath, kmAtM, lineBetween } from './run-path';
import { RunRenderer } from './run-renderer';
import type { TrainChoice } from './run-renderer';
import { formatSeconds, headAt, simulateRun, speedAt, statesAt } from './simulate';
import type { RunOptions, RunResult } from './simulate';
import './train-run.css';

export const SPEED_MULTIPLIERS = [1, 2, 5, 10] as const;

/** What the view needs from the active tab. */
export interface RunTab {
  id: string;
  graph: Graph;
  /** The drawing as draw.io model XML. */
  serializeToXml(): string;
}

export interface TrainRunViewOptions {
  /** `#graph-container`. */
  graphContainer: HTMLElement;
  /** A read-only graph configured like the tab graphs (setup-graph.ts profile 'view'). */
  createViewGraph(host: HTMLElement): Graph;
  /** "Create scenario from run" (null: button hidden). Resolves the scenario name. */
  createScenario?: ((tab: RunTab, run: RunResult, train: TrainChoice, etcsLevel: string) => Promise<string | null> | string | null) | null;
  /** Messages (success / warning / error). */
  notify(kind: 'success' | 'warning' | 'error', message: string): void;
  onClose?(): void;
}

export interface TrainRunOpenOptions {
  routes?: string[];
  /** Cell id of a train to run (default: the first train of the drawing, else a new one). */
  trainCellId?: string | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string, title: string): HTMLButtonElement {
  const b = el('button', `rd-trn-btn ${className}`, text);
  b.type = 'button';
  b.title = title;
  return b;
}

function numberInput(className: string, value: number, min: number, max: number, step: number, label: string): HTMLInputElement {
  const input = el('input', `rd-trn-input ${className}`);
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', label);
  return input;
}

function field(label: string, control: HTMLElement, unit?: string): HTMLLabelElement {
  const l = el('label', 'rd-trn-field');
  l.append(el('span', 'rd-trn-field-label', label), control);
  if (unit) l.append(el('span', 'rd-trn-unit', unit));
  return l;
}

interface RouteInfo {
  id: string;
  entry: string;
  exit: string;
}

/** Route chains (consecutive routes, up to 4) as suggestions for the routes field. */
export function routeChains(routes: RouteInfo[], maxLength = 4): string[] {
  const out: string[] = [];
  const walk = (chain: RouteInfo[]): void => {
    out.push(chain.map((r) => r.id).join(', '));
    if (chain.length >= maxLength || out.length > 60) return;
    const last = chain[chain.length - 1];
    for (const next of routes) {
      if (chain.includes(next)) continue;
      if (next.entry && next.entry.toUpperCase() === last.exit.toUpperCase()) walk([...chain, next]);
    }
  };
  for (const r of routes) walk([r]);
  return out;
}

const parseRoutes = (text: string): string[] => text.split(/[,;\s→>]+/).map((s) => s.trim()).filter(Boolean);

export class TrainRunView {
  private tab: RunTab | null = null;
  private wrapper: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private graph: Graph | null = null;
  private overlay: GraphOverlay | null = null;
  private renderer: RunRenderer | null = null;
  private run: RunResult | null = null;
  private time = 0;
  private playing = false;
  private multiplier = 1;
  private frame = 0;
  private lastFrame = 0;
  private baseXml = '';
  // controls
  private routesInput!: HTMLInputElement;
  private routesList!: HTMLDataListElement;
  private trainSelect!: HTMLSelectElement;
  private speedInput!: HTMLInputElement;
  private limitsBox!: HTMLInputElement;
  private lengthInput!: HTMLInputElement;
  private dwellInput!: HTMLInputElement;
  private overlapInput!: HTMLInputElement;
  private playBtn!: HTMLButtonElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private multiplierSelect!: HTMLSelectElement;
  private scrubber!: HTMLInputElement;
  private timeEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private messageEl!: HTMLElement;
  private eventsEl!: HTMLOListElement;
  private scenarioBtn!: HTMLButtonElement;
  private keepBtn!: HTMLButtonElement;

  constructor(private readonly options: TrainRunViewOptions) {}

  isOpen(): boolean {
    return this.tab !== null;
  }

  /** The run shown (tests). */
  getRun(): RunResult | null {
    return this.run;
  }

  /** The view's graph (tests / e2e). */
  getGraph(): Graph | null {
    return this.graph;
  }

  getTime(): number {
    return this.time;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getTabId(): string | null {
    return this.tab?.id ?? null;
  }

  /** Opens the view on `tab` (a copy of its drawing). */
  open(tab: RunTab, opts: TrainRunOpenOptions = {}): void {
    if (this.tab) this.close();
    this.tab = tab;
    this.ensureDom();
    const graph = this.ensureGraph();
    this.baseXml = tab.serializeToXml();
    const scratch = new GraphDataModel();
    importModelXml(sanitizeXmlText(this.baseXml), scratch);
    graph.getDataModel().setRoot(scratch.getRoot()!);
    this.mount(tab);
    this.fillControls(opts);
    this.resimulate();
  }

  private liveDiv(tabId: string): HTMLElement | null {
    return document.getElementById(`graph-${tabId}`);
  }

  private ensureGraph(): Graph {
    if (this.graph) return this.graph;
    const graph = this.options.createViewGraph(this.host!);
    graph.resetViewOnRootChange = false;
    this.graph = graph;
    this.overlay = new GraphOverlay(graph, 'rd-trn-overlay');
    return graph;
  }

  private mount(tab: RunTab): void {
    const graph = this.graph!;
    const live = tab.graph;
    const liveDiv = this.liveDiv(tab.id);
    const { scale, translate } = live.view;
    graph.minimumGraphSize = liveDiv && liveDiv.scrollWidth > 0 ? new Rectangle(0, 0, liveDiv.scrollWidth / scale, liveDiv.scrollHeight / scale) : null;
    graph.view.scaleAndTranslate(scale, translate.x, translate.y);
    const scrollLeft = liveDiv?.scrollLeft ?? 0;
    const scrollTop = liveDiv?.scrollTop ?? 0;
    if (liveDiv) liveDiv.style.display = 'none';
    this.wrapper!.hidden = false;
    document.body.classList.add('rd-train-run-viewing');
    graph.refresh();
    const restoreScroll = (): void => {
      if (!this.host) return;
      this.host.scrollLeft = scrollLeft;
      this.host.scrollTop = scrollTop;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restoreScroll);
    else setTimeout(restoreScroll, 0);
  }

  /** Closes the view: the live drawing is shown again, unchanged. */
  close(): void {
    if (!this.tab) return;
    const tabId = this.tab.id;
    this.pause();
    this.renderer = null;
    this.run = null;
    this.tab = null;
    this.overlay?.clear();
    this.graph?.getDataModel().clear();
    if (this.wrapper) this.wrapper.hidden = true;
    const liveDiv = this.liveDiv(tabId);
    if (liveDiv) liveDiv.style.display = 'block';
    document.body.classList.remove('rd-train-run-viewing');
    this.options.onClose?.();
  }

  destroy(): void {
    this.close();
    this.overlay?.destroy();
    this.graph?.destroy();
    this.graph = null;
    this.wrapper?.remove();
    this.wrapper = null;
  }

  // ------------------------------------------------------------------------------------------ DOM

  private ensureDom(): void {
    if (this.wrapper) return;
    const wrapper = el('div', 'rd-trn-view');
    wrapper.dataset.testid = 'train-run-view';
    wrapper.hidden = true;
    const bar = el('div', 'rd-trn-bar');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Train run');

    const setup = el('div', 'rd-trn-row rd-trn-setup');
    const badge = el('span', 'rd-trn-badge', 'Train run');
    this.routesInput = el('input', 'rd-trn-input rd-trn-routes');
    this.routesInput.type = 'text';
    this.routesInput.dataset.testid = 'train-run-routes';
    this.routesInput.setAttribute('aria-label', 'Routes (consecutive, comma separated)');
    this.routesInput.title = 'One route or consecutive routes, e.g. R1, R2';
    this.routesList = el('datalist');
    this.routesList.id = 'rd-trn-route-chains';
    this.routesInput.setAttribute('list', this.routesList.id);
    this.trainSelect = el('select', 'rd-trn-input rd-trn-train');
    this.trainSelect.dataset.testid = 'train-run-train';
    this.trainSelect.setAttribute('aria-label', 'Train');
    this.speedInput = numberInput('rd-trn-speed', 80, 1, 600, 5, 'Speed in km/h');
    this.speedInput.dataset.testid = 'train-run-speed';
    this.limitsBox = el('input', 'rd-trn-limits');
    this.limitsBox.type = 'checkbox';
    const limits = el('label', 'rd-trn-check');
    limits.title = 'Slow down to the speed limit (rdSpeedLimit, km/h) of the track sections under the train';
    limits.append(this.limitsBox, document.createTextNode(' Section limits'));
    this.lengthInput = numberInput('rd-trn-length', 100, 0, 5000, 10, 'Train length in metres');
    this.lengthInput.dataset.testid = 'train-run-length';
    this.dwellInput = numberInput('rd-trn-dwell', 0, 0, 3600, 5, 'Dwell at the exit in seconds');
    this.overlapInput = numberInput('rd-trn-overlap', 30, 0, 3600, 5, 'Overlap release timer in seconds');
    setup.append(
      badge,
      field('Routes', this.routesInput),
      this.routesList,
      field('Train', this.trainSelect),
      field('Speed', this.speedInput, 'km/h'),
      limits,
      field('Length', this.lengthInput, 'm'),
      field('Dwell', this.dwellInput, 's'),
      field('Overlap release', this.overlapInput, 's')
    );

    const playback = el('div', 'rd-trn-row rd-trn-playback');
    this.playBtn = button('rd-trn-play', '▶ Play', 'Play the run (Space)');
    this.playBtn.dataset.testid = 'train-run-play';
    this.playBtn.setAttribute('aria-pressed', 'false');
    this.prevBtn = button('rd-trn-prev', '⏮ Event', 'Previous event (←)');
    this.nextBtn = button('rd-trn-next', 'Event ⏭', 'Next event (→)');
    this.nextBtn.dataset.testid = 'train-run-step';
    this.multiplierSelect = el('select', 'rd-trn-input rd-trn-multiplier');
    this.multiplierSelect.dataset.testid = 'train-run-multiplier';
    this.multiplierSelect.setAttribute('aria-label', 'Playback speed');
    this.multiplierSelect.title = 'Playback speed';
    for (const m of SPEED_MULTIPLIERS) {
      const opt = el('option', undefined, `${m}×`);
      opt.value = String(m);
      this.multiplierSelect.append(opt);
    }
    this.scrubber = el('input', 'rd-trn-scrubber');
    this.scrubber.type = 'range';
    this.scrubber.min = '0';
    this.scrubber.step = '0.1';
    this.scrubber.dataset.testid = 'train-run-scrubber';
    this.scrubber.setAttribute('aria-label', 'Time of the run');
    this.timeEl = el('span', 'rd-trn-time');
    this.timeEl.setAttribute('aria-live', 'off');
    this.statusEl = el('span', 'rd-trn-status');
    this.scenarioBtn = button('rd-trn-scenario', 'Create scenario from run', 'A scenario with one step per significant moment (states, text, sequence diagram)');
    this.scenarioBtn.dataset.testid = 'train-run-create-scenario';
    this.scenarioBtn.hidden = !this.options.createScenario;
    this.keepBtn = button('rd-trn-keep', 'Keep final state', 'Put the end state of the run on the drawing (one undo step) and close');
    this.keepBtn.dataset.testid = 'train-run-keep';
    const closeBtn = button('rd-trn-btn-primary rd-trn-close', 'Close', 'Back to the drawing as it was (Esc)');
    closeBtn.dataset.testid = 'train-run-close';
    playback.append(this.playBtn, this.prevBtn, this.nextBtn, this.multiplierSelect, this.scrubber, this.timeEl, this.statusEl, this.scenarioBtn, this.keepBtn, closeBtn);

    this.messageEl = el('div', 'rd-trn-message');
    this.messageEl.hidden = true;
    this.messageEl.setAttribute('role', 'status');
    bar.append(setup, playback, this.messageEl);

    const host = el('div', 'rd-trn-host');
    const side = el('aside', 'rd-trn-side');
    side.setAttribute('aria-label', 'Events of the run');
    side.append(el('h3', 'rd-trn-side-heading', 'Events'));
    this.eventsEl = el('ol', 'rd-trn-events');
    this.eventsEl.dataset.testid = 'train-run-events';
    side.append(this.eventsEl);
    const body = el('div', 'rd-trn-body');
    body.append(host, side);
    wrapper.append(bar, body);
    this.options.graphContainer.append(wrapper);
    this.wrapper = wrapper;
    this.host = host;

    const resim = (): void => this.resimulate();
    for (const input of [this.routesInput, this.speedInput, this.lengthInput, this.dwellInput, this.overlapInput]) input.addEventListener('change', resim);
    this.trainSelect.addEventListener('change', () => this.onTrainChange());
    this.limitsBox.addEventListener('change', resim);
    this.playBtn.addEventListener('click', () => this.toggle());
    this.prevBtn.addEventListener('click', () => this.stepEvent(-1));
    this.nextBtn.addEventListener('click', () => this.stepEvent(1));
    this.multiplierSelect.addEventListener('change', () => this.setMultiplier(Number(this.multiplierSelect.value)));
    this.scrubber.addEventListener('input', () => {
      this.pause();
      this.seek(Number(this.scrubber.value));
    });
    this.eventsEl.addEventListener('click', (e) => {
      const li = (e.target as Element).closest<HTMLElement>('li[data-t]');
      if (!li) return;
      this.pause();
      this.seek(Number(li.dataset.t));
    });
    this.scenarioBtn.addEventListener('click', () => void this.createScenario());
    this.keepBtn.addEventListener('click', () => this.keepFinalState());
    closeBtn.addEventListener('click', () => this.close());
  }

  private trains(): Cell[] {
    return this.tab ? allCells(this.tab.graph.getDataModel()).filter((c) => getCellKind(c) === 'train') : [];
  }

  private fillControls(opts: TrainRunOpenOptions): void {
    const model = this.tab!.graph.getDataModel();
    const routes: RouteInfo[] = allCells(model)
      .filter((c) => getCellKind(c) === 'route' && readObjectId(c))
      .map((c) => ({ id: readObjectId(c), entry: readAttr(c, 'rdEntrySignal').trim(), exit: readAttr(c, 'rdExitSignal').trim() }));
    this.routesList.replaceChildren(...routeChains(routes).map((chain) => Object.assign(el('option'), { value: chain })));
    this.routesInput.value = (opts.routes && opts.routes.length > 0 ? opts.routes : routes.slice(0, 1).map((r) => r.id)).join(', ');
    this.trainSelect.replaceChildren();
    for (const t of this.trains()) {
      const opt = el('option', undefined, readObjectId(t) || `Train (cell ${t.getId()})`);
      opt.value = String(t.getId());
      this.trainSelect.append(opt);
    }
    const fresh = el('option', undefined, 'New train');
    fresh.value = '';
    this.trainSelect.append(fresh);
    const wanted = opts.trainCellId ?? this.trains()[0]?.getId() ?? '';
    this.trainSelect.value = String(wanted);
    this.applyTrainDefaults();
    this.multiplierSelect.value = String(this.multiplier);
  }

  private selectedTrain(): Cell | null {
    const id = this.trainSelect.value;
    return id ? this.tab?.graph.getDataModel().getCell(id) ?? null : null;
  }

  /** Speed and length from the chosen train's data (max speed, length) when it has them. */
  private applyTrainDefaults(): void {
    const train = this.selectedTrain();
    const speed = Number(readAttr(train, 'rdMaxSpeed'));
    const length = Number(readAttr(train, 'rdLength'));
    if (speed > 0) this.speedInput.value = String(speed);
    if (length > 0) this.lengthInput.value = String(length);
  }

  private onTrainChange(): void {
    this.applyTrainDefaults();
    this.resimulate();
  }

  private runOptions(): RunOptions {
    const n = (input: HTMLInputElement, fallback: number): number => {
      const v = Number(input.value);
      return Number.isFinite(v) && input.value.trim() !== '' ? v : fallback;
    };
    return {
      speedKmh: Math.max(1, n(this.speedInput, 80)),
      lengthM: Math.max(0, n(this.lengthInput, 100)),
      useSpeedLimits: this.limitsBox.checked,
      dwellS: Math.max(0, n(this.dwellInput, 0)),
      overlapReleaseS: Math.max(0, n(this.overlapInput, 30)),
    };
  }

  private trainChoice(): TrainChoice {
    return { cellId: this.trainSelect.value || null };
  }

  private etcsLevel(): string {
    const train = this.selectedTrain();
    return train ? readAttr(train, 'rdEtcsLevel').trim() : '2';
  }

  private showMessage(kind: 'error' | 'warning' | null, text: string): void {
    this.messageEl.hidden = !kind;
    this.messageEl.textContent = text;
    this.messageEl.className = `rd-trn-message${kind ? ` rd-trn-message-${kind}` : ''}`;
  }

  /** (Re)computes the run from the controls and shows it from the start. */
  resimulate(): void {
    if (!this.tab || !this.graph) return;
    this.pause();
    this.renderer?.restore();
    this.renderer = null;
    this.run = null;
    this.overlay?.clear();
    const res = buildRunPath(this.tab.graph.getDataModel(), parseRoutes(this.routesInput.value));
    const enabled = !!res.path;
    for (const b of [this.playBtn, this.prevBtn, this.nextBtn, this.scenarioBtn, this.keepBtn]) b.disabled = !enabled;
    this.scrubber.disabled = !enabled;
    if (!res.path) {
      this.showMessage('error', res.error ?? 'No path');
      this.eventsEl.replaceChildren();
      this.timeEl.textContent = '';
      this.statusEl.textContent = '';
      this.wrapper!.dataset.state = 'error';
      return;
    }
    const run = simulateRun(res.path, this.runOptions());
    this.run = run;
    this.renderer = new RunRenderer(this.graph, run, this.trainChoice());
    const notes = [...run.warnings];
    if (this.renderer.missing.length > 0) notes.push(`Not in the drawing: ${this.renderer.missing.join(', ')}`);
    this.showMessage(notes.length > 0 ? 'warning' : null, notes.join(' '));
    this.scrubber.max = String(Math.round(run.durationS * 10) / 10);
    this.renderEvents();
    this.wrapper!.dataset.state = 'ready';
    this.seek(0);
  }

  private renderEvents(): void {
    const run = this.run!;
    this.eventsEl.replaceChildren(
      ...run.events.map((e, i) => {
        const li = el('li', 'rd-trn-event');
        li.dataset.t = String(e.t);
        li.dataset.index = String(i);
        li.dataset.type = e.type;
        li.tabIndex = -1;
        li.append(el('span', 'rd-trn-event-time', formatSeconds(e.t)), el('span', 'rd-trn-event-label', e.label));
        return li;
      })
    );
  }

  /** Shows the run at `t` seconds. */
  seek(t: number): void {
    const run = this.run;
    if (!run || !this.renderer) return;
    this.time = Math.max(0, Math.min(run.durationS, t));
    this.renderer.showAt(this.time);
    const head = headAt(run, this.time);
    // the train's length along the track (view overlay, not in the model)
    const body = lineBetween(run.path, head - run.options.lengthM, head);
    this.overlay?.set(body.length >= 2 ? [svgEl('polyline', { points: pointsAttr(body), fill: 'none', stroke: '#c62828', 'stroke-width': 10, 'stroke-opacity': 0.35, 'stroke-linecap': 'round', class: 'rd-trn-extent' })] : []);
    this.scrubber.value = String(Math.round(this.time * 10) / 10);
    this.timeEl.textContent = `${this.time.toFixed(1)} s / ${run.durationS.toFixed(1)} s`;
    const km = kmAtM(run.path, head);
    const states = statesAt(run, this.time);
    const occupied = [...states.values()].filter((c) => c.state === 'occupied' && c.kind !== 'route').map((c) => c.id);
    this.statusEl.textContent = `Head ${Math.round(head)} m${km !== null ? ` (km ${formatChainage(km)})` : ''} · ${Math.round(speedAt(run, this.time))} km/h`;
    const w = this.wrapper!;
    w.dataset.t = this.time.toFixed(1);
    w.dataset.headM = String(Math.round(head));
    w.dataset.occupied = occupied.join(',');
    w.dataset.playing = String(this.playing);
    let current = -1;
    run.events.forEach((e, i) => {
      if (e.t <= this.time + 1e-9) current = i;
    });
    this.eventsEl.querySelectorAll<HTMLElement>('li').forEach((li, i) => {
      li.classList.toggle('rd-trn-event-past', i <= current);
      li.classList.toggle('rd-trn-event-current', i === current);
    });
    this.prevBtn.disabled = this.time <= 1e-9;
    this.nextBtn.disabled = !run.events.some((e) => e.t > this.time + 1e-6) && this.time >= run.durationS - 1e-9;
  }

  /** Jumps to the previous / next event time. */
  stepEvent(direction: 1 | -1): void {
    const run = this.run;
    if (!run) return;
    this.pause();
    const times = [...new Set(run.events.map((e) => e.t))].sort((a, b) => a - b);
    if (direction > 0) this.seek(times.find((t) => t > this.time + 1e-6) ?? run.durationS);
    else this.seek([...times].reverse().find((t) => t < this.time - 1e-6) ?? 0);
  }

  setMultiplier(m: number): void {
    this.multiplier = SPEED_MULTIPLIERS.includes(m as (typeof SPEED_MULTIPLIERS)[number]) ? m : 1;
    if (this.multiplierSelect) this.multiplierSelect.value = String(this.multiplier);
  }

  play(): void {
    const run = this.run;
    if (!run || this.playing) return;
    if (this.time >= run.durationS - 1e-9) this.seek(0);
    this.playing = true;
    this.lastFrame = performance.now();
    this.syncPlay();
    const tick = (now: number): void => {
      if (!this.playing || !this.run) return;
      const dt = Math.max(0, Math.min(0.25, (now - this.lastFrame) / 1000));
      this.lastFrame = now;
      const next = this.time + dt * this.multiplier;
      if (next >= this.run.durationS) {
        this.seek(this.run.durationS);
        this.pause();
        return;
      }
      this.seek(next);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  pause(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!this.playing) return;
    this.playing = false;
    this.syncPlay();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  private syncPlay(): void {
    this.playBtn.textContent = this.playing ? '⏸ Pause' : '▶ Play';
    this.playBtn.title = this.playing ? 'Pause (Space)' : 'Play the run (Space)';
    this.playBtn.setAttribute('aria-pressed', String(this.playing));
    if (this.wrapper) this.wrapper.dataset.playing = String(this.playing);
  }

  private async createScenario(): Promise<void> {
    const run = this.run;
    const tab = this.tab;
    if (!run || !tab || !this.options.createScenario) return;
    this.pause();
    this.scenarioBtn.disabled = true;
    try {
      const name = await this.options.createScenario(tab, run, this.trainChoice(), this.etcsLevel());
      if (name) this.options.notify('success', `Scenario "${name}" created from the run`);
    } catch (error) {
      this.options.notify('error', `Could not create the scenario: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.scenarioBtn.disabled = !this.run;
    }
  }

  /** The end state of the run on the live drawing (one undoable edit), then the view closes. */
  keepFinalState(): void {
    const run = this.run;
    const tab = this.tab;
    if (!run || !tab) return;
    const model = tab.graph.getDataModel();
    const renderer = new RunRenderer(tab.graph, run, this.trainChoice());
    model.beginUpdate();
    try {
      renderer.showAt(run.durationS);
    } finally {
      model.endUpdate();
    }
    const train = renderer.trainId;
    this.close();
    this.options.notify('success', `Final state of the run kept (train ${train} at ${run.path.routes.at(-1)?.exit ?? 'the exit'}); Ctrl+Z undoes it`);
  }

  /**
   * Keys while the view is open (the keymap's interceptor): Esc closes, Space plays / pauses,
   * ← / → previous / next event; editing shortcuts are blocked (the live drawing is hidden).
   * Returns true when the key was handled here.
   */
  handleKeydown(e: KeyboardEvent): boolean {
    if (!this.tab) return false;
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return true;
    }
    if (typing) {
      const range = target instanceof HTMLInputElement && (target.type === 'range' || target.type === 'checkbox');
      if (!range) return true; // the field takes the key; no graph shortcut
    }
    if ((e.key === ' ' || e.key === 'Enter') && target instanceof HTMLButtonElement) return true; // the button's own click
    if (e.key === ' ') {
      e.preventDefault();
      this.toggle();
      return true;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(target instanceof HTMLInputElement && target.type === 'range')) {
      e.preventDefault();
      this.stepEvent(e.key === 'ArrowRight' ? 1 : -1);
      return true;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Delete' || e.key === 'Backspace' || e.key.length === 1) e.preventDefault();
    return true;
  }
}
