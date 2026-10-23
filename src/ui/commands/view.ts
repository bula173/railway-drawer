/**
 * @file view.ts
 * @brief View / Extras menu and toolbar commands: zoom (Ctrl/Cmd + / - / 0 / 1), Grid, side panels
 *        (Ctrl/Cmd+Shift+K / P), Dark Mode, Connection Arrows (Alt+Shift+A), ERTMS tab, PlantUML
 *        editor, shape designer, fullscreen, the quick-insert toolbar buttons, format painter, pan
 *        mode (Space held), and Escape closing the menus.
 */
import { emit } from '../../core/event-bus';
import { toggleDarkMode, isDarkMode } from '../../drawio-shapes/theme/dark-mode';
import { setGridShown } from '../grid-toggle';
import { isPanelShown, togglePanel } from '../side-panels';
import { isConnectionArrowsEnabled, toggleConnectionArrows } from '../hover-arrows';
import { appContext } from '../app-context';
import { closeAllMenus } from '../menu';
import { globalNotificationManager } from '../notification';
import { logger } from '../../drawio/logger';
import { isMod, keyOf } from './keymap';
import type { Command, KeyBinding } from './types';

/** Zoom keys: Ctrl/Cmd + key, not typed into an `<input>` / `<textarea>` (ZoomController's rule). */
const zoomKey = (...keys: string[]): KeyBinding[] => [
  { phase: 'bubble', guard: 'text', match: (e) => isMod(e) && keys.includes(e.key) },
];

/** Ctrl/Cmd+Shift+K / P (draw.io's side panel keys). */
const panelKey = (key: string): KeyBinding[] => [
  { phase: 'capture', guard: 'graph', match: (e) => isMod(e) && e.shiftKey && !e.altKey && keyOf(e) === key },
];

