/**
 * @file install-scenarios.ts
 * @brief Wires scenarios into the main editor (called once from main-editor.ts): the right
 *        panel's "Properties | Scenarios" switch, the Scenarios panel for the active tab, the
 *        read-only scenario view on the canvas (with the UML & text side panel), the keyboard while
 *        that view is open, and File > Export Scenario (HTML/PDF/Slides)… (`scenario-export-request`,
 *        `detail.format` 'html' | 'pdf' | 'slides'). PDF and slides modules are loaded on demand.
 */
import type { TabData, TabManager } from '../ui/tabs';
import { getDrawioThumbnailRenderer } from '../ui/drawio-palette/drawio-palette-view';
import { confirmTemplateDialog } from '../ui/templates/template-dialogs';
import { captureDrawing, replaceDrawingWithSnapshot } from './scenario-actions';
import { scenarioKeyAction } from './scenario-keys';
import { ScenarioViewer } from './scenario-view';
import type { RightPanelView, ScenarioNotifier, ScenariosPanel, ScenarioThumbnails } from './scenarios-panel';
import { createScenariosPanel, installRightPanelSwitch } from './scenarios-panel';
import { buildScenarioHtml, scenarioExportFileName } from './scenario-export';
import { renderXmlToSvgDocument } from '../ui/diagram-image-export';
import type { ScenarioExportDeps } from './scenario-export';
import type { ScenarioData } from './scenario-model';
import type { StepEditorOptions, StepEditorResult } from './step-editor';
import type { UmlRenderResult } from './step-uml';
import { openScenarioDocDialog } from './scenario-doc-export';
import type { ScenarioDocChoice, ScenarioDocDialogOptions, ScenarioDocFormat } from './scenario-doc-export';
import type { PdfImage, ScenarioPdfDeps } from './scenario-pdf';

/** `window` event of File > Export Scenario (HTML)… (MenuController). */
export const SCENARIO_EXPORT_EVENT = 'scenario-export-request';

export interface ScenariosHandle {
  viewer: ScenarioViewer;
  panel: ScenariosPanel;
  /**
   * For the global keydown dispatcher: while a step is shown, handles the key (navigation, Escape,
   * blocked editing shortcuts) and returns true, so no graph shortcut reaches the hidden drawing.
   */
  handleKeydown(e: KeyboardEvent): boolean;
  /** Shows a view of the right panel (Properties, Data, Checks, Scenarios). */
  showPanel(view: RightPanelView): void;
  /**
   * Exports a scenario of the active tab as HTML (download). Without an id: the scenario being
   * presented, the only one, or the one the user picks. Resolves the file name (null: nothing exported).
   */
  exportScenario(scenarioId?: string): Promise<string | null>;
  /**
   * Exports a scenario as PDF or HTML slideshow after the options dialog (which also picks the
   * scenario when there is a choice). Resolves the file name (null: nothing exported).
   */
  exportScenarioDoc(format: ScenarioDocFormat, scenarioId?: string): Promise<string | null>;
  /**
   * Exports scenario `scenarioId` of tab `tabId` without a dialog (AI tool export_scenario) and
   * saves the file; resolves the file name, rejects on errors.
   */
  exportScenarioFile(
    tabId: string,
    scenarioId: string,
    format: ScenarioDocFormat | 'html',
    options?: { orientation?: 'portrait' | 'landscape'; showChanges?: boolean }
  ): Promise<string>;
  /** Removes the view, the panel and the window listeners (tests). */
  destroy(): void;
}

export interface InstallScenariosOptions {
  /** Step thumbnails (default: the palette's shared renderer); null: none (tests). */
  thumbnails?: ScenarioThumbnails | null;
  /** Step editor (tests); default: the modal step editor. */
  stepEditor?: (opts: StepEditorOptions) => Promise<StepEditorResult | null>;
  /** UML renderer of the view and the export (tests); default: local renderer / configured server. */
  renderUml?: (source: string) => Promise<UmlRenderResult>;
  /** Drawing renderer of the HTML export (tests); default: the draw.io-like SVG image export. */
  renderDrawingSvg?: ScenarioExportDeps['renderDrawingSvg'];
  /** Receives the exported file (tests); default: download. */
  saveFile?: (blob: Blob, fileName: string) => void;
  /** Options dialog of the PDF/slides export (tests); default: openScenarioDocDialog. */
  docDialog?: (opts: ScenarioDocDialogOptions) => Promise<ScenarioDocChoice | null>;
  /** Drawing rasterizer of the PDF export (tests); default: SVG image export at 2x. */
  renderDrawingPng?: (xml: string) => Promise<PdfImage>;
  /** Further PDF dependencies (tests: fonts, svg2pdf). */
  pdfDeps?: Partial<ScenarioPdfDeps>;
}

