/**
 * Test helpers for the AI tools: an AiTarget on a jsdom test graph with undo history, snap to
 * track, a Railway Script session and the real ERTMS library (catalogue + templates).
 */
import { vi } from 'vitest';
import { fixture as scriptFixture } from '../../railway-script/__tests__/helpers';
import type { Fixture } from '../../railway-script/__tests__/helpers';
import { ertmsEntries } from '../../railml/__tests__/helpers';
import { exportModelToDrawioXml } from '../../services/drawio-xml';
import { ertmsElementsPaletteDef } from '../../ui/drawio-palette/ertms-source';
import { splitErtmsLibrary } from '../../ui/templates/ertms-templates';
import type { PaletteEntry } from '../../drawio-shapes/palettes';
import { ScenarioSet } from '../../scenarios/scenario-model';
import type { AiTarget, CatalogShape } from '../target';

export interface TestTarget extends AiTarget {
  fx: Fixture;
  downloads: Array<{ name: string; mime: string }>;
  scenarioSet: ScenarioSet;
  shown: Array<{ scenarioId: string; index: number }>;
  exported: Array<{ scenarioId: string; format: string }>;
  destroy(): void;
}

const GENERAL: PaletteEntry[] = [
  { id: 'general-0-rectangle', title: 'Rectangle', kind: 'vertex', width: 120, height: 60, style: 'rounded=0;whiteSpace=wrap;html=1;', shapeNames: [], cls: 'a', source: 'test' },
  { id: 'general-5-cylinder', title: 'Cylinder', kind: 'vertex', width: 60, height: 80, style: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;', shapeNames: ['cylinder3'], cls: 'a', tags: 'database db', source: 'test' },
];

export function catalogShapes(): CatalogShape[] {
  const ertms = ertmsElementsPaletteDef(ertmsEntries());
  return [
    ...GENERAL.map((entry) => ({ name: entry.id, title: entry.title, palette: 'General', entry })),
    ...ertms.entries.map((entry) => ({ name: entry.id, title: entry.title, palette: 'ERTMS', entry })),
  ];
}

export function createTestTarget(text = ''): TestTarget {
  const fx = scriptFixture(text);
  const downloads: TestTarget['downloads'] = [];
  const scenarioSet = new ScenarioSet();
  const shown: TestTarget['shown'] = [];
  const exported: TestTarget['exported'] = [];
  const target: TestTarget = {
    fx,
    downloads,
    scenarioSet,
    shown,
    exported,
    scenarios: () => scenarioSet,
    showScenario: (scenarioId, index) => {
      shown.push({ scenarioId, index });
    },
    exportScenario: async (scenarioId, format) => {
      exported.push({ scenarioId, format });
      return `Test diagram - ${scenarioSet.get(scenarioId)?.name ?? '?'}.${format === 'pdf' ? 'pdf' : 'html'}`;
    },
    graph: fx.graph,
    tabName: () => 'Test diagram',
    scriptStore: fx.store,
    scriptSession: async () => fx.session,
    undo: () => fx.commands.undo(),
    canUndo: () => fx.commands.canUndo(),
    nextUndoEdit: () => fx.commands.nextUndoEdit(),
    modelXml: () => exportModelToDrawioXml(fx.graph.getDataModel()),
    projectXml: () => `<mxfile><diagram name="Test diagram">${exportModelToDrawioXml(fx.graph.getDataModel())}</diagram></mxfile>`,
    catalog: { all: async () => catalogShapes() },
    templates: async () => splitErtmsLibrary(ertmsEntries()).templates,
    openTemplateInNewTab: vi.fn((t) => t.name),
    renderPng: vi.fn(async () => 'iVBORw0KGgo='),
    renderSvg: vi.fn(async () => '<svg xmlns="http://www.w3.org/2000/svg"/>'),
    download: (name, _content, mime) => {
      downloads.push({ name, mime });
    },
    destroy: () => fx.destroy(),
  };
  return target;
}
