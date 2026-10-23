/**
 * @file storage-keys.ts
 * @brief Registry of every Web Storage key the app uses (localStorage unless noted).
 *
 * Two naming schemes exist for historical reasons: the older `railway-drawer-*` keys and the newer
 * dotted `rd.*` keys (and one bare legacy key). The strings are stored data in users' browsers
 * (and read by index.html / e2e specs), so they are NEVER renamed here; new keys use `rd.<area>.<name>`.
 * Access goes through `safe-storage.ts`. A unit test fails when a key string appears elsewhere in src.
 */
export const STORAGE_KEYS = {
  // ---- railway-drawer-* (legacy scheme)
  /** Autosave of all tabs (CacheService; JSON `{ version, data: CacheData }`). */
  cache: 'railway-drawer-cache',
  /** Time of the first failed autosave after the last good one (CacheService). */
  cacheStale: 'railway-drawer-cache-stale',
  /** Uploaded images (ImageService; JSON). */
  customImages: 'railway-drawer-custom-images',
  /** Custom shapes (CustomShapeRegistry; JSON). */
  customShapes: 'railway-drawer-custom-shapes',
  /** Autosave of the retired draw.io view (read once for migration; retired-drawio-mode.ts). */
  retiredDrawioDoc: 'railway-drawer-drawio-doc',
  /** Remembered editor of the retired mode switch (removed at boot; retired-drawio-mode.ts). */
  retiredEditorMode: 'railway-drawer-editor-mode',
  /** ERTMS tab of the left panel shown ('1' | '0'; main-editor.ts). */
  ertmsTab: 'railway-drawer-ertms-tab',
  /** Hidden app shape groups (JSON string[]; shapes-tab-palettes.ts). */
  hiddenShapeGroups: 'railway-drawer-hidden-shape-groups',
  /** User templates (JSON; template-store.ts). */
  templates: 'railway-drawer-templates',
  /** Group order of the legacy shape toolbar (JSON string[]; shapes/toolbar.ts). Bare legacy key. */
  shapeToolbarGroupOrder: 'shapeToolbarGroupOrder',

  // ---- rd.* (current scheme)
  /** Dev/e2e: '1' forces the Cloudflare Access identity probe (access-identity.ts). */
  accessProbe: 'rd.accessProbe',
  /** Local MCP bridge settings `{ port, token }` (ai/bridge/pairing.ts). */
  aiLocalBridge: 'rd.ai.local',
  /** sessionStorage: remote AI pairing `{ token, expiresAt }` (ai/bridge/pairing.ts). */
  aiRemotePairing: 'rd.ai.pairing',
  /** AI chat settings incl. the user's API key (ai/chat/settings.ts). */
  aiSettings: 'rd.ai.settings',
  /** Hover connection arrows on/off ('1' | '0'; hover-arrows.ts). */
  connectionArrows: 'rd.connectionArrows',
  /** User-imported draw.io libraries (JSON; library-adapter.ts). */
  drawioLibraries: 'rd.drawioLibraries',
  /** Expanded draw.io palettes (JSON flags; + optional view suffix; drawio-palette-view.ts). */
  drawioPalettesExpanded: 'rd.drawioPalettes.expanded',
  /** Visible draw.io palettes (JSON flags; + optional view suffix; drawio-palette-view.ts). */
  drawioPalettesVisible: 'rd.drawioPalettes.visible',
  /** Dev/e2e: '1' enables the fake remote provider (debug/fake-remote-provider.ts). */
  fakeRemote: 'rd.fakeRemote',
  /** sessionStorage, dev/e2e: fake remote "signed in". */
  fakeRemoteAccount: 'rd.fakeRemote.account',
  /** Dev/e2e: fake remote files `{ [path]: { xml, version } }`. */
  fakeRemoteFiles: 'rd.fakeRemote.files',
  /** Dev/e2e: fake remote request log. */
  fakeRemoteLog: 'rd.fakeRemote.log',
  /** GitLab tokens (sessionStorage, or localStorage with "stay signed in"). */
  gitlabAuth: 'rd.gitlab.auth',
  /** sessionStorage: GitLab redirect sign-in in progress. */
  gitlabOauthFlow: 'rd.gitlab.oauth.flow',
  /** sessionStorage: GitLab's answer to a redirect sign-in. */
  gitlabOauthResponse: 'rd.gitlab.oauth.response',
  /** sessionStorage: a `?gitlab=` link still to be opened. */
  gitlabPendingOpen: 'rd.gitlab.pendingOpen',
  /** GitLab runtime settings `{ url, clientId, defaultProject, staySignedIn }`. */
  gitlabSettings: 'rd.gitlab.settings',
  /** Narrow-screen banner dismissed ('1'). */
  narrowBannerDismissed: 'rd.narrowBanner.dismissed',
  /** PlantUML server URL. */
  plantumlServer: 'rd.plantuml.server',
  /** Railway km ruler on/off ('1' | '0'). */
  railwayKmRuler: 'rd.railway.kmRuler',
  /** Railway live checks on/off ('1' | '0'). */
  railwayLiveChecks: 'rd.railway.liveChecks',
  /** Railway snap to track on/off ('1' | '0'). */
  railwaySnapToTrack: 'rd.railway.snapToTrack',
  /** Railway object state legend shown ('1' | '0'). */
  railwayStateLegend: 'rd.railway.stateLegend',
  /** Railway Script auto-apply on/off ('1' | '0'). */
  railwayScriptAutoApply: 'rd.railwayScript.autoApply',
  /** sessionStorage: provider id while a redirect sign-in is in progress (share/providers/pending.ts). */
  remotePendingSignIn: 'rd.remote.pendingSignIn',
  /** Scenario autoplay settings `{ seconds, loop }`. */
  scenarioAutoplay: 'rd.scenario.autoplay',
  /** Last scenario PDF orientation ('portrait' | 'landscape'). */
  scenarioPdfOrientation: 'rd.scenario.pdfOrientation',
  /** Scenario view "Show changes" ('1' | '0'). */
  scenarioShowChanges: 'rd.scenario.showChanges',
  /** Scenario view side panel ('collapsed' | 'open'). */
  scenarioSidePanel: 'rd.scenario.sidePanel',
  /** Side panel widths and collapsed state (JSON). */
  sidePanels: 'rd.sidePanels',
  /** Dev/e2e: '1' shows the start card to automated browsers too. */
  startCardForce: 'rd.startCard.force',
  /** Start card "Don't show again" ('1'). */
  startCardHidden: 'rd.startCard.hidden',
  /** Theme preference ('light' | 'dark'; missing = auto). index.html reads it before the app loads. */
  theme: 'rd.theme',
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;
export type StorageKey = (typeof STORAGE_KEYS)[StorageKeyName];
