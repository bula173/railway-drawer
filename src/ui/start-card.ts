/**
 * @file start-card.ts
 * @brief Start card over the canvas of a fresh, empty tab: the first things to do in a railway
 *        diagram (insert ERTMS symbols, open a template / file, import railML, Railway Script) and
 *        the F1 hint.
 *
 * Shown while the active tab's diagram is empty. It goes away on any insert/open (the diagram is
 * no longer empty), on one of its actions, on Esc or its close button (until the next new empty
 * tab), and for good with "Don't show again" (localStorage `rd.startCard.hidden`). It never
 * covers drops: while something is dragged it is hidden (and it only covers its own box, the
 * rest of the canvas gets the pointer).
 *
 * Automated browsers (`navigator.webdriver`, e.g. Playwright) do not get it unless localStorage
 * `rd.startCard.force` is '1': the e2e suites click the canvas centre, where the card sits.
 */
import { onModelChange } from '../core/graph-events';
import { openFloatingPanel } from '../core/modal';
import type { FloatingPanelHandle } from '../core/modal';
import type { Graph } from '@maxgraph/core';
import './start-card.css';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

export const START_CARD_HIDDEN_KEY = STORAGE_KEYS.startCardHidden;
export const START_CARD_FORCE_KEY = STORAGE_KEYS.startCardForce;

export type StartAction = 'ertms' | 'template' | 'open' | 'railml' | 'script' | 'shortcuts';

export interface StartCardOptions {
  /** The canvas the card is centred on (#graph-container). */
  container: HTMLElement;
  /** The active tab's graph and id (null: no tab). */
  getActive: () => { id: string; graph: Graph } | null;
  /** Runs an action (the card is dismissed first). */
  onAction: (action: StartAction) => void;
}

export interface StartCard {
  readonly element: HTMLElement;
  /** Re-checks whether the card applies to the active tab (after a tab switch / new tab). */
  update(): void;
  dismiss(): void;
  destroy(): void;
}

function readHidden(): boolean {
  try {
    if (readItem(START_CARD_HIDDEN_KEY) === '1') return true;
    return typeof navigator !== 'undefined' && navigator.webdriver === true && readItem(START_CARD_FORCE_KEY) !== '1';
  } catch {
    return false;
  }
}

function writeHidden(): void {
  try {
    writeItem(START_CARD_HIDDEN_KEY, '1');
  } catch {
    // storage blocked: hidden for this session only
  }
}

/** True when no layer of the graph has any cell. */
export function isDiagramEmpty(graph: Graph): boolean {
  const root = graph.getDataModel().getRoot();
  return (root?.children ?? []).every((layer) => (layer.children ?? []).length === 0);
}

const ACTIONS: Array<{ action: StartAction; label: string; hint: string; primary?: boolean }> = [
  { action: 'ertms', label: 'Insert ERTMS symbols', hint: 'Signals, balises, points, tracks', primary: true },
  { action: 'template', label: 'Open template…', hint: 'Start from an ERTMS scenario' },
  { action: 'open', label: 'Open file…', hint: '.drawio, .xml' },
  { action: 'railml', label: 'Import railML…', hint: 'railML 3.2' },
  { action: 'script', label: 'Railway Script…', hint: 'Describe the layout as text' },
];

