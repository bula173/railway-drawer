/**
 * @file features.ts
 * @brief Commands of the features that run over the event bus (the features stay free of the
 *        menus): scenarios (File > Export > Scenario ▸), Railway Script (File > Import / Export,
 *        Railway > Railway Script Editor), railML 3.2 (File > Import / Export) and sharing
 *        (File > Share…). The AI assistant has no menu items or shortcuts (right panel only).
 */
import { emit } from '../../core/event-bus';
import { appContext } from '../app-context';
import type { Command } from './types';

/** src/scenarios/install-scenarios.ts: the scenario shown / the only one / the one picked. */
export const scenarioCommands: readonly Command[] = [
  { id: 'exportScenarioHtml', label: 'Scenario (HTML)…', run: () => emit('scenario-export-request') },
  // options dialog, then PDF / HTML slideshow
  { id: 'exportScenarioPdf', label: 'Scenario (PDF)…', run: () => emit('scenario-export-request', { format: 'pdf' }) },
  { id: 'exportScenarioSlides', label: 'Scenario (Slides)…', run: () => emit('scenario-export-request', { format: 'slides' }) },
];

/** src/railway-script/install-railway-script.ts (lazy script-ui chunk): new tab from a script / .rdl.yaml|.rdl.json download. */
export const scriptCommands: readonly Command[] = [
  { id: 'importRailwayScript', label: 'Railway Script…', run: () => emit('railway-script-request', { action: 'import' }) },
  { id: 'exportRailwayScript', label: 'Railway Script…', run: () => emit('railway-script-request', { action: 'export' }) },
  { id: 'railwayScriptEditor', label: 'Railway Script Editor', run: () => appContext()?.leftPanelTabs.switchTab('railwayScript') },
];

/** src/railml/install-railml.ts (lazy railml-ui chunk): new tab from railML / railML 3.2 download. */
export const railmlCommands: readonly Command[] = [
  { id: 'importRailml', label: 'railML 3.2…', run: () => emit('railml-request', { action: 'import' }) },
  { id: 'exportRailml', label: 'railML 3.2…', run: () => emit('railml-request', { action: 'export' }) },
];

/** src/share/install-sharing.ts: Share dialog (link with the diagram, downloads, cloud providers). */
export const shareCommands: readonly Command[] = [{ id: 'share', label: 'Share…', run: () => emit('share-request') }];
