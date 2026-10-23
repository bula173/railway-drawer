/**
 * @file session-views.ts
 * @brief The shell's panels as views created once (by the TabManager) over the shared DOM and
 *        bound to the active diagram session (session.ts): a tab switch rebinds their graph
 *        listeners, a background tab never updates them.
 */
import { PropertiesPanel } from './properties';
import { LayersController } from './layers';
import { StatusBarController } from './statusbar';
import { EdgePropertiesController } from './edge-properties';
import { CanvasProperties } from './canvas-properties';
import { InteractiveUIController } from './interactive-ui';
import { MenuStateView } from './menu-state';
import { ContextMenuController } from './context-menu';
import { PlantUmlEditorController } from './plantuml-editor';
import { bindCommandButtons } from './toolbar';

export interface SessionViews {
  readonly properties: PropertiesPanel;
  readonly layers: LayersController;
  readonly statusBar: StatusBarController;
  readonly edgeProperties: EdgePropertiesController;
  readonly canvasProperties: CanvasProperties;
  /** The other Properties / Canvas fields and the zoom select (interactive-ui.ts). */
  readonly propertyFields: InteractiveUIController;
  /** Undo / Redo and grid state of the menus and toolbar. */
  readonly menuState: MenuStateView;
  readonly contextMenu: ContextMenuController;
  /** The PlantUML tab of the left panel. */
  readonly plantumlEditor: PlantUmlEditorController;
  /** Unbinds every view (DOM and graph listeners). */
  destroy(): void;
}

export function createSessionViews(): SessionViews {
  const properties = new PropertiesPanel();
  const layers = new LayersController();
  const statusBar = new StatusBarController();
  const edgeProperties = new EdgePropertiesController();
  // canvas grid field: CanvasProperties' change handler runs before InteractiveUIController's (as before)
  const canvasProperties = new CanvasProperties();
  const propertyFields = new InteractiveUIController();
  const menuState = new MenuStateView();
  const contextMenu = new ContextMenuController();
  const plantumlEditor = new PlantUmlEditorController();
  // Properties > Arrange buttons that run commands (Group / Ungroup)
  const commandButtons = new AbortController();
  bindCommandButtons(document.getElementById('property-content') ?? document.createElement('div'), commandButtons.signal);
  return {
    properties,
    layers,
    statusBar,
    edgeProperties,
    canvasProperties,
    propertyFields,
    menuState,
    contextMenu,
    plantumlEditor,
    destroy() {
      properties.destroy();
      layers.destroy();
      statusBar.destroy();
      edgeProperties.destroy();
      canvasProperties.destroy();
      propertyFields.destroy();
      menuState.destroy();
      contextMenu.destroy();
      plantumlEditor.destroy();
      commandButtons.abort();
    },
  };
}
