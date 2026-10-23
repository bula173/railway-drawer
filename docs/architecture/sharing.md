# Sharing

- `install-sharing.ts` (called from `boot/features.ts`) wires everything: top-bar `#share-btn` and File > Share…
  (`data-action="share"` -> `window` event `share-request`) open `share-dialog.ts`; File-menu items
  "Open from/Save to <provider>…" are generated into `#file-menu-remote-items` for available providers.
- **Link with the diagram** (`share-link.ts`, `share-mxfile.ts`): all tabs (+ each tab's preserved pages) as one
  `<mxfile>` (`buildShareMxfile`, unique page ids) -> `#R` + base64url(deflateRaw(encodeURIComponent(xml)))
  (CompressionStream). The app.diagrams.net link uses draw.io's exact format (`'#R' + encodeURIComponent(Graph.compress(xml))`,
  standard base64; EditorUi.js:9545 / App.js:6669). The reader accepts both alphabets and raw-XML `#R` links,
  caps the hash, the inflated stream and the decoded XML (5 MB), and never evaluates anything. Every inflate has an
  output cap (deflate bombs): async = `services/deflate-stream.ts` (`inflateRawBytes`, default `MAX_INFLATED_BYTES`
  50 MB; links, compressed pages, PlantUML encoding), sync = `engine/inflate.ts` via `codec.ts` `decompress`
  (`MAX_DECOMPRESSED_BYTES` 50 MB; stencils, library entries). One `<mxfile>` writer: `drawio-xml.ts` `buildMxfile`
  (model pages and raw `<diagram>` pages in order, optional `pageId` for unique ids; `buildShareMxfile` uses it). Links over 32k chars get a warning.
- Incoming links (`share-open.ts`): on start and on `hashchange`, the hash is stripped (replaceState) and each page opens in a
  **new tab** via `SaveLoadController.loadProjectXml` (existing tabs kept; a lone empty tab is closed). The same
  `openDiagramFile` opens the removed draw.io view's leftover autosave once.
- Downloads: .drawio (all tabs), PNG/SVG of the current tab via `src/ui/diagram-image-export.ts` (draw.io-like
  export pipeline: `Graph.getSvg` layout, `Editor.exportToCanvas` rasterizing), Web Share API buttons only
  when `navigator.canShare` accepts the file.
- **Cloud providers** (`providers/types.ts`): `StorageProviderDescriptor` (main bundle: id, label, `availability()`,
  `load()` = dynamic import, `resumePendingSignIn`) and `StorageProvider` (account, `list(path)` browse
  containers->folders->files, `open`, `save(file, xml, expectedVersion)` -> conflict result, `saveAs(path, name, xml,
  fail|replace|rename)`, optional `createShareLink`). `providers/registry.ts` lists them (SharePoint, then GitLab).
  Dialogs (`ui/remote-dialogs.ts`) and the Share dialog render providers generically. Optional generic extensions
  (added for GitLab): `saveFields(ctx)` (extra save inputs: rendered in the Save-to browse dialog per location and
  asked by `saveBack` on Ctrl+S via `askSaveOptions`; values are passed as an extra last argument only when present),
  `conflictActions`/`resolveConflict` (extra buttons in the conflict dialog, `ConflictChoice` `action:<id>`),
  `SaveResult.note/link` (link shown by `showResultLink`), `openRef` + descriptor `incomingLink/clearIncomingLink`
  (`RemoteSession.openIncomingLinks`, run after `resumePendingSignIns`; `askSignIn` dialog so the popup has a user
  gesture), descriptor `settings` (runtime settings form in the Share dialog; on save the section is redrawn and
  `onProviderSettingsChanged` rebuilds the File-menu items and retries incoming links). `ShareLinkCapability`
  `typesLegend/audiencesLegend`. The pending-redirect key moved to `providers/pending.ts`.
