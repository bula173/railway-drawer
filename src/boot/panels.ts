/**
 * @file panels.ts
 * @brief Boot steps of the side panels' content (main-editor.ts): left panel tabs (+ Railway Script,
 *        AI, the AppContext), the Shapes / ERTMS tabs, narrow screens, the start card, the Templates
 *        tab and the custom shapes.
 */
import { reportLoadFailure } from '../core/load-failure';
import { shapeRegistry, ShapeToolbar } from '../shapes';
import type { TabManager } from '../ui/tabs';
import { provideAppContext } from '../ui/app-context';
import { emit, on } from '../core/event-bus';
import { LeftPanelTabs } from '../ui/left-panel-tabs';
import { ensurePanelShown } from '../ui/side-panels';
import type { ShapeDesignerController } from '../ui/shape-designer';
import { CustomShapeToolbar } from '../ui/custom-shape-toolbar';
import { globalNotificationManager } from '../ui/notification';
import { globalSaveStatusIndicator } from '../ui/save-status';
import { ServiceRegistry } from '../services/service-registry';
import { parseMxLibrary } from '../drawio-shapes/engine';
import { APP_GROUPS_HIDDEN_KEY, createDrawioPaletteView, type DrawioPaletteView, ertmsPaletteSource, loadErtmsTemplates, MERGED_APP_GROUPS, migrateMergedPaletteFlags, shapesTabPalettes } from '../ui/drawio-palette';
import { createTemplatesPanel, openTemplateAsNewDiagram, saveAsTemplate, TemplateStore } from '../ui/templates';
import { prepareRailwayInsert } from '../railway/install-railway-data';
import { installRailwayScript } from '../railway-script/install-railway-script';
import { installAi } from '../ai/install-ai';
import { syncConnectionArrowsMenu } from '../ui/hover-arrows';
import { withErtmsDisplayTitles } from '../ui/ertms-display';
import { RAILWAY_LIBRARIES, railwayLibrarySources } from '../ui/railway-libraries';
import { runMenuAction } from '../ui/menu';
import { clickInsertPlacement } from '../ui/click-insert';
import { createStartCard } from '../ui/start-card';
import { installNarrowScreen } from '../ui/narrow-screen';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

/** Left panel tabs, the Railway Script tab and the AI panel; provides the AppContext. */
export function bootLeftPanel(tabManager: TabManager): LeftPanelTabs {
  /**
   * @brief Initialize left sidebar tab system
   * @details One Shapes tab (app shapes, custom shapes and the draw.io palettes), plus Layers
   * and PlantUML. Library visibility is controlled from the palette's "More shapes…" menu.
   */
  const leftPanelTabs = new LeftPanelTabs('leftpanel-container');
  leftPanelTabs.registerTabContent('shapes', 'shapes-container');
  leftPanelTabs.registerTabContent('ertms', 'ertms-panel');
  leftPanelTabs.registerTabContent('templates', 'templates-panel');
  leftPanelTabs.registerTabContent('layers', 'layers-panel');
  leftPanelTabs.registerTabContent('plantuml', 'plantuml-panel');
  leftPanelTabs.registerTabContent('railwayScript', 'railway-script-panel');
  // Railway Script: layout as YAML/JSON text, two-way with the drawing (src/railway-script; lazy chunk)
  installRailwayScript(tabManager, globalNotificationManager, leftPanelTabs, document.getElementById('railway-script-panel')!);
  // AI assistant: right panel view "AI" (src/ai; lazy chunk, docs/AI.md)
  installAi(tabManager, globalNotificationManager);

  // The shell objects for code created per tab (menu handlers): ui/app-context.ts
  provideAppContext({ tabManager, notify: globalNotificationManager, saveStatus: globalSaveStatusIndicator, leftPanelTabs });
  return leftPanelTabs;
}

