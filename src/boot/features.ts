/**
 * @file features.ts
 * @brief Boot steps of the features (main-editor.ts): scenarios and the railway tools (after the
 *        tabs, before the keyboard), sharing and the Access identity (near the end). The panel
 *        features (Railway Script, AI) belong to the panels: panels.ts.
 */
import type { TabManager } from '../ui/tabs';
import { globalNotificationManager } from '../ui/notification';
import { installSharing } from '../share/install-sharing';
import { installAccessIdentity } from '../ui/access-identity';
import { confirmDialog } from '../ui/app-dialogs';
import { installScenarios, type ScenariosHandle } from '../scenarios/install-scenarios';
import { installRailwayData } from '../railway/install-railway-data';
import { installRailwayRoutes } from '../railway/install-railway-routes';
import { installRailwayStates } from '../railway/install-railway-states';
import { installRailml } from '../railml/install-railml';

/** Scenarios, railway data / routes / states, railML; returns the scenarios handle (its key interceptor). */
export function bootRailwayFeatures(tabManager: TabManager, graphContainer: HTMLElement): ScenariosHandle {
  /**
   * @brief Scenarios of the active tab (right panel "Scenarios", next to Properties)
   * @details Each step is a snapshot of the drawing, saved as its own draw.io page. Clicking a step
   * shows it read-only on the canvas (the live drawing is only hidden); ←/→ step, Esc goes back.
   */
  const scenarios = installScenarios(tabManager, globalNotificationManager, graphContainer);

  /**
   * @brief Railway object data (right panel "Data" and "Checks")
   * @details Signals, balises, track sections, points, ... carry typed data stored as draw.io object
   * attributes (`rdKind`, `rdId`, ...). ERTMS library entries and the app's railway shapes get their
   * kind on insert; Checks validates the data live; File > Export Railway Data writes CSV/xlsx lists.
   */
  installRailwayData(tabManager, globalNotificationManager, { showPanel: scenarios.showPanel });
  // Route tool, route/interlocking tables, snap to track, km ruler (src/railway/install-railway-routes.ts)
  installRailwayRoutes(tabManager, globalNotificationManager);
  installRailwayStates(tabManager, globalNotificationManager);
  // railML 3.2 import/export (File menu, File > Open and file drops of railML; lazy chunk)
  installRailml(tabManager, globalNotificationManager);
  return scenarios;
}

/** Share dialog, links, cloud storage providers and the Cloudflare Access user. */
export function bootSharing(tabManager: TabManager): void {
  /**
   * @brief Share dialog, diagram links, cloud storage providers
   * @details Top-bar Share button and File > Share…: link with the diagram in the URL hash (`#R…`,
   * also as an app.diagrams.net link), .drawio/PNG/SVG downloads, Web Share; SharePoint/OneDrive
   * (disabled until VITE_MSAL_CLIENT_ID is set, see docs/SHAREPOINT.md). A `#R` link in the start URL
   * opens as new tabs. Tabs opened from / saved to a provider save back there with Ctrl+S.
   */
  const sharing = installSharing(tabManager, globalNotificationManager);

  /**
   * @brief Top-bar email + Log out of Cloudflare Access (production only, see access-identity.ts)
   * @details Asynchronous after boot; nothing shown (and nothing logged) without Access.
   */
  void installAccessIdentity({
    container: document.querySelector<HTMLElement>('.top-bar-right'),
    unsavedRemoteTabs: () => sharing.unsavedRemoteTabs(),
    confirm: (opts) => confirmDialog(opts),
    allowLeave: () => sharing.allowLeave(),
  });
}
