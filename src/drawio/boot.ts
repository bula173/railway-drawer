/**
 * @file boot.ts
 * @brief Starts exactly one editor: the legacy maxGraph app or the embedded draw.io workspace.
 *
 * Vanilla port of the React `AppShell`. Only one editor is started per page load (switching
 * reloads the page), so the legacy controllers and autosave never run behind draw.io.
 * Both editors are loaded with dynamic `import()`, so drawio mode never downloads the
 * maxGraph chunk and legacy mode never downloads the draw.io workspace.
 */

import { getEditorMode, setEditorMode } from './editorMode';
import type { EditorMode } from './editorMode';
import type { DrawioWorkspaceHandle, DrawioWorkspaceOptions } from './workspace';

export const DRAWIO_ROOT_ID = 'drawio-root';

export interface StartEditorOptions {
  /** Boots the legacy maxGraph app, e.g. `() => import('./legacy-main')`. Not called in drawio mode. */
  loadLegacy: () => Promise<unknown>;
  /** Mount point for draw.io. Default: `#drawio-root`, created as the last child of `<body>` when missing. */
  drawioRoot?: HTMLElement;
  /** Passed to `mountDrawioWorkspace`. */
  drawioOptions?: DrawioWorkspaceOptions;
  /** Location search string to resolve the mode from. Default `window.location.search`. */
  search?: string;
  /** Location hash. Default `window.location.hash`; a `#R…` diagram link (or `?gitlab=`) forces the legacy editor. */
  hash?: string;
}

export interface StartedEditor {
  mode: EditorMode;
  /** Only set in drawio mode. */
  drawio?: DrawioWorkspaceHandle;
}

function ensureDrawioRoot(): HTMLElement {
  const existing = document.getElementById(DRAWIO_ROOT_ID);
  if (existing) return existing;
  const root = document.createElement('div');
  root.id = DRAWIO_ROOT_ID;
  document.body.append(root);
  return root;
}

/** Resolves the editor mode and starts that editor. */
export async function startEditor(opts: StartEditorOptions): Promise<StartedEditor> {
  const search = opts.search ?? window.location.search;
  const hash = opts.hash ?? window.location.hash;
  // A diagram link (`#R…`, src/share/share-link.ts) opens in the maxGraph editor, which loads it as
  // new tabs; the remembered mode is not changed (the next normal start uses it again).
  // Same for a link to a GitLab file (`?gitlab=project:branch:path`, src/share/providers/gitlab).
  const sharedDiagram = (hash.startsWith('#R') && hash.length > 2) || new URLSearchParams(search).has('gitlab');
  const mode = sharedDiagram ? 'legacy' : getEditorMode(search);
  // An explicit ?editor= choice becomes the remembered default.
  if (!sharedDiagram && new URLSearchParams(search).has('editor')) setEditorMode(mode);
  document.body.dataset.editor = mode;

  if (mode === 'drawio') {
    const { mountDrawioWorkspace } = await import('./workspace');
    const drawio = mountDrawioWorkspace(opts.drawioRoot ?? ensureDrawioRoot(), opts.drawioOptions);
    return { mode, drawio };
  }
  await opts.loadLegacy();
  return { mode };
}