function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Small modal: pick one of the scenarios (template dialog look). Resolves null when cancelled. */
function chooseScenario(scenarios: ScenarioData[]): Promise<ScenarioData | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'rd-tpl-modal-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'rd-tpl-modal rd-scn-choose';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Export scenario');
    const title = document.createElement('h2');
    title.className = 'rd-tpl-modal-title';
    title.textContent = 'Export which scenario?';
    dialog.appendChild(title);
    const list = document.createElement('div');
    list.className = 'rd-scn-choose-list';
    const finish = (value: ScenarioData | null): void => {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(value);
    };
    for (const scenario of scenarios) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rd-tpl-btn rd-scn-choose-item';
      btn.textContent = `${scenario.name} (${scenario.steps.length} step${scenario.steps.length === 1 ? '' : 's'})`;
      btn.disabled = scenario.steps.length === 0;
      btn.addEventListener('click', () => finish(scenario));
      list.appendChild(btn);
    }
    const actions = document.createElement('div');
    actions.className = 'rd-tpl-modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'rd-tpl-btn';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => finish(null));
    actions.appendChild(cancel);
    dialog.append(list, actions);
    overlay.appendChild(dialog);
    const onKey = (evt: KeyboardEvent): void => {
      evt.stopPropagation();
      if (evt.key === 'Escape') {
        evt.preventDefault();
        finish(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (evt) => {
      if (evt.target === overlay) finish(null);
    });
    document.body.appendChild(overlay);
    (list.querySelector('button:not(:disabled)') as HTMLButtonElement | null)?.focus();
  });
}

