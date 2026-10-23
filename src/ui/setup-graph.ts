/**
 * @file setup-graph.ts
 * @brief The ONE place where maxGraph graphs get their draw.io / Railway Drawer behaviour.
 *
 * Every graph the app creates goes through `setupGraph(graph, profile)`:
 * - 'editor'    — a tab graph (TabManager.createTab);
 * - 'view'      — the read-only scenario view graph (scenario-view.ts);
 * - 'thumbnail' — the off-screen palette thumbnail renderer (thumbnail-renderer.ts).
 *
 * Most installers wrap graph methods (`const base = graph.x.bind(graph); graph.x = ...`), so
 * their ORDER is the composition: a later installer wraps (and sees the result of) an earlier one.
 * The order below is the order the app always had; the unit test `setup-graph.test.ts` pins the
 * parts that matter:
 *
 * Label chain (innermost → outermost getLabel / convertValueToString):
 *   1. user-object-labels   drawio-xml: UserObject values (convertValueToString, cellLabelChanged)
 *   2. drawio-compat        → placeholders (%name% … getLabel/convertValueToString wrapper)
 *                           → light-dark() / adaptive colours (getLabel wrapper), postProcessCellStyle
 *   3. html-labels          isHtmlLabel (html=1) + SANITIZING getLabel — the OUTERMOST wrapper, so
 *                           nothing can put unsanitized HTML back into a label. Nothing installed
 *                           after it wraps getLabel (the test asserts it is still outermost).
 *
 * Double wraps (both installers wrap the same method; the later one is outer):
 *   - isCellResizable:    drawio-behaviour/containers (inner) → tables (outer)
 *   - isValidDropTarget:  drawio-behaviour/containers (inner) → railway-split-rules (outer)
 *   - createVertexHandler: drawio-handles (inner) → press-to-move (outer: sizers of small shapes)
 *   - createEdgeHandler:  drawio-handles (inner) → drawio-edge-ends (outer: point image, outline)
 *
 * Cell-lock predicates (cell-lock): isCellLocked, isCellDeletable, isCellRotatable, isValidSource
 * and isCellSelectable wrap whatever is installed before them (draw.io behaviour, tables); every
 * maxGraph "movable/resizable/editable/…" check asks isCellLocked, so locks win over them.
 *
 * Plugin (handler) patches: panning (PanningHandler), drawio-connection-start / drawio-edge-ends /
 * hover-arrow-connection-hooks (ConnectionHandler). Controllers keep their per-tab state only
 * (PanController: Space pan mode; HoverArrowsController: the arrow drag).
 *
 * Page-wide patches are not per graph: `installGlobalGraphPatches()` runs once at boot
 * (main-editor.ts) and is ensured by every 'editor' setup (graphs made without the boot, tests):
 *   - symbol-group-connect: Cell.prototype.isConnectable (maxGraph asks cells directly; on the
 *     read-only graphs it changes nothing visible).
 * The Shape/CellRenderer prototype patches of the stencil engine (sketch, bounding box, dark
 * feedback colours) are installed by installStencilEngine at boot.
 *
 * Lazy per-graph features of the railway tools (snap to track, reverse points fade) are installed
 * on the open tab graphs when those tools are installed and kept in sync on tab-changed/tab-closed
 * through `createGraphFeature` (core/graph-feature.ts: one reconciler, uninstalled for closed tabs).
 *
 * Idempotency: one helper (core/install-once.ts). setupGraph itself runs once per graph and
 * profile; the installers it calls are idempotent on their own as well.
 */
import { CellEditorHandler, RubberBandHandler, type Graph } from '@maxgraph/core';
import {
  wideArrowPerimeter,
  thinArrowPerimeter,
  doubleArrowPerimeter,
  splitArrowPerimeter,
  chevronArrowPerimeter,
  loopArrowPerimeter,
} from '../shapes/arrows/perimeter';
import { applyDrawioDefaultStyles, installUserObjectLabels, registerDrawioNamedStyles } from '../services/drawio-xml';
import {
  installDanglingEdgeStyles,
  installDrawioCompat,
  installDrawioHtmlLabels,
  installInheritStyleValues,
} from '../drawio-shapes/engine';
import { installTableSupport } from '../drawio-shapes/js/shapes-edges';
import { installDrawioBehaviour } from '../drawio-shapes/behaviour';
import { installDrawioHandles } from '../drawio-shapes/handles';
import { installOnce, isInstalled } from '../core/install-once';
import { installCellLocking } from './cell-lock';
import { disableSelectOnPopup, installGroupBackgroundHit, installPressToMove, installRailwaySplitRules } from './canvas-interaction';
import { installStencilAutoload } from './drawio-stencil-autoload';
import { installCanvasScroll, uninstallCanvasScroll } from './canvas-scroll';
import { installMultiSelectionBox } from './multi-selection-box';
import { installLayerDefaultParent } from './layers';
import {
  installConnectionConstraints,
  installDrawioConnectionStart,
  installDrawioEdgeEnds,
  installSymbolGroupConnect,
} from './connections';
import { installPanning } from './pan';
import { installHoverArrowConnectionHooks } from './hover-arrows';

