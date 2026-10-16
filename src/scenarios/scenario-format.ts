/**
 * @file scenario-format.ts
 * @brief Scenarios in a native draw.io file: one `<diagram>` page per step, after the main page.
 *
 * Layout of a saved tab:
 *   <diagram id=main name=<tab> rdScenarios='{"v":1,"scenarios":[{id,name,description},...]}'> (main page)
 *   <diagram id=<step id> name="<Scenario> / <n>. <step>" rdScenarioId rdScenarioName [rdScenarioDescription]
 *            rdStepId rdStepName [rdStepDescription]> <mxGraphModel/> </diagram>   (one per step, in order)
 *   ...preserved pages of the opened file (extraPages)...
 *
 * draw.io keeps unknown `<diagram>` attributes: a page's DOM node is kept as `DiagramPage.node` and
 * cloned when saving (jgraph/drawio v32.4.1 js/diagramly/Pages.js:12 `DiagramPage`,
 * js/diagramly/EditorUi.js:2520-2623 `getXmlFileData`: `pageNode.cloneNode(...)`); "Duplicate page"
 * copies them too (Pages.js:1894 `page.node.cloneNode(false)`), so duplicated step ids are made unique
 * on load. The main page's `rdScenarios` gives the scenario order and keeps scenarios without steps; every
 * step page also names its scenario, so steps survive even when that index is missing.
 */
import { xmlUtils } from '@maxgraph/core';
import type { ScenarioData, ScenarioStepData } from './scenario-model';
import { generateScenarioId, sanitizeScenarios } from './scenario-model';

export const SCENARIO_INDEX_ATTR = 'rdScenarios';
export const SCENARIO_ID_ATTR = 'rdScenarioId';
export const SCENARIO_NAME_ATTR = 'rdScenarioName';
export const SCENARIO_DESCRIPTION_ATTR = 'rdScenarioDescription';
export const STEP_ID_ATTR = 'rdStepId';
export const STEP_NAME_ATTR = 'rdStepName';
export const STEP_DESCRIPTION_ATTR = 'rdStepDescription';

const INDEX_VERSION = 1;

/** Page name of a step as draw.io shows it: "<Scenario> / <n>. <step>". */
export function scenarioStepPageName(scenarioName: string, index: number, stepName: string): string {
  return `${scenarioName} / ${index + 1}. ${stepName}`;
}

/** Attributes for the main page's `<diagram>` (none when there are no scenarios). */
export function scenarioIndexAttributes(scenarios: ScenarioData[]): Record<string, string> {
  if (scenarios.length === 0) return {};
  return {
    [SCENARIO_INDEX_ATTR]: JSON.stringify({
      v: INDEX_VERSION,
      scenarios: scenarios.map((s) => ({ id: s.id, name: s.name, description: s.description })),
    }),
  };
}

/** True for a `<diagram>` written as a scenario step page. */
export function isScenarioStepPage(page: Element): boolean {
  return page.hasAttribute(STEP_ID_ATTR) || page.hasAttribute(SCENARIO_ID_ATTR);
}

/**
 * Serialized `<diagram>` step pages for all scenarios, in order. Page ids are the step ids unless
 * already in `usedIds`; every id written is added to `usedIds`. Steps whose snapshot is not a
 * draw.io model are skipped (they cannot be written as a page).
 */
