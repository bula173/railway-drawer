/**
 * @file event-bus.ts
 * @brief The app's typed event bus: every app-level notification and request between modules
 *        that do not import each other (menus → features, tabs → features, ...).
 *
 * Replaces the former string-named `window` CustomEvents. The names are unchanged (handy when
 * debugging), but they are no longer window events: nothing outside the app listened to them,
 * and a typo in a name or a wrong `detail` is now a type error.
 *
 * Semantics are those of the former window events (an EventTarget underneath): listeners run
 * synchronously in registration order, a throwing listener is reported and the others still run.
 * Modules of upper layers may add events by module augmentation (ui/session.ts:
 * `active-session-changed`).
 *
 * Adding an event: add it to AppEventMap (name → detail type; `undefined` for no detail). A unit
 * test fails on new `new CustomEvent(` uses outside this file.
 */
import type { Graph } from '@maxgraph/core';

export interface AppEventMap {
  // ---- tabs (TabManager)
  /** The shown tab changed (also after the active tab was closed). */
  'tab-changed': { tabId: string };
  /** A tab was closed (its graph is destroyed). */
  'tab-closed': { tabId: string };
  /** A load applied a file's grid settings to `graph` (saveload.ts). */
  'rd-grid-settings': { graph: Graph };

  // ---- railway requests (menus, toolbar, context menu → railway features)
  'railway-checks-request': undefined;
  'railway-edit-data-request': undefined;
  /** Railway > ETCS Data…, context menu, Data panel: the ETCS editor of the selected balise group. */
  'railway-etcs-request': undefined;
  /** Export format of the railway data (e.g. 'xlsx'). */
  'railway-export-request': string;
  /** A RouteCommand of install-railway-routes.ts. */
  'railway-route-request': string;
  /** A state command of railway/state-menu.ts (context menu items without one send none). */
  'railway-state-request': string | undefined;
  'railway-script-request': { action: 'import' | 'export' };
  'railml-request': { action: 'export' } | { action: 'import' } | { action: 'open'; text: string; name: string };
  /** A generated railway drawing was opened into `graph` (railML import, Railway Script): ui/railway-zoom.ts zooms it. */
  'railway-zoom-request': { graph: Graph };

  // ---- app requests
  /** Scenario export; no detail = the HTML document. */
  'scenario-export-request': { format?: string } | undefined;
  'share-request': undefined;
  /** Help > Keyboard Shortcuts; `keyboard`: F1 (not over another dialog). */
  'shortcuts-help-request': { keyboard?: boolean } | undefined;
  'save-template-request': undefined;
  'open-shape-designer': undefined;
  'edit-custom-shape': { shapeId: string };
  /** Custom shapes changed elsewhere: the custom shape toolbar re-renders (nothing emits it at present). */
  'custom-shapes-updated': undefined;

  // ---- state notifications
  /** The right panel shows another view (scenarios-panel.ts installRightPanelSwitch). */
  'right-panel-view': { view: 'properties' | 'data' | 'checks' | 'scenarios' | 'ai' };
  /** The resolved theme changed (dark-mode.ts). */
  'rd-theme-change': 'light' | 'dark';
  /** The PlantUML server setting changed ('' = none). */
  'rd-plantuml-server-changed': { url: string };
}

export type AppEventName = keyof AppEventMap;

type DetailArgs<K extends AppEventName> = undefined extends AppEventMap[K]
  ? [detail?: AppEventMap[K]]
  : [detail: AppEventMap[K]];

const target = new EventTarget();

/** Sends `type` to every listener (synchronously, in registration order). */
export function emit<K extends AppEventName>(type: K, ...args: DetailArgs<K>): void {
  target.dispatchEvent(new CustomEvent(type, { detail: args[0] }));
}

type Listener<K extends AppEventName> = (detail: AppEventMap[K]) => void;

/** The EventTarget wrapper of each registered listener, per event name (for off()). */
const wrappers = new Map<string, Map<unknown, (evt: Event) => void>>();

/**
 * Listens to `type`; returns the function that removes the listener. Adding the same listener
 * twice is a no-op, like addEventListener.
 */
export function on<K extends AppEventName>(type: K, listener: Listener<K>): () => void {
  let byListener = wrappers.get(type);
  if (!byListener) wrappers.set(type, (byListener = new Map()));
  if (!byListener.has(listener)) {
    // CustomEvent turns a missing detail into null: listeners get undefined, as typed
    const wrapped = (evt: Event): void => listener(((evt as CustomEvent<AppEventMap[K]>).detail ?? undefined) as AppEventMap[K]);
    byListener.set(listener, wrapped);
    target.addEventListener(type, wrapped);
  }
  return () => off(type, listener);
}

/** Removes a listener added with on(). */
export function off<K extends AppEventName>(type: K, listener: Listener<K>): void {
  const byListener = wrappers.get(type);
  const wrapped = byListener?.get(listener);
  if (!byListener || !wrapped) return;
  byListener.delete(listener);
  target.removeEventListener(type, wrapped);
}