export type GraphProfile = 'editor' | 'view' | 'thumbnail';

/** One named step of the graph setup. `install` may return its uninstaller. */
export interface GraphInstaller {
  readonly name: string;
  readonly profiles: readonly GraphProfile[];
  readonly install: (graph: Graph) => void | (() => void);
}

const ALL: readonly GraphProfile[] = ['editor', 'view', 'thumbnail'];
const EDITOR: readonly GraphProfile[] = ['editor'];
const READ_ONLY: readonly GraphProfile[] = ['view', 'thumbnail'];

/** Page-wide (prototype) patches; once per page. See the file comment. */
export function installGlobalGraphPatches(): void {
  installSymbolGroupConnect();
}

/** The ordered installer list (see the file comment for why the order matters). */
export const GRAPH_INSTALLERS: readonly GraphInstaller[] = [
  // ---- graph defaults
  {
    name: 'editor-defaults',
    profiles: EDITOR,
    install: (graph) => {
      graph.cellsMovable = true;
      graph.cellsResizable = true;
      graph.cellsEditable = true;
      graph.cellsSelectable = true;
      graph.setConnectable(true);
      graph.dropEnabled = true;
      graph.setMultigraph(false);
      // Rubber band selection - drag to select multiple objects
      new RubberBandHandler(graph);
      // Text editing on double-click; stored on the graph for TextEditorController
      (graph as Graph & { cellEditorHandler?: CellEditorHandler }).cellEditorHandler = new CellEditorHandler(graph);
      // Native scrollbars (the graph div is the scroll container, canvas-scroll.ts)
      graph.ignoreScrollbars = false;
      graph.translateToScrollPosition = false;
    },
  },
  {
    name: 'read-only-defaults',
    profiles: READ_ONLY,
    install: (graph) => {
      graph.setEnabled(false);
      graph.setTooltips(false);
      graph.gridEnabled = false;
      // no folding icons on a picture (maxGraph shows them on every group); own copy, the options object is shared
      graph.options = { ...graph.options, foldingEnabled: false };
    },
  },
  // ---- rendering (every profile): styles and draw.io rendering compatibility
  {
    name: 'arrow-perimeters',
    profiles: ALL,
    install: (graph) => {
      // SVG arrow perimeter styles, for edge routing calculations
      const stylesheet = graph.getStylesheet();
      stylesheet.putCellStyle('wideArrow', { shape: 'image', perimeter: wideArrowPerimeter });
      stylesheet.putCellStyle('thinArrow', { shape: 'image', perimeter: thinArrowPerimeter });
      stylesheet.putCellStyle('doubleArrow', { shape: 'image', perimeter: doubleArrowPerimeter });
      stylesheet.putCellStyle('splitArrow', { shape: 'image', perimeter: splitArrowPerimeter });
      stylesheet.putCellStyle('chevronArrow', { shape: 'image', perimeter: chevronArrowPerimeter });
      stylesheet.putCellStyle('loopArrow', { shape: 'image', perimeter: loopArrowPerimeter });
    },
  },
  // draw.io's default colours, fonts and arrows (styles/default.xml), so draw.io shapes and files
  // look as in draw.io; the export only writes values draw.io would resolve differently
  { name: 'drawio-default-styles', profiles: ALL, install: (graph) => applyDrawioDefaultStyles(graph.getStylesheet()) },
  // Base style names used in draw.io files (text, ellipse, swimlane, ...)
  { name: 'drawio-named-styles', profiles: ALL, install: (graph) => registerDrawioNamedStyles(graph.getStylesheet()) },
  // Label chain 1: labels of draw.io UserObject cells (values that are XML elements)
  { name: 'user-object-labels', profiles: ALL, install: installUserObjectLabels },
  // Label chain 2: placeholders, light-dark()/default colours (after user-object-labels)
  { name: 'drawio-compat', profiles: ALL, install: installDrawioCompat },
  // edge styles (elbow, orthogonal, isometric) also for edges without a source, as in draw.io
  { name: 'dangling-edge-styles', profiles: ALL, install: installDanglingEdgeStyles },
  // strokeColor=inherit (tables, lists) takes the parent's value
  { name: 'inherit-style-values', profiles: ALL, install: installInheritStyleValues },
  // draw.io tables, lists, stack layouts, collapsed tables
  { name: 'table-support', profiles: ALL, install: installTableSupport },
  // Label chain 3 (OUTERMOST): html=1 labels render as sanitized HTML, as in draw.io
  { name: 'html-labels', profiles: ALL, install: installDrawioHtmlLabels },
  // ---- editing (tab graphs)
  // draw.io layouts, containers (drop targets, folding), tables (handles, table-aware edits)
  { name: 'drawio-behaviour', profiles: EDITOR, install: installDrawioBehaviour },
  // draw.io lock: locked=1 on cells and layers
  { name: 'cell-lock', profiles: EDITOR, install: installCellLocking },
  // A press in a gap of a transparent group (ERTMS symbols) moves the group
  { name: 'group-background-hit', profiles: EDITOR, install: installGroupBackgroundHit },
  {
    name: 'canvas-focus',
    profiles: EDITOR,
    install: (graph) => {
      // maxGraph cancels the default of presses on the canvas, so a text field elsewhere (Railway
      // Script, Data panel) kept the focus and swallowed canvas shortcuts; a press on the canvas
      // moves the focus off it, like draw.io
      const graphDiv = graph.container;
      graphDiv.addEventListener('pointerdown', () => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body && !graphDiv.contains(active)) active.blur();
      }, true);
    },
  },
  // No edge split when a railway symbol is dropped on a track (or with Alt/Shift, like draw.io)
  { name: 'railway-split-rules', profiles: EDITOR, install: installRailwaySplitRules },
  // draw.io shape handles (createVertexHandler/createEdgeHandler, inner)
  { name: 'drawio-handles', profiles: EDITOR, install: installDrawioHandles },
  // Named stencils (mxgraph.basic.*, ...) are fetched when cells using them arrive (load, paste, insert)
  { name: 'stencil-autoload', profiles: ['editor', 'view'], install: installStencilAutoload },
  // draw.io scrolling canvas: padding around the content, zoom around the focus
  { name: 'canvas-scroll', profiles: EDITOR, install: (graph) => {
    installCanvasScroll(graph);
    return () => uninstallCanvasScroll(graph);
  } },
  // a large selection (an inserted template) gets one bounding box instead of per-cell handles (draw.io)
  { name: 'multi-selection-box', profiles: EDITOR, install: (graph) => installMultiSelectionBox(graph) },
  // ---- connections (formerly the tab's ConnectionHandler constructor, same order)
  { name: 'symbol-group-connect', profiles: EDITOR, install: () => installGlobalGraphPatches() },
  { name: 'connection-constraints', profiles: EDITOR, install: installConnectionConstraints },
  { name: 'drawio-connection-start', profiles: EDITOR, install: installDrawioConnectionStart },
  { name: 'drawio-edge-ends', profiles: EDITOR, install: installDrawioEdgeEnds },
  // after drawio-handles: wraps its createVertexHandler (sizers of small shapes)
  { name: 'press-to-move', profiles: EDITOR, install: installPressToMove },
  // ---- plugin patches (formerly in the PanController / HoverArrowsController constructors)
  { name: 'panning', profiles: EDITOR, install: installPanning },
  { name: 'hover-arrow-connection-hooks', profiles: EDITOR, install: installHoverArrowConnectionHooks },
  // ---- per-graph state kept while the tab is in the background (formerly in its panel controllers)
  { name: 'layer-default-parent', profiles: EDITOR, install: installLayerDefaultParent },
  // the context menu decides what a right-click selects (context-menu.ts)
  { name: 'popup-selection-off', profiles: EDITOR, install: disableSelectOnPopup },
];