export const viewCommands: readonly Command[] = [
  {
    id: 'zoomIn',
    label: 'Zoom In',
    shortcut: { mod: true, key: '+' },
    keys: zoomKey('+', '='),
    help: [{ section: 'View', order: 10, description: 'Zoom in' }],
    // around the view centre (canvas-scroll.ts); the status bar follows the SCALE events
    run: (ctx) => ctx.tab?.graph.zoomIn(),
  },
  {
    id: 'zoomOut',
    label: 'Zoom Out',
    shortcut: { mod: true, key: '-' },
    keys: zoomKey('-'),
    help: [{ section: 'View', order: 20, description: 'Zoom out' }],
    run: (ctx) => ctx.tab?.graph.zoomOut(),
  },
  {
    id: 'zoomActual',
    label: 'Reset Zoom',
    shortcut: { mod: true, key: '0' },
    keys: zoomKey('0'),
    help: [{ section: 'View', order: 30, description: 'Reset zoom (100%)' }],
    run: (ctx) => ctx.tab?.graph.zoomActual(),
  },
  {
    id: 'fitWindow',
    label: 'Fit',
    shortcut: { mod: true, key: '1' },
    keys: zoomKey('1'),
    help: [{ section: 'View', order: 40, description: 'Fit to window' }],
    // View > Fit keeps a 10 px border, Ctrl/Cmd+1 20 px (as before)
    run: (ctx) => ctx.tab?.graph.fit(ctx.source === 'keyboard' ? 20 : 10),
  },
  {
    id: 'showGrid',
    label: 'Grid',
    // = the toolbar grid button and Properties > Canvas > Grid: grid shown + snapping
    isChecked: (ctx) => ctx.tab?.graph.gridEnabled ?? false,
    run: (ctx) => ctx.tab && setGridShown(ctx.tab.graph, !ctx.tab.graph.gridEnabled),
  },
  {
    id: 'toggleLeftPanel',
    label: 'Shapes Panel',
    shortcut: { mod: true, shift: true, key: 'K' },
    keys: panelKey('k'),
    help: [{ section: 'View', order: 110, description: 'Shapes panel on/off' }],
    isChecked: () => isPanelShown('left'),
    run: () => togglePanel('left'),
  },
  {
    id: 'toggleRightPanel',
    label: 'Format Panel',
    shortcut: { mod: true, shift: true, key: 'P' },
    keys: panelKey('p'),
    help: [{ section: 'View', order: 120, description: 'Format panel on/off' }],
    isChecked: () => isPanelShown('right'),
    run: () => togglePanel('right'),
  },
  {
    id: 'toggleDarkMode',
    label: 'Dark Mode',
    isChecked: () => isDarkMode(),
    run: () => void toggleDarkMode(),
  },
  {
    id: 'toggleConnectionArrows',
    label: 'Connection Arrows',
    shortcut: { alt: true, shift: true, key: 'A' },
    // e.code: Alt changes e.key on macOS
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => e.altKey && e.shiftKey && !isMod(e) && e.code === 'KeyA' }],
    help: [{ section: 'View', order: 100, description: 'Connection Arrows on/off' }],
    isChecked: () => isConnectionArrowsEnabled(),
    // draw.io View > Connection Arrows (hover-arrows.ts; persisted, all tabs)
    run: () => void toggleConnectionArrows(),
  },
  {
    id: 'toggleErtmsTab',
    label: 'ERTMS Tab',
    // Optional left-panel tab with only the ERTMS library; visibility is persisted by main-editor.ts
    isChecked: () => !(appContext()?.leftPanelTabs.isTabHidden('ertms') ?? true),
    run: () => {
      const leftPanelTabs = appContext()?.leftPanelTabs;
      if (!leftPanelTabs) return;
      if (leftPanelTabs.isTabHidden('ertms')) leftPanelTabs.showTab('ertms');
      else leftPanelTabs.closeTab('ertms');
    },
  },
  {
    id: 'plantumlEditor',
    label: 'PlantUML Editor',
    run: () => {
      logger.debug('Menu', 'PlantUML editor clicked');
      const leftPanelTabs = appContext()?.leftPanelTabs;
      if (!leftPanelTabs) {
        console.error('[Menu] leftPanelTabs not found!');
        return;
      }
      // If tab is hidden, show it; otherwise switch to it
      if (leftPanelTabs.isTabHidden('plantuml')) leftPanelTabs.showTab('plantuml');
      else leftPanelTabs.switchTab('plantuml');
    },
  },
  { id: 'designShapes', label: 'Design Custom Shapes…', run: () => emit('open-shape-designer') },
  {
    id: 'fullscreen',
    label: 'Fullscreen',
    run: () => {
      if (!document.fullscreenElement) {
        document.getElementById('app-container')?.requestFullscreen().catch((err) => {
          console.error('[UI] Fullscreen request failed:', err);
        });
      } else {
        void document.exitFullscreen();
      }
    },
  },
  // ---- toolbar Insert group: a shape at the centre of the visible canvas, selected
  { id: 'insertRectangle', label: 'Insert rectangle', run: (ctx) => ctx.tab?.interactiveUIController.insertQuickShape('rectangle', 100, 60, '#e1d5e7', '#9673a6') },
  { id: 'insertEllipse', label: 'Insert ellipse', run: (ctx) => ctx.tab?.interactiveUIController.insertQuickShape('ellipse', 80, 80, '#d4e6f1', '#3498db', 'ellipse') },
  { id: 'insertDiamond', label: 'Insert diamond', run: (ctx) => ctx.tab?.interactiveUIController.insertQuickShape('diamond', 80, 80, '#f9e79f', '#f39c12', 'diamond') },
  { id: 'insertLine', label: 'Insert line', run: (ctx) => ctx.tab?.interactiveUIController.insertQuickShape('line', 100, 10, 'none', '#2c3e50', undefined, 2) },
  {
    id: 'connectSelection',
    label: 'Connect the two selected shapes',
    run: (ctx) => {
      const graph = ctx.tab?.graph;
      if (!graph) return;
      const cells = graph.getSelectionCells();
      if (cells.length >= 2) {
        graph.insertEdge(graph.getDefaultParent(), null, '', cells[0], cells[1]);
        graph.refresh();
      } else {
        globalNotificationManager.info('Select two shapes to connect them.');
      }
    },
  },
  {
    id: 'formatPainter',
    label: 'Copy style, then paste it on the selection',
    run: (ctx) => {
      const tab = ctx.tab;
      if (!tab || tab.graph.getSelectionCells().length === 0) return;
      // If already has copied style, paste it; otherwise copy from selection
      if (tab.graphCommandService.hasCopiedStyle()) tab.graphCommandService.pasteStyle();
      else tab.graphCommandService.copyStyle();
    },
  },
  // ---- pan mode while Space is held (pan.ts); label editing (edit.ts) gets Space first
  {
    id: 'view.panStart',
    label: 'Pan Mode',
    keys: [{ phase: 'bubble', guard: 'graph', match: (e) => e.key === ' ', when: (_e, ctx) => !!ctx.tab && !ctx.tab.panController.isPanning() }],
    run: (ctx) => ctx.tab?.panController.enablePan(),
  },
  {
    id: 'view.panEnd',
    label: 'End Pan Mode',
    // not guarded: releasing Space must always leave pan mode, even if focus moved meanwhile
    keys: [{ type: 'keyup', phase: 'bubble', guard: 'none', preventDefault: false, match: (e) => e.key === ' ', when: (_e, ctx) => !!ctx.tab?.panController.isPanning() }],
    run: (ctx) => ctx.tab?.panController.disablePan(),
  },
  {
    id: 'menus.close',
    label: 'Close Menus',
    keys: [{ phase: 'bubble', guard: 'none', preventDefault: false, match: (e) => e.key === 'Escape' }],
    help: [{ section: 'Menus', order: 40, description: 'Close the menu', keys: () => 'Esc' }],
    // the menu bar's dropdowns (menu.ts) and the canvas context menu (context-menu.ts)
    run: (ctx) => {
      ctx.tab?.contextMenuController?.hide();
      closeAllMenus();
    },
  },
];
