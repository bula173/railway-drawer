/**
 * @file main.ts
 * @brief Application entry point for Railway Drawer
 * @details
 * Boots the Railway Drawer editor (maxGraph, main-editor.ts). It is loaded with a dynamic import,
 * so sign-in answer pages (which only hand the response back to the opener) never download it.
 * The former embedded draw.io mode was removed: old `?editor=drawio|legacy|main` links simply
 * open the editor (the parameter is ignored) and the remembered mode is dropped.
 *
 * @author Marcin Kwiatkowski
 * @version 0.6.0
 */

import { clearRetiredEditorMode } from './services/retired-drawio-mode';
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
  clearRetiredEditorMode();
  import('./main-editor').catch((error: unknown) => {
    console.error('Failed to start the editor:', error);
  });
}
