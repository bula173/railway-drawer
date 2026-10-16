/**
 * @file auth-bridge.ts
 * @brief Page load that carries Entra's sign-in response (the redirect URI is the app itself).
 *
 * msal-browser 5 needs the redirect page to run `broadcastResponseToMainFrame`: in a popup it posts
 * the response to the opener (BroadcastChannel) and closes the popup; after a full-page redirect it
 * caches the response and navigates back to the page that started the sign-in. The editor is not
 * started on such a load. Loaded only when SharePoint is configured (see main.ts).
 */
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

export async function runAuthBridge(): Promise<void> {
  document.body.textContent = 'Signing in to Microsoft…';
  try {
    await broadcastResponseToMainFrame();
  } catch (err) {
    console.error('[SharePoint] Sign-in response could not be processed:', err);
    document.body.textContent = 'The Microsoft sign-in could not be completed. Close this window and try again.';
  }
}
