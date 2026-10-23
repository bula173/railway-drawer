/**
 * @file shell.ts
 * @brief Boot step 1 (main-editor.ts): what the page needs before any tab exists. The draw.io
 *        codecs come first (before any file or cache is loaded), then the stencil engine, the
 *        page-wide maxGraph patches, the shape registry, the commands (menus, toolbar tooltips and
 *        Help read their shortcuts) and the static chrome (Help dialog, side panels, toolbar, menu bar).
 */
import { registerShapes } from '../shapes';
import { ShortcutsHelpController } from '../ui/shortcuts-help';
import { installGlobalGraphPatches } from '../ui/setup-graph';
import { installSidePanels } from '../ui/side-panels';
import { globalNotificationManager } from '../ui/notification';
import { globalErrorHandler } from '../services/error-handler';
import { registerDrawioCodecs } from '../services/drawio-xml';
import { ensureStencilsForXml, installDrawioCompat, installStencilEngine, parseMxLibrary } from '../drawio-shapes/engine';
import { setDrawioPaletteEngine } from '../ui/drawio-palette';
import { installToolbar } from '../ui/toolbar';
import { installMenuBar } from '../ui/menu';
import { registerAppCommands } from '../ui/commands';

/** Page-wide setup before any tab: codecs, stencils, maxGraph patches, shapes, commands, Help, side panels, toolbar, menu bar. */
export function bootShell(): void {
  /**
   * @brief Register all built-in shape definitions
   * @details Initializes the global shape registry with railway, UML, flowchart,
   * and other predefined shapes. This must be called before creating any diagrams.
   */
  // Codecs for reading draw.io files; before any file or cache is loaded
  registerDrawioCodecs();

  // draw.io stencils: shape=stencil(...), named stencil sets from public/stencils/, JS shapes win
  installStencilEngine({ baseUrl: import.meta.env.BASE_URL });
  // Page-wide maxGraph prototype patches (Cell.prototype.isConnectable), once (setup-graph.ts)
  installGlobalGraphPatches();
  setDrawioPaletteEngine({ ensureStencilsForXml, installDrawioCompat, parseMxLibrary });

  try {
    registerShapes();
  } catch (error) {
    globalErrorHandler.handleShapeError(error instanceof Error ? error : new Error(String(error)), true);
    globalNotificationManager.error('Failed to load shapes - some shapes may be unavailable');
  }

  // The app's commands (ui/commands): menus, context menu, toolbar and keyboard run them; the menu
  // hints, toolbar tooltips and Help > Keyboard Shortcuts read their shortcuts
  registerAppCommands();

  /**
   * @brief Initialize keyboard shortcuts help dialog
   * @details Provides a modal dialog showing all available keyboard shortcuts
   * and commands to the user.
   */
  new ShortcutsHelpController();

  // Collapsible, resizable left/right panels; widths and collapsed state remembered (src/ui/side-panels.ts)
  installSidePanels();

  // Toolbar chrome: SVG icons, names + shortcut tooltips, Align / distribute dropdown, buttons run commands (src/ui/toolbar.ts)
  installToolbar();
  // Menu bar: WAI-ARIA menubar, shortcut hints; items run their commands on the active tab (src/ui/menu.ts)
  installMenuBar();
}