/** The installer names of a profile, in order (tests, diagnostics). */
export function graphInstallerNames(profile: GraphProfile): string[] {
  return GRAPH_INSTALLERS.filter((i) => i.profiles.includes(profile)).map((i) => i.name);
}

const TEARDOWNS = new WeakMap<Graph, Array<() => void>>();

/**
 * Gives `graph` the behaviour of `profile` (see the file comment). Runs once per graph and
 * profile; a second call is a no-op.
 */
export function setupGraph(graph: Graph, profile: GraphProfile): void {
  if (!installOnce(graph, `setup:${profile}`)) return;
  const teardowns = TEARDOWNS.get(graph) ?? [];
  TEARDOWNS.set(graph, teardowns);
  for (const installer of GRAPH_INSTALLERS) {
    if (!installer.profiles.includes(profile)) continue;
    const off = installer.install(graph);
    if (typeof off === 'function') teardowns.push(off);
  }
}

/** The profile `graph` was set up with, or null (tests). */
export function graphProfileOf(graph: Graph): GraphProfile | null {
  return (['editor', 'view', 'thumbnail'] as const).find((p) => isInstalled(graph, `setup:${p}`)) ?? null;
}

/** Undoes what the setup installers registered outside the graph's own lifetime (before graph.destroy()). */
export function teardownGraph(graph: Graph): void {
  const teardowns = TEARDOWNS.get(graph);
  if (!teardowns) return;
  TEARDOWNS.delete(graph);
  for (const off of teardowns.reverse()) {
    try {
      off();
    } catch (e) {
      console.warn('[setupGraph] teardown failed:', e);
    }
  }
}
