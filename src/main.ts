/**
 * @file main.ts
 * @brief Application entry point for Railway Drawer
 * @details
 * Starts exactly one editor per page load (see drawio/boot.ts):
 * - 'legacy' (default): the maxGraph editor in legacy-main.ts
 * - 'drawio': the embedded draw.io workspace
 *
 * The legacy editor is loaded with a dynamic import, so drawio mode never downloads
 * the maxGraph chunk. Switching modes reloads the page with `?editor=<mode>`.
 *
 * @author Marcin Kwiatkowski
 * @version 0.6.0
 */

import { startEditor } from './drawio/boot';

startEditor({ loadLegacy: () => import('./legacy-main') }).catch((error: unknown) => {
  console.error('Failed to start the editor:', error);
});
