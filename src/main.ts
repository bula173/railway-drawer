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
import { isGitLabAuthResponseUrl } from './share/providers/gitlab/config';
import { isAuthResponseUrl } from './share/providers/sharepoint/config';

// Microsoft sign-in answers come back to the app's own URL (the Entra redirect URI). Such a load
// only hands the response to the window that started the sign-in; it does not start an editor.
// Without VITE_MSAL_CLIENT_ID this is a constant null and the bridge chunk is not built.
const loadAuthBridge = import.meta.env.VITE_MSAL_CLIENT_ID
  ? () => import('./share/providers/sharepoint/auth-bridge')
  : null;

// GitLab sign-in answers carry `state=rdgl-…` (checked first: they would also look like Entra's).
if (isGitLabAuthResponseUrl(window.location)) {
  import('./share/providers/gitlab/auth-bridge')
    .then((bridge) => bridge.runGitLabAuthBridge())
    .catch((error: unknown) => console.error('Failed to complete the GitLab sign-in:', error));
} else if (loadAuthBridge && isAuthResponseUrl(window.location)) {
  loadAuthBridge()
    .then((bridge) => bridge.runAuthBridge())
    .catch((error: unknown) => console.error('Failed to complete the sign-in:', error));
} else {
  startEditor({ loadLegacy: () => import('./legacy-main') }).catch((error: unknown) => {
    console.error('Failed to start the editor:', error);
  });
}
