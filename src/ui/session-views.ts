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

export interface SessionViews {
  readonly properties: PropertiesPanel;
  readonly layers: LayersController;
  readonly statusBar: StatusBarController;
  readonly edgeProperties: EdgePropertiesController;
  /** Unbinds every view (DOM and graph listeners). */
  destroy(): void;
}

export function createSessionViews(): SessionViews {
  const properties = new PropertiesPanel();
  const layers = new LayersController();
  const statusBar = new StatusBarController();
  const edgeProperties = new EdgePropertiesController();
  return {
    properties,
    layers,
    statusBar,
    edgeProperties,
    destroy() {
      properties.destroy();
      layers.destroy();
      statusBar.destroy();
      edgeProperties.destroy();
    },
  };
}
