/**
 * @file session-views.ts
 * @brief The shell's panels as views created once (by the TabManager) over the shared DOM and
 *        bound to the active diagram session (session.ts): a tab switch rebinds their graph
 *        listeners, a background tab never updates them.
 */
import { PropertiesPanel } from './properties';

export interface SessionViews {
  readonly properties: PropertiesPanel;
  /** Unbinds every view (DOM and graph listeners). */
  destroy(): void;
}

export function createSessionViews(): SessionViews {
  const properties = new PropertiesPanel();
  return {
    properties,
    destroy() {
      properties.destroy();
    },
  };
}
