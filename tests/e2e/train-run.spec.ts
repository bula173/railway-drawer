/**
 * @file train-run.spec.ts
 * @brief Animated train run (Railway > Train Run…): a layout with sections TC1-TC4 (200 m each),
 *        signals S1-S3, routes R1 (S1->S2) and R2 (S2->S3) and train TR1 (ETCS L2, 72 km/h,
 *        100 m) is loaded with document.load; the run R1, R2 plays at 10×: the sections turn red
 *        and free again in order (sampled from the view), the train cell moves along the track, the
 *        scrubber shows the states at a time (rendered stroke red), the live drawing and its undo
 *        history stay untouched and Close shows it unchanged. "Create scenario from run" -> the
 *        Scenarios panel lists the steps, the scenario view shows them with text and UML, the
 *        saved file still has the drawing as it was (+ the step pages). "Keep final state" is one
 *        undo step. Any port; screenshots in test-results/train-run/.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

const SHOT_DIR = 'test-results/train-run';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    const trainRun = registry.ServiceRegistry.get('trainRun');
    return new Function('graph', 'tab', 'arg', 'trainRun', body)(tab.graph, tab, arg, trainRun);
  }, { body, arg }) as Promise<T>;
}

const obj = (id: string, attrs: string, style: string, geo: string, edge = false, parent = '1'): string =>
  `<object label="" id="${id}" ${attrs}><mxCell style="${style}" ${edge ? 'edge="1"' : 'vertex="1"'} parent="${parent}">${geo}</mxCell></object>`;
const line = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;
const SECTION = 'edgeStyle=none;endArrow=none;html=1;strokeColor=#000000;strokeWidth=6;';
const SIGNAL = 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';
const section = (id: string, x1: number, x2: number): string => obj(id.toLowerCase(), `rdKind="trackSection" rdId="${id}" rdLength="200"`, SECTION, line(x1, 100, x2, 100), true);
const signal = (id: string, cx: number): string => obj(id.toLowerCase(), `rdKind="signal" rdId="${id}" rdDirection="nominal"`, SIGNAL, `<mxGeometry x="${cx - 10}" y="110" width="20" height="20" as="geometry"/>`);

/**
 *  TR1   S1>   TC1         TC2    S2>   TC3     S3>  TC4
 *  [==]  |===========|===========|===========|===========|   y = 100, 200 m each
 *       60          260         460         660         860
 */
const LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${section('TC1', 60, 260)}
${section('TC2', 260, 460)}
${section('TC3', 460, 660)}
${section('TC4', 660, 860)}
${signal('S1', 60)}
${signal('S2', 460)}
${signal('S3', 660)}
${obj('tr1', 'rdKind="train" rdId="TR1" rdEtcsLevel="2" rdMaxSpeed="72" rdLength="100"', 'shape=ertms-train;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#404040;', '<mxGeometry x="0" y="70" width="50" height="20" as="geometry"/>')}
<mxCell id="rd-routes" value="Routes" parent="0"/>
${obj('r1', 'rdKind="route" rdId="R1" rdEntrySignal="S1" rdExitSignal="S2" rdSections="TC1, TC2" rdOverlap="TC3"', 'edgeStyle=none;endArrow=block;strokeColor=#ff8f00;strokeWidth=5;opacity=60;movable=0;', line(60, 60, 460, 60), true, 'rd-routes')}
${obj('r2', 'rdKind="route" rdId="R2" rdEntrySignal="S2" rdExitSignal="S3" rdSections="TC3" rdOverlap="TC4"', 'edgeStyle=none;endArrow=block;strokeColor=#ff8f00;strokeWidth=5;opacity=60;movable=0;', line(460, 60, 660, 60), true, 'rd-routes')}
</root></mxGraphModel>`;

async function openApp(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('rd.theme', 'light');
  });
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1, { timeout: 30_000 });
  await inGraph(page, 'tab.document.load(arg); tab.graphCommandService.clearHistory();', LAYOUT);
}

/** rdState / stroke drawn by the run view's graph for a cell. */
const viewCell = (page: Page, id: string): Promise<{ state: string; aspect: string; stroke: string; x: number; right: number }> =>
  inGraph(page, `
    const g = trainRun.getView().getGraph();
    const cell = g.getDataModel().getCell(arg);
    const st = g.view.getState(cell);
    const node = st?.shape?.node;
    const els = node ? [node, ...node.querySelectorAll('path, ellipse, rect')].filter((e) => e.getAttribute('visibility') !== 'hidden') : [];
    const strokeEl = els.find((e) => { const v = e.getAttribute('stroke'); return v && !['white', 'transparent', 'none'].includes(v.toLowerCase()); });
    const geo = cell.getGeometry();
    return {
      state: cell.value?.getAttribute?.('rdState') ?? '',
      aspect: cell.value?.getAttribute?.('rdAspect') ?? '',
      stroke: (strokeEl?.getAttribute('stroke') ?? '').toLowerCase(),
      x: geo?.x ?? 0,
      right: (geo?.x ?? 0) + (geo?.width ?? 0),
    };`, id);

const liveXml = (page: Page): Promise<string> => inGraph(page, 'return tab.document.serializeToXml();');

async function openRun(page: Page): Promise<ReturnType<Page['locator']>> {
  await clickMenuItem(page, 'railway', 'railwayRoute:trainRun');
  const view = page.locator('[data-testid="train-run-view"]');
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute('data-state', 'ready');
  return view;
}

test('train run R1, R2 at 10×: sections occupied and freed in order, train moves, close restores', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);
  const before = await liveXml(page);

  const view = await openRun(page);
  await expect(page.locator('body')).toHaveClass(/rd-train-run-viewing/);
  await expect(page.locator(`#graph-${await inGraph<string>(page, 'return tab.id;')}`)).toBeHidden();
  // defaults from TR1's data; the first route is preselected
  await expect(view.locator('[data-testid="train-run-train"]')).toHaveValue('tr1');
  await expect(view.locator('[data-testid="train-run-speed"]')).toHaveValue('72');
  await expect(view.locator('[data-testid="train-run-length"]')).toHaveValue('100');
  await expect(view.locator('[data-testid="train-run-routes"]')).toHaveValue('R1');
  await view.locator('[data-testid="train-run-routes"]').fill('R1, R2');
  await view.locator('[data-testid="train-run-routes"]').press('Tab');
  await expect(view.locator('.rd-trn-time')).toHaveText('0.0 s / 65.0 s');
  await expect(view.locator('[data-testid="train-run-events"] li')).toHaveCount(13);
  // t = 0: routes set (reserved green), S1 proceed, overlap TC4
  expect(await viewCell(page, 'tc1')).toMatchObject({ state: 'reserved', stroke: '#009e00' });
  expect((await viewCell(page, 'tc4')).state).toBe('overlap');
  expect((await viewCell(page, 's1')).aspect).toBe('proceed');
  await page.screenshot({ path: `${SHOT_DIR}/start.png` });

  // record every change of the occupied sections and the train's position while playing
  await inGraph(page, `
    const g = trainRun.getView().getGraph();
    const w = document.querySelector('[data-testid="train-run-view"]');
    const log = window.__trnLog = [{ t: Number(w.dataset.t), occ: w.dataset.occupied, x: g.getDataModel().getCell('tr1').getGeometry().x }];
    new MutationObserver(() => log.push({ t: Number(w.dataset.t), occ: w.dataset.occupied, x: g.getDataModel().getCell('tr1').getGeometry().x }))
      .observe(w, { attributes: true, attributeFilter: ['data-t'] });`);
  await view.locator('[data-testid="train-run-multiplier"]').selectOption('10');
  await view.locator('[data-testid="train-run-play"]').click();
  await expect(view).toHaveAttribute('data-playing', 'true');
  // (the log, not a poll of the attribute: a busy machine may skip a short state between two polls)
  const seen = (): Promise<string[]> => page.evaluate(() => (window as unknown as { __trnLog: Array<{ occ: string }> }).__trnLog.map((l) => l.occ));
  await expect.poll(seen, { timeout: 30_000 }).toContain('TC2,TC3');
  await page.screenshot({ path: `${SHOT_DIR}/playing.png` });
  // the live drawing is not touched while the run plays
  expect(await inGraph(page, "return graph.getDataModel().getCell('tc2').value.getAttribute('rdState') ?? '';")).toBe('');
  await expect(view).toHaveAttribute('data-playing', 'false', { timeout: 60_000 });
  await expect(view.locator('.rd-trn-time')).toHaveText('65.0 s / 65.0 s');
  const log = await page.evaluate(() => (window as unknown as { __trnLog: Array<{ t: number; occ: string; x: number }> }).__trnLog);
  const sequence = log.map((l) => l.occ).filter((occ, i, all) => i === 0 || occ !== all[i - 1]);
  expect(sequence).toEqual(['', 'TC1', 'TC1,TC2', 'TC2', 'TC2,TC3', 'TC3']);
  // the times of the changes (frames at 10×; a frame advances at most 0.25 s real = 2.5 s simulated)
  const firstAt = (occ: string): number => log.find((l) => l.occ === occ)!.t;
  expect(firstAt('TC1')).toBeGreaterThanOrEqual(5);
  expect(firstAt('TC1')).toBeLessThan(7.6);
  expect(firstAt('TC2')).toBeGreaterThanOrEqual(20);
  expect(firstAt('TC2')).toBeLessThan(22.6);
  expect(firstAt('TC3')).toBeGreaterThanOrEqual(30);
  // the train moved forward along the track, frame by frame
  const xs = log.map((l) => l.x);
  expect(new Set(xs).size).toBeGreaterThan(10);
  expect(xs.every((x, i) => i === 0 || x >= xs[i - 1])).toBe(true);
  const end = await viewCell(page, 'tr1');
  expect(end.right).toBeCloseTo(660, 0);
  // end state: TC3 occupied (the train stands there), TC1/TC2 released, overlap released, S1/S2 stop
  expect(await viewCell(page, 'tc3')).toMatchObject({ state: 'occupied', stroke: '#ff0000' });
  expect(await viewCell(page, 'tc1')).toMatchObject({ state: '', stroke: '#000000' });
  expect((await viewCell(page, 'tc4')).state).toBe('');
  expect((await viewCell(page, 's2')).aspect).toBe('');
  await expect(view.locator('.rd-trn-event-current')).toContainText('Overlap TC4 released');

  // scrubber: t = 17 s -> TC1 and TC2 occupied (red), the train's head at 240 m
  await view.locator('[data-testid="train-run-scrubber"]').evaluate((input: HTMLInputElement) => {
    input.value = '17';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(view).toHaveAttribute('data-occupied', 'TC1,TC2');
  await expect(view).toHaveAttribute('data-head-m', '240');
  expect(await viewCell(page, 'tc1')).toMatchObject({ state: 'occupied', stroke: '#ff0000' });
  expect(await viewCell(page, 'tc2')).toMatchObject({ state: 'occupied', stroke: '#ff0000' });
  expect((await viewCell(page, 'tr1')).right).toBeCloseTo(300, 0);
  await page.screenshot({ path: `${SHOT_DIR}/scrubbed.png` });
  // next event button and keys
  await view.locator('[data-testid="train-run-step"]').click();
  await expect(view).toHaveAttribute('data-t', '20.0');
  await page.keyboard.press('ArrowLeft');
  await expect(view).toHaveAttribute('data-t', '15.0');

  // Close (Esc): the live drawing is shown exactly as it was, no undo step
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/rd-train-run-viewing/);
  expect(await liveXml(page)).toBe(before);
  expect(await inGraph(page, 'return tab.graphCommandService.canUndo();')).toBe(false);
  expect(errors).toEqual([]);
});

