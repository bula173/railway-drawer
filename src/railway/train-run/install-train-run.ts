/**
 * @file install-train-run.ts
 * @brief Wires the train run into the editor (called from boot/features.ts): Railway > Train Run…
 *        (`data-action="railwayRoute:trainRun"` -> bus event `railway-route-request` "trainRun")
 *        opens the run view (run-view.ts, a lazy chunk) on the active tab with the selected
 *        route(s) and train; the view closes on a tab switch / close; while it is open the keymap's
 *        interceptor (`handleKeydown`) gives it Esc / Space / ← / → and blocks editing keys.
 */
import type { Graph } from '@maxgraph/core';
import { off, on } from '../../core/event-bus';
import { getCellKind, readObjectId } from '../object-data';
import type { RailwayNotifier } from '../install-railway-data';
import type { TabManager, TabData } from '../../ui/tabs';
import type { TrainRunView, TrainRunViewOptions } from './run-view';

export const TRAIN_RUN_COMMAND = 'trainRun';

export interface TrainRunHandle {
  /** Opens the view on the active tab (routes / train from the selection unless given). */
  open(opts?: { routes?: string[]; trainCellId?: string | null }): Promise<TrainRunView | null>;
  /** The view once it was opened (tests / e2e). */
  getView(): TrainRunView | null;
  isOpen(): boolean;
  close(): void;
  handleKeydown(e: KeyboardEvent): boolean;
  destroy(): void;
}

export interface InstallTrainRunOptions {
  createViewGraph(host: HTMLElement): Graph;
  createScenario?: TrainRunViewOptions['createScenario'];
  /** Called before the view opens (closes the scenario view: both use the canvas). */
  beforeOpen?(): void;
}

export function installTrainRun(tabManager: TabManager, notify: RailwayNotifier, graphContainer: HTMLElement, options: InstallTrainRunOptions): TrainRunHandle {
  let view: TrainRunView | null = null;
  let loading: Promise<TrainRunView> | null = null;

  const load = (): Promise<TrainRunView> => {
    loading ??= import('./run-view').then(({ TrainRunView }) => {
      view = new TrainRunView({
        graphContainer,
        createViewGraph: options.createViewGraph,
        createScenario: options.createScenario ?? null,
        notify: (kind, message) => notify[kind](message),
      });
      return view;
    });
    return loading;
  };

  const fromSelection = (tab: TabData): { routes: string[]; trainCellId: string | null } => {
    const cells = tab.graph.getSelectionCells();
    const routes = cells.filter((c) => getCellKind(c) === 'route').map((c) => readObjectId(c)).filter(Boolean);
    const train = cells.find((c) => getCellKind(c) === 'train');
    return { routes, trainCellId: train ? String(train.getId()) : null };
  };

  const open: TrainRunHandle['open'] = async (opts = {}) => {
    const tab = tabManager.getActiveTab();
    if (!tab) return null;
    options.beforeOpen?.();
    const v = await load();
    const picked = fromSelection(tab);
    v.open(
      { id: tab.id, graph: tab.graph, serializeToXml: () => tab.document.serializeToXml() },
      { routes: opts.routes ?? picked.routes, trainCellId: opts.trainCellId !== undefined ? opts.trainCellId : picked.trainCellId }
    );
    return v;
  };

  const onRequest = (detail: string): void => {
    if (detail !== TRAIN_RUN_COMMAND) return;
    void open().catch((error: unknown) => notify.error(`Could not open the train run: ${error instanceof Error ? error.message : String(error)}`));
  };
  const onTab = (): void => {
    if (view?.isOpen() && view.getTabId() !== tabManager.getActiveTab()?.id) view.close();
  };
  const onTabClosed = (): void => {
    if (view?.isOpen() && !tabManager.getAllTabs().some((t) => t.id === view!.getTabId())) view.close();
  };
  on('railway-route-request', onRequest);
  on('tab-changed', onTab);
  on('tab-closed', onTabClosed);

  return {
    open,
    getView: () => view,
    isOpen: () => view?.isOpen() ?? false,
    close: () => view?.close(),
    handleKeydown: (e) => view?.handleKeydown(e) ?? false,
    destroy() {
      off('railway-route-request', onRequest);
      off('tab-changed', onTab);
      off('tab-closed', onTabClosed);
      view?.destroy();
      view = null;
      loading = null;
    },
  };
}