- `remote-session.ts`: per-tab binding (provider id + ref + version), `DiagramDocument.setSaveHandler` (the document's remote binding slot)
  redirects Ctrl+S / File > Save to `saveBack` (version conflict -> overwrite / save as copy / cancel); File > Save As…
  (`saveProjectToDisk`) always downloads. Status bar `#status-remote-item` "Stored in:". TabManager now dispatches
  `window` events `tab-changed` (switchTab) and `tab-closed` (closeTab).
- **Bindings persist with the tab cache** (`remote-binding.ts`): `CacheData.tabs[].remote` = `{ v: 1, providerId, ref,
  version, name, location, webUrl?, parentPath, savedAt, dirty }` (optional field, cache version stays `'1'`; old caches
  restore unbound; unknown `v`/malformed -> ignored; credential-like keys are stripped on write and read; tokens stay in
  the providers' own storage). `restoreFromCache` runs before sharing, so TabManager keeps each tab's raw entry
  (`takeCachedRemote`) until `installSharing` calls `restoreBinding`, then writes through
  `setRemoteCacheWriter(remoteSession.persistedBinding)`. Bind/save/reload/unlink flush the cache at once.
  A restored binding is **unverified** (`data-verified` on the status item) until the next save/reload: `saveBack` asks
  `askSignIn` first when the provider has no account, sends the stored version (remote changed -> conflict dialog) and,
  when a call fails because the session ended (account gone), asks to sign in and retries once (`withSignIn`).
  Actions (active tab): File menu "Reload from <provider>…" / "Unlink from <provider>" (in `#file-menu-remote-items`,
  rebuilt on tab change/binding change) and the clickable status item's popup (`ui/remote-menu.ts`: Save now, Reload,
  Unlink, Open in <provider>). Reload = confirm (`askConfirm`, "Discard the changes" when dirty) -> provider
  `reopen(file)` (optional `StorageProvider` method; SharePoint downloadText, GitLab read) -> `loadProjectXml` into the
  same tab. Unlink keeps the content. File > Open from disk (`SaveLoadController.onLocalFileOpened`) unbinds.
- **Dirty tracking**: fingerprint (`contentFingerprint` of `getProjectXml()`) at the last open/save; model/scenario
  changes (`watchTab`) re-check it debounced (300 ms), so undo back to the saved state is clean. `dirty` is persisted;
  a tab restored dirty stays dirty until saved/reloaded. UI: `.rd-remote-dirty-dot` in the tab (TabManager
  `setTabDecorator`), `data-dirty` on the status item; the tab × asks (`setCloseGuard` -> `confirmCloseTab`,
  themed `askConfirm`; the guard may answer with a promise) and `beforeunload` prompts only when a bound tab has unsaved remote changes.
- **Test provider** (`src/debug/fake-remote-provider.ts`, "Test storage", id `fake-remote`): registered by
  `installSharing` only when `import.meta.env.DEV` and localStorage `rd.fakeRemote` = `'1'` (production builds drop it:
  no `rd.fakeRemote` in `dist/`). Files in localStorage `rd.fakeRemote.files` (`{path: {xml, version: 'v<n>'}}`), save
  log `rd.fakeRemote.log`, signed-in flag sessionStorage `rd.fakeRemote.account`, `window.__rdFakeRemote.put()` to
  change a file "remotely".
- **SharePoint** (`providers/sharepoint/`, docs/SHAREPOINT.md): disabled unless `VITE_MSAL_CLIENT_ID` is set at build
  time (`VITE_MSAL_TENANT_ID` default `organizations`, `VITE_SHAREPOINT_DEFAULT_SITE` `host:/sites/Name`). vite.config.ts
  `define`s these keys (empty when unset) so `import.meta.env.VITE_MSAL_CLIENT_ID ? () => import(...) : null` is a
  constant: unconfigured builds contain no MSAL code and no SharePoint chunk. Plain http (except localhost) ->
  "SharePoint requires HTTPS — use https://railwaydrawer.mksystemdesign.org". `@azure/msal-browser` is pinned (5.24.0):
  popup with redirect fallback; msal 5 needs `broadcastResponseToMainFrame` on the redirect page, and the redirect URI is
  the app itself, so `main.ts` runs `auth-bridge.ts` instead of the editor when the URL carries `state`+`code|error`.
  `graph-client.ts`: Graph v1.0 via fetch (nextLink paging, 429/503 retry, PUT < 4 MB else upload session, If-Match ->
  412 `GraphConflictError`, createLink, invite). Scopes: Sites.Read.All (browse), Files.ReadWrite.All (content, links).
- **GitLab** (`providers/gitlab/`, docs/GITLAB.md): gitlab.com or self-hosted (also plain-http LAN). Config =
  build-time `VITE_GITLAB_URL`, `VITE_GITLAB_CLIENT_ID`, `VITE_GITLAB_DEFAULT_PROJECT` (vite.config.ts `define`s them,
  empty when unset) overridden by runtime settings in localStorage `rd.gitlab.settings` (Share > GitLab settings;
  only differences from the build defaults are stored; changing URL/app id drops tokens). Unlike SharePoint the chunk
  (`gitlab-loader.ts`) is always built and only loaded when configured+used. Availability: not configured / invalid
  URL / https page + http GitLab (mixed content) / ready. OAuth 2.0 code + PKCE S256 public client (`oauth.ts`,
  `pkce.ts` with a JS SHA-256 fallback because `crypto.subtle` is missing on the http LAN page), scope `api` (smallest
  that allows REST commits + MRs), `state` prefix `rdgl-`: `main.ts` routes such loads to `gitlab/auth-bridge.ts`
  before the SharePoint check. Popup opened synchronously in the click, answer via BroadcastChannel `rd-gitlab-auth`
  (GitLab's sign-in page sends COOP same-origin, so no opener); popup closed = rejected only when the app window has
  focus again; blocked -> redirect (flow record in sessionStorage `rd.gitlab.oauth.flow`, bridge stores the answer
  and `location.replace`s back, `completeRedirect` in the loader). Tokens in sessionStorage `rd.gitlab.auth`
  (localStorage with "Stay signed in"), refresh 60 s before the 2 h expiry and after 401 (single flight). REST v4
  client `gitlab-client.ts` (X-Next-Page / Link paging, file paths encoded incl. `.`, UTF-8 base64,
  400 "changed since you started editing" -> `GitLabConflictError`, 413/"too large" -> `GitLabTooLargeError`).
  Provider: projects (default, starred, member; search) -> branches -> tree; version = `last_commit_id` (new one via
  HEAD `X-Gitlab-Last-Commit-Id`); save = PUT with commit message + `last_commit_id`; saveAs = POST (optional new
  branch created from the base first, rename = `name (2).drawio`); MR checkbox (409 -> reuse the open MR); conflict
  action "Save to new branch" branches from the version you started from; 50 MB client cap. Share link
  `?gitlab=<project>:<branch>:<path>` (parts percent-encoded, `/` kept; parsed from the raw query) + GitLab blob
  URL; the descriptor stores it in sessionStorage `rd.gitlab.pendingOpen` and strips it. Status bar "GitLab: group/project › branch › path".
- Tests: `src/share/__tests__/` (link codec incl. draw.io's algorithm via node:zlib, Graph client with mocked fetch,
  dialog, remote session, provider, config; `gitlab.test.ts`: PKCE vectors, OAuth popup/redirect/refresh, bridge,
  client paging/errors, provider against an in-memory GitLab, config/links, descriptor; `gitlab-session.test.ts`:
  save fields, conflict actions, incoming links, Share-dialog settings; `remote-persist.test.ts`: binding format, restore +
  save back (sign-in, conflict), Reload/Unlink, dirty state), `src/__tests__/ui/remote-binding-cache.test.ts` (real
  TabManager + installSharing: old cache, reload round trip with the fake provider, close/beforeunload), `tests/e2e/share.spec.ts` (any port: copy
  link -> fresh context opens the tabs, downloads, damaged link, SharePoint "Not configured"), `tests/e2e/gitlab.spec.ts`.