test('create scenario from run: steps in the Scenarios panel and the view; export unaffected; keep final state = one undo step', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);
  const before = await liveXml(page);
  // the selected route is preselected
  await inGraph(page, "graph.setSelectionCells([graph.getDataModel().getCell('r1')]);");
  const view = await openRun(page);
  await expect(view.locator('[data-testid="train-run-routes"]')).toHaveValue('R1');
  await view.locator('[data-testid="train-run-create-scenario"]').click();
  const panel = page.locator('#scenarios-panel');
  await expect(panel).toBeVisible();
  const item = panel.locator('.rd-scn-item', { hasText: 'Train run R1' });
  await expect(item.locator('.rd-scn-count')).toHaveText('6 steps');
  await item.locator('.rd-scn-toggle').click();
  await expect(item.locator('.rd-scn-step-name')).toHaveText([
    'Route R1 set',
    'Departure, S1 to stop, TC1 occupied',
    'TC2 occupied',
    'TC1 freed',
    'Arrival at S2',
    'Overlap TC3 released',
  ]);
  // the run view is still open and the live drawing untouched
  await expect(view).toBeVisible();
  await view.locator('[data-testid="train-run-close"]').click();
  await expect(view).toBeHidden();
  expect(await liveXml(page)).toBe(before);

  // the scenario view shows the steps with their drawing, text and UML
  await item.locator('.rd-scn-play').click();
  const banner = page.locator('.rd-scn-banner-title');
  await expect(banner).toHaveText('Train run R1 — step 1/6: Route R1 set');
  await page.keyboard.press('ArrowRight');
  await expect(banner).toHaveText('Train run R1 — step 2/6: Departure, S1 to stop, TC1 occupied');
  await expect(page.locator('.rd-scn-side-text')).toContainText('TC1 occupied (head enters)');
  await expect(page.locator('.rd-scn-side-text')).toContainText('Speed: 72 km/h');
  await expect(page.locator('.rd-scn-side-uml svg')).toHaveCount(1);
  await expect(page.locator('.rd-scn-side-uml')).toContainText('position report');
  await page.screenshot({ path: `${SHOT_DIR}/scenario-step.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="scenario-view"]')).toBeHidden();

  // the saved file: the drawing as before (no states, train in place) + 6 step pages
  const project = await inGraph<string>(page, 'return tab.document.getProjectXml();');
  const pages = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return Array.from(doc.getElementsByTagName('diagram')).map((d) => d.getAttribute('name') ?? '');
  }, project);
  expect(pages.slice(1)).toEqual([
    'Train run R1 / 1. Route R1 set',
    'Train run R1 / 2. Departure, S1 to stop, TC1 occupied',
    'Train run R1 / 3. TC2 occupied',
    'Train run R1 / 4. TC1 freed',
    'Train run R1 / 5. Arrival at S2',
    'Train run R1 / 6. Overlap TC3 released',
  ]);
  expect(await liveXml(page)).not.toContain('rdState=');

  // Keep final state: one undo step on the live drawing
  await openRun(page);
  await page.locator('[data-testid="train-run-keep"]').click();
  await expect(page.locator('[data-testid="train-run-view"]')).toBeHidden();
  expect(await inGraph(page, "return graph.getDataModel().getCell('tc2').value.getAttribute('rdState');")).toBe('occupied');
  expect(await inGraph(page, "const g = graph.getDataModel().getCell('tr1').getGeometry(); return g.x + g.width;")).toBeCloseTo(460, 0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => liveXml(page)).toBe(before);
  expect(await inGraph(page, 'return tab.graphCommandService.canUndo();')).toBe(false);
  expect(errors).toEqual([]);
});
