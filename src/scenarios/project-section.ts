/**
 * @file project-section.ts
 * @brief The scenarios' part of the project file (services/project-sections.ts): one page per step
 *        after the shown page, and the scenario index on the shown page's `<diagram>`
 *        (scenario-format.ts). Imported for its registration by ui/saveload.ts (and the unit test
 *        setup); adds the typed `scenarios` to ProjectService and ParsedProject.
 */
import { ProjectService } from '../services/project-service';
import { registerProjectSection } from '../services/project-sections';
import { ScenarioSet } from './scenario-model';
import type { ScenarioData } from './scenario-model';
import { assembleScenarios, buildScenarioPages, isScenarioStepPage, scenarioIndexAttributes } from './scenario-format';

export const SCENARIOS_SECTION = 'scenarios';

declare module '../services/project-service' {
  interface ProjectService {
    /** Scenarios of this diagram; written as one page per step after the shown page. */
    readonly scenarios: ScenarioSet;
  }
  interface ParsedProject {
    /** Scenarios rebuilt from the step pages and the main page's index (see scenario-format.ts). */
    scenarios: ScenarioData[];
  }
}

registerProjectSection<ScenarioSet, ScenarioData[]>({
  key: SCENARIOS_SECTION,
  order: 10,
  create: () => new ScenarioSet(),
  mainPageAttributes: (set) => scenarioIndexAttributes(set.list()),
  pages: (set, usedIds) => buildScenarioPages(set.list(), usedIds),
  claimsPage: (page) => isScenarioStepPage(page),
  parse: (mainPage, claimed) => assembleScenarios(mainPage, claimed),
  empty: () => [],
});

if (!Object.getOwnPropertyDescriptor(ProjectService.prototype, SCENARIOS_SECTION)) {
  Object.defineProperty(ProjectService.prototype, SCENARIOS_SECTION, {
    get(this: ProjectService): ScenarioSet {
      return this.section<ScenarioSet>(SCENARIOS_SECTION);
    },
    configurable: true,
  });
}
