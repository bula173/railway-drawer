/**
 * @file railml.spec.ts
 * @brief railML 3.2 end to end: a small layout (tracks T1/T2, points W1, signals S1-S3, balise
 *        group with 2 balises, axle counter, route R1) is loaded; File > Export railML 3.2… shows the
 *        summary dialog and downloads a railML 3.2 file (parsed: topology, switch, signals, balise
 *        group, axle counter, route); File > Import railML… (file chooser) opens a hand-written
 *        railML file in a new tab with the expected cells, data and route; File > Open and a file
 *        drop of a .railml open new tabs too; re-export keeps the unknown railML content.
 *
 * Reads the graph through the dev server's module graph (like ertms-routes.spec.ts). Any port.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../src/railml/__tests__/fixtures');

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(
    async ({ body, arg }) => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
      return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
    },
    { body, arg }
  ) as Promise<T>;
}

async function menu(page: Page, name: string, action: string): Promise<void> {
  await clickMenuItem(page, name, action);
}

const obj = (id: string, attrs: string, style: string, geo: string, edge = false, parent = '1'): string =>
  `<object label="" id="${id}" ${attrs}><mxCell style="${style}" ${edge ? 'edge="1"' : 'vertex="1"'} parent="${parent}">${geo}</mxCell></object>`;
const line = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;
const box = (cx: number, cy: number, w = 20, h = 20): string => `<mxGeometry x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" as="geometry"/>`;
const TRACK = 'endArrow=none;html=1;strokeWidth=4;';
const SIGNAL = 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';

/*   S1>  BG1(B1 B2)  W1      AC1        S2>    T1 y=100, x 0..500, km 10.0-10.5
 *   ==================*=========================
 *                      \
 *                       *======================== S3>   T2 y=180, x 230..500
 */
const LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${obj('t1', 'rdKind="track" rdId="T1" rdKmStart="10" rdKmEnd="10.5"', TRACK, line(0, 100, 500, 100), true)}
${obj('t2', 'rdKind="track" rdId="T2" rdKmStart="20" rdKmEnd="20.27"', TRACK, line(230, 180, 500, 180), true)}
${obj('w1', 'rdKind="points" rdId="W1" rdPosition="normal" rdTrackId="T1"', TRACK, line(150, 100, 230, 180), true)}
${obj('s1', 'rdKind="signal" rdId="S1" rdSignalType="main" rdDirection="nominal" rdTrackId="T1" rdAspects="3"', SIGNAL, box(40, 114))}
${obj('s2', 'rdKind="signal" rdId="S2" rdSignalType="main" rdDirection="nominal" rdTrackId="T1"', SIGNAL, box(450, 114))}
${obj('s3', 'rdKind="signal" rdId="S3" rdSignalType="main" rdDirection="nominal" rdTrackId="T2"', SIGNAL, box(440, 194))}
${obj('bg1', 'rdKind="baliseGroup" rdId="BG1" rdNidC="353" rdNidBg="17" rdCount="2"', 'rounded=1;dashed=1;fillColor=none;', box(90, 100, 40, 24))}
${obj('b1', 'rdKind="balise" rdId="B1" rdGroupId="BG1" rdPosition="1" rdTrackId="T1"', 'rhombus;html=1;', box(82, 100, 12, 12))}
${obj('b2', 'rdKind="balise" rdId="B2" rdGroupId="BG1" rdPosition="2" rdTrackId="T1"', 'rhombus;html=1;', box(98, 100, 12, 12))}
${obj('ac1', 'rdKind="axleCounter" rdId="AC1" rdTrackId="T1"', 'ellipse;fillColor=#000000;', box(300, 100, 10, 10))}
${obj('j1', 'rdKind="insulatedJoint" rdId="J1" rdTrackId="T1"', 'group', box(400, 100, 10, 12))}
${obj('bg2', 'rdKind="baliseGroup" rdId="BG2" rdNidBg="18" rdCount="1"', 'rounded=1;dashed=1;fillColor=none;', box(350, 100, 40, 24))}
<mxCell id="rd-routes" value="Routes" parent="0"/>
${obj('r1', 'rdKind="route" rdId="R1" rdEntrySignal="S1" rdExitSignal="S3" rdPoints="W1:reverse" rdSections="T1, T2"', 'endArrow=block;strokeColor=#ff8f00;', line(40, 100, 440, 180), true, 'rd-routes')}
</root></mxGraphModel>`;

/** Counts of railML elements and a few attributes of the downloaded file (parsed in the page). */
async function inspectRailml(page: Page, xml: string): Promise<Record<string, unknown>> {
  return page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const NS = 'https://www.railml.org/schemas/3.2';
    const all = (n: string): Element[] => Array.from(doc.getElementsByTagNameNS(NS, n));
    const byId = (id: string): Element | undefined => all('*').find((e) => e.getAttribute('id') === id);
    const route = all('route')[0];
    const entryIl = route?.getElementsByTagNameNS(NS, 'routeEntry')[0]?.getElementsByTagNameNS(NS, 'refersTo')[0]?.getAttribute('ref') ?? '';
    return {
      root: doc.documentElement.localName,
      version: doc.documentElement.getAttribute('version'),
      parseError: doc.getElementsByTagName('parsererror').length,
      netElements: all('netElement').length,
      none: all('netRelation').filter((r) => r.getAttribute('navigability') === 'None').length,
      signals: all('signalIS').map((s) => s.getAttribute('id')),
      branchCourse: all('switchIS')[0]?.getAttribute('branchCourse'),
      groupID: all('isEurobaliseGroup')[0]?.getAttribute('groupID'),
      balises: all('balise').map((b) => b.getAttribute('belongsToBaliseGroup')),
      detector: all('trainDetectionElement')[0]?.getAttribute('type'),
      detectors: all('trainDetectionElement').map((e) => `${e.getAttribute('id')}:${e.getAttribute('type')}`),
      countries: all('isEurobaliseGroup').map((e) => e.getAttribute('countryID')),
      routeEntry: byId(entryIl)?.getElementsByTagNameNS(NS, 'refersTo')[0]?.getAttribute('ref'),
      facing: route?.getElementsByTagNameNS(NS, 'facingSwitchInPosition')[0]?.getAttribute('inPosition'),
      projections: all('spotElementProjection').length,
      operationalPoints: all('operationalPoint').length,
    };
  }, xml);
}

async function freshPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

test('railML export: summary dialog and a railML 3.2 download of the active tab', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await freshPage(page);
  await inGraph(page, 'tab.saveLoadController.load(arg);', LAYOUT);

  await menu(page, 'file', 'exportRailml');
  const dialog = page.locator('[data-testid="railml-export-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.rd-railml-counts')).toContainText('3 signals, 2 balises in 2 balise groups');
  await expect(dialog.locator('.rd-railml-counts')).toContainText('2 detection points');
  await expect(dialog.locator('[data-testid="railml-checks"]')).toContainText('Railway checks:');
  await expect(dialog.locator('.rd-railml-extension')).toBeChecked();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-railml-export-btn').click()]);
  expect(download.suggestedFilename()).toMatch(/\.railml$/);
  await expect(dialog).toHaveCount(0);
  const xml = await readFile(await download.path(), 'utf8');
  expect(xml).toContain('xmlns="https://www.railml.org/schemas/3.2"');
  const info = await inspectRailml(page, xml);
  expect(info).toMatchObject({
    root: 'railML',
    version: '3.2',
    parseError: 0,
    netElements: 4,
    none: 1,
    signals: ['sig_S1', 'sig_S2', 'sig_S3'],
    branchCourse: 'right',
    groupID: '17',
    balises: ['bg_BG1', 'bg_BG1'],
    detector: 'axleCounter',
    // the TC joint marker = insulated rail joint; BG2 has no NID_C: the diagram default 510
    detectors: ['tde_AC1:axleCounter', 'ij_J1:insulatedRailJoint'],
    countries: ['353', '510'],
    routeEntry: 'sig_S1',
    facing: 'right',
  });
  expect(pageErrors).toEqual([]);
});

test('railML import: file chooser -> new tab with the cells, data and route; re-export keeps unknown content', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await freshPage(page);

  const chooser = page.waitForEvent('filechooser');
  await menu(page, 'file', 'importRailml');
  await (await chooser).setFiles(resolve(FIXTURES, 'station-topology.railml'));
  await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
  await expect(page.locator('#tabs-container .tab-button.active')).toContainText('Station Arnau');
  const notes = page.locator('[data-testid="railml-import-dialog"]');
  await expect(notes).toBeVisible();
  await expect(notes.locator('.rd-railml-warnings')).toContainText('kept and written back');
  await notes.locator('.rd-railml-ok-btn').click();
  await expect(notes).toHaveCount(0);

  const summary = await inGraph<{ kinds: Record<string, number>; signal: Record<string, string>; route: Record<string, string>; routeLayer: string; groupChildren: number }>(
    page,
    `const cells = Object.values(graph.getDataModel().cells);
     const data = (c) => { const o = {}; for (const a of Array.from(c.value.attributes)) o[a.name] = a.value; return o; };
     const rail = cells.filter((c) => c.value && c.value.nodeType === 1 && c.value.getAttribute('rdKind'));
     const kinds = {};
     for (const c of rail) kinds[c.value.getAttribute('rdKind')] = (kinds[c.value.getAttribute('rdKind')] || 0) + 1;
     const signal = rail.find((c) => c.value.getAttribute('rdId') === '68A');
     const route = rail.find((c) => c.value.getAttribute('rdKind') === 'route');
     return { kinds, signal: data(signal), route: data(route), routeLayer: route.parent.id, groupChildren: signal.children ? signal.children.length : 0 };`
  );
  expect(summary.kinds).toEqual({ track: 2, points: 1, signal: 3, balise: 2, axleCounter: 1, insulatedJoint: 1, bufferStop: 2, levelCrossing: 1, baliseGroup: 1, trackSection: 1, route: 1 });
  expect(summary.signal).toMatchObject({ rdKind: 'signal', rdSignalType: 'main', rdDirection: 'nominal', rdKm: '0.1', rdTrackId: 'T01', rdRailmlId: 'sig01' });
  // drawn with the ERTMS library "Signal Right 3" (a group of stencils)
  expect(summary.groupChildren).toBeGreaterThan(3);
  expect(summary.route).toMatchObject({ rdEntrySignal: '68A', rdExitSignal: 'N3', rdPoints: '68W01:reverse' });
  expect(summary.routeLayer).toBe('rd-routes');

  // re-export: the unknown railML of the file is written back
  await menu(page, 'file', 'exportRailml');
  const dialog = page.locator('[data-testid="railml-export-dialog"]');
  await expect(dialog).toContainText('Kept from the imported railML file');
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-railml-export-btn').click()]);
  const info = await inspectRailml(page, await readFile(await download.path(), 'utf8'));
  expect(info).toMatchObject({ parseError: 0, operationalPoints: 1, signals: ['sig01', 'sig02', 'sig03'] });
  expect(pageErrors).toEqual([]);
});

test('railML via File > Open and drag and drop opens new tabs (visualization layout)', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await freshPage(page);
  const text = await readFile(resolve(FIXTURES, 'station-visualization.railml'), 'utf8');

  const chooser = page.waitForEvent('filechooser');
  await menu(page, 'file', 'open');
  await (await chooser).setFiles({ name: 'station.railml', mimeType: 'application/xml', buffer: Buffer.from(text) });
  await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
  await page.locator('[data-testid="railml-import-dialog"] .rd-railml-ok-btn').click();
  const centre = await inGraph<{ x: number; y: number }>(
    page,
    `const c = Object.values(graph.getDataModel().cells).find((x) => x.value && x.value.nodeType === 1 && x.value.getAttribute('rdId') === 'BS2');
     const g = c.geometry; return { x: g.x + g.width / 2, y: g.y + g.height / 2 };`
  );
  expect(centre).toEqual({ x: 747, y: 180 });

  // drop the same file on the canvas
  const dataTransfer = await page.evaluateHandle((t) => {
    const dt = new DataTransfer();
    dt.items.add(new File([t], 'dropped.railml', { type: 'application/xml' }));
    return dt;
  }, text);
  await page.locator('#graph-container').dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('#tabs-container .tab-button')).toHaveCount(3);
  await expect(page.locator('[data-testid="railml-import-dialog"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