export function buildScenarioPages(scenarios: ScenarioData[], usedIds: Set<string>): string[] {
  const pages: string[] = [];
  const doc = document.implementation.createDocument(null, null, null);
  for (const scenario of scenarios) {
    scenario.steps.forEach((step, index) => {
      const modelDoc = new DOMParser().parseFromString(step.xml, 'text/xml');
      const model = modelDoc.documentElement;
      if (modelDoc.getElementsByTagName('parsererror').length > 0 || !model || model.nodeName !== 'mxGraphModel') {
        console.error('[Scenarios] Skipping a step whose snapshot is not a draw.io model:', step.name);
        return;
      }
      let id = step.id && !usedIds.has(step.id) ? step.id : generateScenarioId();
      while (usedIds.has(id)) id = generateScenarioId();
      usedIds.add(id);
      const diagram = doc.createElement('diagram');
      diagram.setAttribute('id', id);
      diagram.setAttribute('name', scenarioStepPageName(scenario.name, index, step.name));
      diagram.setAttribute(SCENARIO_ID_ATTR, scenario.id);
      diagram.setAttribute(SCENARIO_NAME_ATTR, scenario.name);
      if (scenario.description) diagram.setAttribute(SCENARIO_DESCRIPTION_ATTR, scenario.description);
      diagram.setAttribute(STEP_ID_ATTR, step.id);
      diagram.setAttribute(STEP_NAME_ATTR, step.name);
      if (step.description) diagram.setAttribute(STEP_DESCRIPTION_ATTR, step.description);
      diagram.appendChild(doc.importNode(model, true));
      modelDoc.childNodes.forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE) diagram.appendChild(doc.createComment(node.nodeValue ?? ''));
      });
      // getXml: newlines in attribute values (multi-line labels) must stay escaped
      pages.push(xmlUtils.getXml(diagram));
    });
  }
  return pages;
}

interface ScenarioHead {
  id: string;
  name: string;
  description: string;
}

/** The scenario list of a main page's `rdScenarios` attribute; [] when missing or malformed. */
export function readScenarioIndex(mainPage: Element | null | undefined): ScenarioHead[] {
  const raw = mainPage?.getAttribute(SCENARIO_INDEX_ATTR);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = typeof parsed === 'object' && parsed !== null ? (parsed as { scenarios?: unknown }).scenarios : null;
    if (!Array.isArray(list)) return [];
    return list
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null && typeof s.id === 'string')
      .map((s) => ({
        id: s.id as string,
        name: typeof s.name === 'string' ? s.name : '',
        description: typeof s.description === 'string' ? s.description : '',
      }));
  } catch {
    console.warn('[Scenarios] Ignoring a malformed scenario index on the main page');
    return [];
  }
}

/** "<Scenario> / <n>. <step>" -> "<step>" (for step pages without rdStepName). */
function stepNameFromPageName(pageName: string | null): string {
  if (!pageName) return '';
  const match = / \/ \d+\. (.*)$/.exec(pageName);
  return match ? match[1] : pageName;
}

/** One step page of a file: its `<diagram>` and the model XML read from it. */
export interface ScenarioStepPage {
  page: Element;
  xml: string;
}

/**
 * Rebuilds the scenarios from the main page's index and the step pages (in file order).
 * Scenarios keep the index order; scenarios only named by step pages follow in order of appearance.
 */
export function assembleScenarios(mainPage: Element | null | undefined, stepPages: ScenarioStepPage[]): ScenarioData[] {
  const scenarios: ScenarioData[] = readScenarioIndex(mainPage).map((head) => ({ ...head, steps: [] }));
  const byId = new Map<string, ScenarioData>();
  for (const s of scenarios) if (!byId.has(s.id)) byId.set(s.id, s);
  for (const { page, xml } of stepPages) {
    const scenarioName = page.getAttribute(SCENARIO_NAME_ATTR) ?? '';
    const scenarioId = page.getAttribute(SCENARIO_ID_ATTR) || `name:${scenarioName}`;
    let scenario = byId.get(scenarioId);
    if (!scenario) {
      scenario = {
        id: scenarioId.startsWith('name:') ? generateScenarioId('scn-') : scenarioId,
        name: scenarioName,
        description: page.getAttribute(SCENARIO_DESCRIPTION_ATTR) ?? '',
        steps: [],
      };
      byId.set(scenarioId, scenario);
      scenarios.push(scenario);
    }
    const step: ScenarioStepData = {
      id: page.getAttribute(STEP_ID_ATTR) || page.getAttribute('id') || '',
      name: page.getAttribute(STEP_NAME_ATTR) ?? stepNameFromPageName(page.getAttribute('name')),
      description: page.getAttribute(STEP_DESCRIPTION_ATTR) ?? '',
      xml,
    };
    scenario.steps.push(step);
  }
  // unique ids (draw.io's "Duplicate page" copies the step attributes), names, valid snapshots
  return sanitizeScenarios(scenarios);
}
