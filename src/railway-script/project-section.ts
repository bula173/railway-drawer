/**
 * @file project-section.ts
 * @brief The Railway Script's part of the project file (services/project-sections.ts): the
 *        `rdRailwayScript` attribute of the shown page's `<diagram>` (script-store.ts). Imported for
 *        its registration by ui/saveload.ts (and the unit test setup); adds the typed
 *        `railwayScript` to DiagramDocument, ProjectService and ParsedProject.
 */
import { defineSectionAccessor } from '../document/diagram-document';
import { registerProjectSection } from '../services/project-sections';
import { RailwayScriptStore, railwayScriptAttributes, readRailwayScriptAttribute, sanitizeCachedScript } from './script-store';

export const RAILWAY_SCRIPT_SECTION = 'railwayScript';

declare module '../document/diagram-document' {
  interface DiagramDocument {
    /** Railway Script of this diagram (src/railway-script); saved on the main page's `<diagram>`. */
    readonly railwayScript: RailwayScriptStore;
  }
}

declare module '../services/project-service' {
  interface ProjectService {
    /** Railway Script of this diagram (src/railway-script); saved on the main page's `<diagram>`. */
    readonly railwayScript: RailwayScriptStore;
  }
  interface ParsedProject {
    /** The main page's Railway Script (`rdRailwayScript`); '' when none. */
    railwayScript: string;
  }
}

registerProjectSection<RailwayScriptStore, string>({
  key: RAILWAY_SCRIPT_SECTION,
  order: 20,
  create: () => new RailwayScriptStore(),
  mainPageAttributes: (store) => railwayScriptAttributes(store.get()),
  parse: (mainPage) => readRailwayScriptAttribute(mainPage),
  empty: () => '',
  load: (store, text) => store.set(text, 'load'),
  // Only written when there is a script
  toCache: (store) => (store.get().trim() ? store.get() : undefined),
  fromCache: (store, cached) => store.set(sanitizeCachedScript(cached), 'load'),
});

defineSectionAccessor(RAILWAY_SCRIPT_SECTION);
