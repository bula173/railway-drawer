/**
 * @file main-editor.ts
 * @brief Boot of the main Railway Drawer editor (maxGraph)
 * @details
 * Imported lazily by main.ts (sign-in answer pages never load it). Initializes the entire
 * Railway Drawer application including:
 * - Shape registration and toolbars
 * - Tab management for multiple diagrams
 * - UI components (stencils, panels, editors)
 * - Event handling (keyboard shortcuts, drag-drop)
 * - Application lifecycle management
 *
 * The application follows a modular architecture where each UI component
 * is responsible for its own initialization and event handling.
 *
 * @author Marcin Kwiatkowski
 * @version 0.6.0
 */

import '@maxgraph/core/css/common.css';
import './styles/index.css';
import { bootShell } from './boot/shell';
import { bootTabs } from './boot/tabs';
import { bootRailwayFeatures, bootSharing } from './boot/features';
import { bootKeyboard } from './boot/commands';
import { bootCanvasDrop, bootLifecycle } from './boot/canvas';
import { bootCustomShapes, bootLeftPanel, bootNarrowScreen, bootShapesTab, bootStartCard, bootTemplates } from './boot/panels';
import { logger } from './drawio/logger';

/*
 * Boot order: each step is a composition function of src/boot (no module there has top-level side
 * effects); the order is the app's, keep it:
 *  1. bootShell            codecs (before any file / cache load), stencils, page-wide patches, shapes,
 *                          commands (registered before the chrome reads their shortcuts), Help,
 *                          side panels, toolbar, menu bar
 *  2. bootTabs             theme, TabManager (+ session views, service registry), cache restore or a
 *                          first tab, project name editor, status bar version
 *  3. bootRailwayFeatures  scenarios, railway data / routes / states, railML (they follow the tabs)
 *  4. bootKeyboard         the one keyboard dispatcher on the active tab (scenario view keys first)
 *  5. bootLifecycle        tab cache flush on beforeunload, teardown on pagehide
 *  6. bootCanvasDrop       railML / shape drops on the canvas
 *  7. bootLeftPanel        left panel tabs, Railway Script, AI, the AppContext
 *  8. bootShapesTab        Shapes tab palettes, the optional ERTMS tab
 *  9. bootNarrowScreen, bootStartCard, bootTemplates
 * 10. bootSharing          Share dialog, links, providers, Access identity
 * 11. bootCustomShapes     shape designer (lazy chunk) and the custom shapes toolbar
 */
const graphContainer = document.getElementById('graph-container')!;

bootShell();
const tabManager = bootTabs();
const scenarios = bootRailwayFeatures(tabManager, graphContainer);
bootKeyboard(tabManager, scenarios);
bootLifecycle(tabManager);
bootCanvasDrop(tabManager, graphContainer);
const leftPanelTabs = bootLeftPanel(tabManager);
const shapesPaletteView = bootShapesTab(tabManager, leftPanelTabs, graphContainer);
bootNarrowScreen();
bootStartCard(tabManager, leftPanelTabs, graphContainer, shapesPaletteView);
bootTemplates(tabManager, leftPanelTabs, graphContainer);
bootSharing(tabManager);
bootCustomShapes(tabManager);

/**
 * @brief Application initialization complete
 * @details All major components have been initialized and are ready for user interaction.
 * The application is now fully functional.
 */
logger.debug('main-editor', '✓ Railway Drawer with tabs, stencils, and custom shapes initialized');