export function createStartCard(options: StartCardOptions): StartCard {
  const { container } = options;
  let hiddenForGood = readHidden();
  /** Tabs the user closed the card on (it comes back for other new empty tabs). */
  const dismissedTabs = new Set<string>();
  let dragging = false;
  let watched: { graph: Graph; dispose: () => void } | null = null;

  const card = document.createElement('section');
  card.className = 'rd-start-card';
  card.hidden = true;
  /** The non-modal panel (core/modal.ts openFloatingPanel) while the card is shown: role, Esc, focus return. */
  let floating: FloatingPanelHandle | null = null;

  const head = document.createElement('div');
  head.className = 'rd-start-head';
  const title = document.createElement('h2');
  title.id = 'rd-start-card-title';
  title.textContent = 'Start a railway diagram';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'rd-start-close';
  close.textContent = '×';
  close.title = 'Close (Esc)';
  close.setAttribute('aria-label', 'Close start card');
  head.append(title, close);

  const list = document.createElement('div');
  list.className = 'rd-start-actions';
  for (const a of ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `rd-start-action${a.primary ? ' rd-start-primary' : ''}`;
    btn.dataset.startAction = a.action;
    const label = document.createElement('span');
    label.className = 'rd-start-label';
    label.textContent = a.label;
    const hint = document.createElement('span');
    hint.className = 'rd-start-hint';
    hint.textContent = a.hint;
    btn.append(label, hint);
    btn.addEventListener('click', () => run(a.action));
    list.appendChild(btn);
  }

  const foot = document.createElement('div');
  foot.className = 'rd-start-foot';
  const f1 = document.createElement('button');
  f1.type = 'button';
  f1.className = 'rd-start-f1';
  f1.dataset.startAction = 'shortcuts';
  f1.innerHTML = 'Press <kbd class="rd-kbd">F1</kbd> for shortcuts';
  f1.addEventListener('click', () => run('shortcuts'));
  const never = document.createElement('button');
  never.type = 'button';
  never.className = 'rd-start-never';
  never.textContent = "Don't show again";
  never.addEventListener('click', () => {
    hiddenForGood = true;
    writeHidden();
    hide();
  });
  foot.append(f1, never);
  card.append(head, list, foot);
  document.body.appendChild(card);

  function run(action: StartAction): void {
    dismiss();
    options.onAction(action);
  }

  function place(): void {
    if (card.hidden) return;
    const r = container.getBoundingClientRect();
    card.style.left = `${Math.round(r.left + r.width / 2)}px`;
    card.style.top = `${Math.round(r.top + r.height / 2)}px`;
    card.style.maxWidth = `${Math.max(200, Math.round(r.width - 24))}px`;
  }

  function unwatch(): void {
    if (!watched) return;
    watched.dispose();
    watched = null;
  }

  function hide(): void {
    card.hidden = true;
    floating?.close();
    floating = null;
    unwatch();
  }

  function update(): void {
    const active = options.getActive();
    const show = !!active && !hiddenForGood && !dismissedTabs.has(active.id) && isDiagramEmpty(active.graph);
    if (!show || !active) {
      hide();
      return;
    }
    if (watched?.graph !== active.graph) {
      unwatch();
      const listener = (): void => {
        if (!isDiagramEmpty(active.graph)) {
          dismissedTabs.add(active.id);
          hide();
        }
      };
      watched = { graph: active.graph, dispose: onModelChange(active.graph, listener) };
    }
    card.hidden = false;
    floating ??= openFloatingPanel({ element: card, labelledBy: title, container: null, removeOnClose: false, onEscape: dismiss });
    card.classList.toggle('rd-start-dragging', dragging);
    place();
  }

  function dismiss(): void {
    const active = options.getActive();
    if (active) dismissedTabs.add(active.id);
    hide();
  }

  const onDragStart = (): void => {
    dragging = true;
    card.classList.add('rd-start-dragging');
  };
  const onDragEnd = (): void => {
    dragging = false;
    card.classList.remove('rd-start-dragging');
  };
  const onDragLeave = (e: DragEvent): void => {
    if (!e.relatedTarget) onDragEnd();
  };
  close.addEventListener('click', dismiss);
  document.addEventListener('dragstart', onDragStart, true);
  document.addEventListener('dragenter', onDragStart, true);
  document.addEventListener('dragend', onDragEnd, true);
  document.addEventListener('drop', onDragEnd, true);
  document.addEventListener('dragleave', onDragLeave, true);
  window.addEventListener('resize', place);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
  resizeObserver?.observe(container);
  update();

  return {
    element: card,
    update,
    dismiss,
    destroy() {
      hide();
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('dragenter', onDragStart, true);
      document.removeEventListener('dragend', onDragEnd, true);
      document.removeEventListener('drop', onDragEnd, true);
      document.removeEventListener('dragleave', onDragLeave, true);
      window.removeEventListener('resize', place);
      resizeObserver?.disconnect();
      card.remove();
    },
  };
}