/** The Shapes tab (app groups, ERTMS first, draw.io palettes) and the optional ERTMS tab. */
export function bootShapesTab(tabManager: TabManager, leftPanelTabs: LeftPanelTabs, graphContainer: HTMLElement): DrawioPaletteView {
  /**
   * @brief App shape groups at the top of the Shapes tab (none by default)
   * @details The app's "Basic" group is merged into the palette's "General" section
   * (shapes-tab-palettes.ts), so it is not shown here; any other registered group is. Hidden groups
   * are stored in localStorage and toggled from the "More shapes…" menu with the draw.io palettes.
   * Stored flags of the merged palettes/groups are moved to "General" first.
   */
  migrateMergedPaletteFlags();
  const hiddenAppGroups = new Set<string>(readStringArray(APP_GROUPS_HIDDEN_KEY));
  const separateAppGroups = (): string[] => shapeRegistry.getGroups().filter((g) => !MERGED_APP_GROUPS.includes(g));
  const shapeToolbar = new ShapeToolbar(document.getElementById('app-shapes-container')!, shapeRegistry);
  const applyAppGroupVisibility = (): void => {
    shapeToolbar.setEnabledGroups(new Set(separateAppGroups().filter((g) => !hiddenAppGroups.has(g))));
  };
  applyAppGroupVisibility();

  function readStringArray(key: string): string[] {
    try {
      const parsed: unknown = JSON.parse(readItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  /**
   * @brief Shape palettes: ERTMS first, then draw.io's (General, Misc, Advanced, Arrows, Flowchart)
   * @details ERTMS (the railway symbols, captioned tiles) is the first section and, like General,
   * expanded for new users (stored expanded/visible flags still win). "General" also holds draw.io's Basic palette and the app's Basic shapes that draw.io
   * has no equivalent for (one section, see shapes-tab-palettes.ts). Otherwise the same entries,
   * titles, sizes and styles as draw.io (jgraph/drawio v32.4.1); inserted
   * cells keep draw.io's style strings, so saved files open 1:1 in draw.io. ERTMS is the draw.io
   * library public/libraries/ertms.xml. Click inserts at the view centre, drag drops at the pointer.
   */
  const shapesPaletteView = createDrawioPaletteView({
    container: document.getElementById('drawio-palette-container')!,
    getGraph: () => tabManager.getActiveTab()?.graph ?? null,
    palettes: [
      withErtmsDisplayTitles(ertmsPaletteSource(import.meta.env.BASE_URL)),
      // ERTMS/ETCS extra, Polish signalling (PKP PLK), Track layout (src/ui/railway-libraries.ts)
      ...railwayLibrarySources(import.meta.env.BASE_URL),
      ...shapesTabPalettes(() => MERGED_APP_GROUPS.flatMap((g) => shapeRegistry.getShapesByGroup(g))),
    ],
    defaultExpanded: ['ertms', 'general'],
    // draw.io's Basic palette is part of the merged General section
    skipCataloguePalettes: ['basic'],
    captionPalettes: ['ertms', ...RAILWAY_LIBRARIES.map((lib) => lib.id)],
    dropTarget: graphContainer,
    onError: (message) => globalNotificationManager.error(message),
    prepareInsert: prepareRailwayInsert,
    clickPlacement: clickInsertPlacement,
    extraMenuItems: separateAppGroups().map((group) => ({
      id: `app-${group}`,
      title: `${group} (Railway Drawer)`,
      isChecked: () => !hiddenAppGroups.has(group),
      setChecked: (checked: boolean) => {
        if (checked) hiddenAppGroups.delete(group);
        else hiddenAppGroups.add(group);
        try {
          writeItem(APP_GROUPS_HIDDEN_KEY, JSON.stringify([...hiddenAppGroups]));
        } catch {
          // storage blocked or full: the choice still applies for this session
        }
        applyAppGroupVisibility();
      },
    })),
  });

  /**
   * @brief Optional ERTMS-only tab (View > ERTMS Tab)
   * @details Shows just the ERTMS library (public/libraries/ertms.xml), with its own expanded
   * state and without user libraries. Created on first show; drops of its entries onto the canvas
   * are handled by the Shapes tab palette view (same palette/entry ids). Shown/hidden state is
   * persisted in localStorage.
   */
  const ERTMS_TAB_KEY = STORAGE_KEYS.ertmsTab;
  let ertmsTabCreated = false;
  const ensureErtmsTabView = (): void => {
    if (ertmsTabCreated) return;
    ertmsTabCreated = true;
    createDrawioPaletteView({
      container: document.getElementById('ertms-panel')!,
      getGraph: () => tabManager.getActiveTab()?.graph ?? null,
      palettes: [],
      extraLibraries: [withErtmsDisplayTitles(ertmsPaletteSource(import.meta.env.BASE_URL))],
      defaultExpanded: ['ertms'],
      captionPalettes: ['ertms'],
      userLibraries: false,
      showMoreMenu: false,
      storageKeySuffix: '.ertmsTab',
      onError: (message) => globalNotificationManager.error(message),
      prepareInsert: prepareRailwayInsert,
      clickPlacement: clickInsertPlacement,
    });
  };
  // View > Connection Arrows check mark from the stored setting (hover-arrows.ts)
  syncConnectionArrowsMenu();
  const syncErtmsMenuItem = (visible: boolean): void => {
    document
      .querySelectorAll('[data-action="toggleErtmsTab"]')
      .forEach((item) => item.setAttribute('aria-checked', String(visible)));
  };
  leftPanelTabs.onTabVisibilityChange((tabId, visible) => {
    if (tabId !== 'ertms') return;
    if (visible) ensureErtmsTabView();
    syncErtmsMenuItem(visible);
    try {
      writeItem(ERTMS_TAB_KEY, visible ? '1' : '0');
    } catch {
      // storage blocked: the choice applies for this session only
    }
  });
  let ertmsTabWanted = false;
  try {
    ertmsTabWanted = readItem(ERTMS_TAB_KEY) === '1';
  } catch {
    ertmsTabWanted = false;
  }
  if (ertmsTabWanted) {
    ensureErtmsTabView();
    syncErtmsMenuItem(true);
  } else {
    leftPanelTabs.closeTab('ertms');
  }
  return shapesPaletteView;
}

/** Narrow screens: body.rd-narrow + banner. */
export function bootNarrowScreen(): void {
  // < 900 px: body.rd-narrow (side panels hidden, canvas keeps the width) + a dismissible banner
  installNarrowScreen();
}

/** The start card over an empty tab. */
export function bootStartCard(tabManager: TabManager, leftPanelTabs: LeftPanelTabs, graphContainer: HTMLElement, shapesPaletteView: DrawioPaletteView): void {
  /**
   * @brief Start card over the canvas of an empty tab (src/ui/start-card.ts)
   * @details Insert ERTMS symbols (Shapes tab, ERTMS section expanded and focused), Open
   * template… (Templates tab), Open file… / Import railML… (the File menu actions), Railway
   * Script… (its tab), F1 shortcuts. Rechecked on tab switches and new tabs.
   */
  const focusErtmsPalette = (): void => {
    // the palette lives in the left panel: hidden on narrow screens (body.rd-narrow) or collapsed
    ensurePanelShown('left');
    leftPanelTabs.switchTab('shapes');
    shapesPaletteView.setPaletteVisible('ertms', true);
    shapesPaletteView.setExpanded('ertms', true);
    const section = document.querySelector<HTMLElement>('#drawio-palette-container section[data-palette-id="ertms"]');
    section?.scrollIntoView({ block: 'start' });
    void shapesPaletteView.ready.then(() => section?.querySelector<HTMLElement>('.rd-dp-item')?.focus());
  };
  const startCard = createStartCard({
    container: graphContainer,
    getActive: () => {
      const tab = tabManager.getActiveTab();
      return tab ? { id: tab.id, graph: tab.graph } : null;
    },
    onAction: (action) => {
      if (action === 'ertms') focusErtmsPalette();
      else if (action === 'template') {
        ensurePanelShown('left');
        leftPanelTabs.switchTab('templates');
      }
      else if (action === 'open') runMenuAction('open');
      else if (action === 'railml') runMenuAction('importRailml');
      else if (action === 'script') {
        ensurePanelShown('left');
        leftPanelTabs.switchTab('railwayScript');
      }
      else if (action === 'shortcuts') emit('shortcuts-help-request');
    },
  });
  on('tab-changed', () => startCard.update());
}

/** The Templates tab and Save as Template… */
export function bootTemplates(tabManager: TabManager, leftPanelTabs: LeftPanelTabs, graphContainer: HTMLElement): void {
  /**
   * @brief Templates tab: built-in ERTMS templates and the user's own templates
   * @details The complex scenario diagrams of public/libraries/ertms.xml are listed as "ERTMS
   * templates" (the ERTMS palettes show only the simple elements). "Save as Template…" (File menu,
   * canvas context menu, the tab's Save… button) stores the selection or the whole diagram in
   * localStorage `railway-drawer-templates`. Tiles insert at the view centre, open as a new tab, or
   * are dragged onto the canvas.
   */
  const templateStore = new TemplateStore();
  if (templateStore.loadWarning) globalNotificationManager.warning(templateStore.loadWarning);
  const requestSaveAsTemplate = (): void => {
    const graph = tabManager.getActiveTab()?.graph;
    if (!graph) return;
    void saveAsTemplate({
      graph,
      store: templateStore,
      notify: globalNotificationManager,
      onShow: () => leftPanelTabs.switchTab('templates'),
    });
  };
  on('save-template-request', requestSaveAsTemplate);
  createTemplatesPanel({
    container: document.getElementById('templates-panel')!,
    store: templateStore,
    loadBuiltIns: () => loadErtmsTemplates(import.meta.env.BASE_URL),
    getGraph: () => tabManager.getActiveTab()?.graph ?? null,
    openAsNewDiagram: (template) => {
      openTemplateAsNewDiagram(tabManager, template);
    },
    saveAsTemplate: requestSaveAsTemplate,
    parseLibrary: parseMxLibrary,
    notify: globalNotificationManager,
    dropTarget: graphContainer,
  });
}

/** The custom shape designer (lazy chunk) and the custom shapes toolbar. */
export function bootCustomShapes(tabManager: TabManager): void {
  /**
   * @brief Initialize custom shape designer and toolbar
   * @details Allows users to create and manage custom shapes with visual editor
   * and real-time preview. Custom shapes are stored persistently and can be
   * dragged onto the canvas like built-in shapes.
   */
  const activeTabForShapes = tabManager.getActiveTab();
  if (activeTabForShapes) {
    // The designer (a large, rarely used module) is loaded on first use
    const designerGraph = activeTabForShapes.graph;
    let shapeDesigner: Promise<ShapeDesignerController> | null = null;
    const openShapeDesigner = (shapeId?: string): void => {
      shapeDesigner ??= import('../ui/shape-designer').then((m) => new m.ShapeDesignerController(designerGraph));
      shapeDesigner.then((designer) => designer.openDesigner(shapeId)).catch((error: unknown) => {
        shapeDesigner = null;
        if (!reportLoadFailure('error', 'ShapeDesigner', 'could not be loaded', error)) return;
        ServiceRegistry.getNotificationManager()?.error('The shape designer could not be loaded. Check the connection and try again.');
      });
    };
    const customShapeToolbar = new CustomShapeToolbar('custom-shapes-container');

    // Wire up event listeners for opening shape designer
    on('open-shape-designer', () => openShapeDesigner());
    on('edit-custom-shape', (detail) => {
      openShapeDesigner(detail?.shapeId);
    });

    // Refresh custom shapes when tab changes
    on('tab-changed', () => {
      customShapeToolbar.refresh();
    });

    // Services are registered in ServiceRegistry, no need for window globals
    ServiceRegistry.register('customShapeToolbar', customShapeToolbar);
  }
}
