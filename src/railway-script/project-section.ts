/**
 * @file project-section.ts
 * @brief The Railway Script's part of the project file (services/project-sections.ts): the
 *        `rdRailwayScript` attribute of the shown page's `<diagram>` (script-store.ts). Imported for
 *        its registration by ui/saveload.ts (and the unit test setup); adds the typed
 *        `railwayScript` to ProjectService and ParsedProject.
 */
import { ProjectService } from '../services/project-service';
import { registerProjectSection } from '../services/project-sections';
import { RailwayScriptStore, railwayScriptAttributes, readRailwayScriptAttribute } from './script-store';

export const RAILWAY_SCRIPT_SECTION = 'railwayScript';

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
});

if (!Object.getOwnPropertyDescriptor(ProjectService.prototype, RAILWAY_SCRIPT_SECTION)) {
  Object.defineProperty(ProjectService.prototype, RAILWAY_SCRIPT_SECTION, {
    get(this: ProjectService): RailwayScriptStore {
      return this.section<RailwayScriptStore>(RAILWAY_SCRIPT_SECTION);
    },
    configurable: true,
  });
}