export function installScenarios(
  tabManager: TabManager,
  notify: ScenarioNotifier,
  graphContainer: HTMLElement,
  installOptions: InstallScenariosOptions = {}
): ScenariosHandle {
  const tabById = (id: string): TabData | null => tabManager.getAllTabs().find((t) => t.id === id) ?? null;

  const viewer = new ScenarioViewer({
    graphContainer,
    renderUml: installOptions.renderUml,
    getActiveTabId: () => tabManager.getActiveTab()?.id ?? null,
    getScenarios: (id) => tabById(id)?.saveLoadController.getScenarios() ?? null,
    getLiveGraph: (id) => tabById(id)?.graph ?? null,
    onStateChange: (state) => panel.setViewState(state),
    onReplaceDrawing: (state, step) => {
      void (async () => {
        const scenario = tabById(state.tabId)?.saveLoadController.getScenarios().get(state.scenarioId);
        const ok = await confirmTemplateDialog(
          `Replace the drawing with step ${state.index + 1} "${step.name}"${scenario ? ` of "${scenario.name}"` : ''}? ` +
            'You can undo this with Ctrl+Z.',
          'Replace drawing'
        );
        const tab = tabById(state.tabId);
        if (!ok || !tab) return;
        viewer.close();
        try {
          replaceDrawingWithSnapshot(tab.graph, step.xml);
          notify.success(`Drawing replaced with step ${state.index + 1} "${step.name}" (Ctrl+Z undoes it)`);
        } catch (error) {
          notify.error(`Could not replace the drawing: ${error instanceof Error ? error.message : String(error)}`);
        }
      })();
    },
  });

  const panel: ScenariosPanel = createScenariosPanel({
    container: document.getElementById('scenarios-panel')!,
    getActiveTab: () => {
      const tab = tabManager.getActiveTab();
      if (!tab) return null;
      return {
        id: tab.id,
        name: tab.name,
        scenarios: tab.saveLoadController.getScenarios(),
        captureDrawing: () => captureDrawing(tab.saveLoadController),
      };
    },
    viewer,
    notify,
    thumbnails: installOptions.thumbnails === undefined ? getDrawioThumbnailRenderer() : installOptions.thumbnails,
    stepEditor: installOptions.stepEditor,
    onExportScenario: (_tabId, scenarioId) => {
      void exportScenario(scenarioId);
    },
    onExportScenarioDoc: (_tabId, scenarioId, format) => {
      void exportScenarioDoc(format, scenarioId);
    },
    onStepsChanged: () => {
      // Steps hold whole drawings: write the cache now so a full storage is reported right away
      if (!tabManager.flushCache()) {
        notify.warning(
          'The step is kept for this session, but browser storage is full: save the diagram to a file (Ctrl+S) to keep it.'
        );
      }
    },
  });

  const exportScenario = async (scenarioId?: string): Promise<string | null> => {
    const tab = tabManager.getActiveTab();
    if (!tab) return null;
    const set = tab.saveLoadController.getScenarios();
    let scenario: ScenarioData | null = null;
    const viewing = viewer.getState();
    if (scenarioId) scenario = set.get(scenarioId);
    else if (viewing && viewing.tabId === tab.id) scenario = set.get(viewing.scenarioId);
    else {
      const withSteps = set.list().filter((s) => s.steps.length > 0);
      if (withSteps.length === 0) {
        notify.warning('This diagram has no scenario with steps to export (right panel › Scenarios).');
        return null;
      }
      scenario = withSteps.length === 1 ? withSteps[0] : await chooseScenario(set.list());
    }
    if (!scenario) return null;
    if (scenario.steps.length === 0) {
      notify.warning(`"${scenario.name}" has no steps to export.`);
      return null;
    }
    try {
      const renderDrawingSvg = installOptions.renderDrawingSvg ?? ((xml: string) => renderXmlToSvgDocument(xml));
      const html = await buildScenarioHtml(scenario, tab.name, { renderDrawingSvg, renderUml: installOptions.renderUml });
      const fileName = scenarioExportFileName(tab.name, scenario.name);
      (installOptions.saveFile ?? downloadFile)(new Blob([html], { type: 'text/html;charset=utf-8' }), fileName);
      notify.success(`Scenario "${scenario.name}" exported as ${fileName}`);
      return fileName;
    } catch (error) {
      console.error('[Scenarios] Export failed:', error);
      notify.error(`Could not export the scenario: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  /** Builds a PDF / slides / HTML document of a scenario (no dialog). */
  const buildDoc = async (
    scenario: ScenarioData,
    diagramName: string,
    format: ScenarioDocFormat | 'html',
    options: { orientation?: 'portrait' | 'landscape'; showChanges?: boolean }
  ): Promise<{ blob: Blob; fileName: string }> => {
    const renderDrawingSvg = installOptions.renderDrawingSvg ?? ((xml: string) => renderXmlToSvgDocument(xml));
    if (format === 'html') {
      const html = await buildScenarioHtml(scenario, diagramName, { renderDrawingSvg, renderUml: installOptions.renderUml });
      return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), fileName: scenarioExportFileName(diagramName, scenario.name) };
    }
    if (format === 'pdf') {
      const pdf = await import('./scenario-pdf');
      const renderDrawingPng =
        installOptions.renderDrawingPng ?? (async (xml: string) => pdf.rasterizeSvgMarkup(await renderDrawingSvg(xml), 2));
      const bytes = await pdf.buildScenarioPdf(
        scenario,
        diagramName,
        { renderDrawingPng, renderUml: installOptions.renderUml, ...installOptions.pdfDeps },
        { orientation: options.orientation ?? 'portrait', showChanges: options.showChanges ?? false }
      );
      return { blob: new Blob([bytes], { type: 'application/pdf' }), fileName: pdf.scenarioPdfFileName(diagramName, scenario.name) };
    }
    const slides = await import('./scenario-slides');
    const html = await slides.buildScenarioSlidesHtml(
      scenario,
      diagramName,
      { renderDrawingSvg, renderUml: installOptions.renderUml },
      { showChanges: options.showChanges ?? false }
    );
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), fileName: slides.scenarioSlidesFileName(diagramName, scenario.name) };
  };
  const exportScenarioDoc = async (format: ScenarioDocFormat, scenarioId?: string): Promise<string | null> => {
    const tab = tabManager.getActiveTab();
    if (!tab) return null;
    const set = tab.saveLoadController.getScenarios();
    const all = set.list();
    if (!all.some((s) => s.steps.length > 0)) {
      notify.warning('This diagram has no scenario with steps to export (right panel › Scenarios).');
      return null;
    }
    const viewing = viewer.getState();
    const initial =
      (scenarioId && set.get(scenarioId)?.id) || (viewing && viewing.tabId === tab.id ? viewing.scenarioId : null) || null;
    const offered = scenarioId ? all.filter((s) => s.id === scenarioId) : all;
    const choice = await (installOptions.docDialog ?? openScenarioDocDialog)({
      format,
      scenarios: offered,
      initialScenarioId: initial,
      showChanges: viewer.isShowingChanges(),
    });
    if (!choice) return null;
    const scenario = set.get(choice.scenarioId);
    if (!scenario || scenario.steps.length === 0) {
      notify.warning(`"${scenario?.name ?? 'The scenario'}" has no steps to export.`);
      return null;
    }
    try {
      if (format === 'pdf') notify.success(`Creating the PDF of "${scenario.name}"…`);
      const { blob, fileName } = await buildDoc(scenario, tab.name, format, choice);
      (installOptions.saveFile ?? downloadFile)(blob, fileName);
      notify.success(`Scenario "${scenario.name}" exported as ${fileName}`);
      return fileName;
    } catch (error) {
      console.error('[Scenarios] Export failed:', error);
      notify.error(`Could not export the scenario: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const onExportRequest = (evt: Event): void => {
    const format = (evt as CustomEvent<{ format?: string } | null>).detail?.format;
    if (format === 'pdf' || format === 'slides') void exportScenarioDoc(format);
    else void exportScenario();
  };
  window.addEventListener(SCENARIO_EXPORT_EVENT, onExportRequest);

  const showPanel = installRightPanelSwitch((view) => {
    if (view === 'scenarios') panel.refresh();
  });

  // The panel and the view follow the active tab
  const onTabChanged = (): void => {
    const state = viewer.getState();
    if (state && state.tabId !== tabManager.getActiveTab()?.id) viewer.close();
    panel.refresh();
  };
  const onTabClosed = (evt: Event): void => {
    const closedId = (evt as CustomEvent<{ tabId: string }>).detail?.tabId;
    if (viewer.getState()?.tabId === closedId) viewer.close();
    panel.refresh();
  };
  window.addEventListener('tab-changed', onTabChanged);
  window.addEventListener('tab-closed', onTabClosed);

  const handleKeydown = (e: KeyboardEvent): boolean => {
    if (!viewer.isActive()) return false;
    const action = scenarioKeyAction(e);
    if (action === 'pass') return false;
    e.stopPropagation();
    if (action === 'swallow') return true;
    e.preventDefault();
    if (action === 'prev') viewer.go(-1);
    else if (action === 'next') viewer.go(1);
    else if (action === 'first') viewer.first();
    else if (action === 'last') viewer.last();
    else if (action === 'exit') viewer.close();
    else if (action === 'toggle-play') viewer.toggleAutoplay();
    return true;
  };

  const destroy = (): void => {
    window.removeEventListener('tab-changed', onTabChanged);
    window.removeEventListener('tab-closed', onTabClosed);
    window.removeEventListener(SCENARIO_EXPORT_EVENT, onExportRequest);
    viewer.destroy();
    panel.destroy();
    if (installed === handle) installed = null;
  };

  const exportScenarioFile = async (
    tabId: string,
    scenarioId: string,
    format: ScenarioDocFormat | 'html',
    options: { orientation?: 'portrait' | 'landscape'; showChanges?: boolean } = {}
  ): Promise<string> => {
    const tab = tabById(tabId);
    const scenario = tab?.saveLoadController.getScenarios().get(scenarioId);
    if (!tab || !scenario) throw new Error('scenario not found');
    if (scenario.steps.length === 0) throw new Error(`"${scenario.name}" has no steps to export`);
    const { blob, fileName } = await buildDoc(scenario, tab.name, format, options);
    (installOptions.saveFile ?? downloadFile)(blob, fileName);
    notify.success(`Scenario "${scenario.name}" exported as ${fileName}`);
    return fileName;
  };

  const handle: ScenariosHandle = { viewer, panel, handleKeydown, showPanel, exportScenario, exportScenarioDoc, exportScenarioFile, destroy };
  installed = handle;
  return handle;
}

let installed: ScenariosHandle | null = null;

/** The installed scenarios wiring (the AI tools open the view and export through it); null in tests without it. */
export function installedScenarios(): ScenariosHandle | null {
  return installed;
}
