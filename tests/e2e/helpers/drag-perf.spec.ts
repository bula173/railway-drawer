/**
 * @file drag-perf.spec.ts
 * @brief On-demand drag smoothness measurement (DRAG_PERF=1): ~200 shapes (rectangles, ERTMS
 *        signals, tracks), one signal dragged for 2 s with real mouse moves (60 per second); long
 *        tasks (PerformanceObserver 'longtask'), their total duration and the slowest frame are
 *        printed and appended to DRAG_PERF_OUT when set.
 */
import { test, expect } from '@playwright/test';
import { appendFileSync } from 'node:fs';
import { freshApp, inTab } from './press-probe-lib';

test.use({ viewport: { width: 1600, height: 1100 } });

test('drag smoothness with ~200 shapes (measurement)', async ({ page }) => {
  test.skip(!process.env.DRAG_PERF, 'set DRAG_PERF=1 to measure');
  test.setTimeout(120_000);
  await freshApp(page);
  // one ERTMS signal from the palette, cloned with tracks and rectangles into a 200-cell grid
  const sec = page.locator('#drawio-palette-container section[data-palette-id="ertms"]');
  if ((await sec.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') await sec.locator('.rd-dp-header').click();
  await sec.locator('.rd-dp-item[title="Signal Right 3"]').first().click();
  await sec.locator('.rd-dp-item[title="Track"]').first().click();
  const sig = await inTab<string>(page, `
    const m = graph.getDataModel(); const layer = graph.getDefaultParent();
    const kids = layer.children.slice();
    const signal = kids.find((c) => c.isVertex()); const track = kids.find((c) => c.isEdge());
    m.beginUpdate();
    try {
      for (let i = 0; i < 100; i++) {
        const [s] = graph.cloneCells([signal]); m.add(layer, s);
        const g = s.getGeometry().clone(); g.x = 40 + (i % 10) * 110; g.y = 40 + Math.floor(i / 10) * 70; m.setGeometry(s, g);
      }
      for (let i = 0; i < 60; i++) {
        const [t] = graph.cloneCells([track]); m.add(layer, t);
        const g = t.getGeometry().clone(); const P = graph.view.translate.constructor;
        g.sourcePoint = new P(20 + (i % 4) * 280, 30 + Math.floor(i / 4) * 70); g.targetPoint = new P(260 + (i % 4) * 280, 30 + Math.floor(i / 4) * 70);
        m.setGeometry(t, g);
      }
      for (let i = 0; i < 60; i++) graph.insertVertex(layer, null, 'R' + i, 40 + (i % 10) * 110, 800 + Math.floor(i / 10) * 50, 60, 30, 'rounded=0;whiteSpace=wrap;html=1;');
    } finally { m.endUpdate(); }
    graph.clearSelection(); graph.zoomTo(1);
    return signal.id;`);
  expect(await inTab<number>(page, 'return graph.getDefaultParent().children.length;')).toBeGreaterThan(200);
  await inTab(page, 'graph.scrollCellToVisible(graph.getDataModel().getCell(arg), true);', sig);
  const c = await inTab<{ x: number; y: number }>(page, `
    const s = graph.view.getState(graph.getDataModel().getCell(arg)); const r = graph.container.getBoundingClientRect();
    return { x: r.left + s.getCenterX() - graph.container.scrollLeft, y: r.top + s.getCenterY() - graph.container.scrollTop };`, sig);
  // time spent in the graph's mouse-move handling (all listeners: selection preview, snap, hits)
  await inTab(page, `
    window.__mm = [];
    const orig = graph.fireMouseEvent.bind(graph);
    graph.fireMouseEvent = (name, me, sender) => {
      const t = performance.now(); const r = orig(name, me, sender);
      if (name === 'mouseMove') window.__mm.push(performance.now() - t);
      return r;
    };`);
  const before = await inTab<number[]>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return [g.x, g.y];', sig);
  await page.evaluate(() => {
    const w = window as unknown as { __lt: number[]; __frames: number[] };
    w.__lt = []; w.__frames = [];
    new PerformanceObserver((list) => { for (const e of list.getEntries()) w.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: false });
    let last = performance.now();
    const tick = (t: number) => { w.__frames.push(t - last); last = t; if (w.__frames.length < 2000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  const t0 = Date.now();
  for (let i = 1; i <= 120; i++) {
    await page.mouse.move(c.x + Math.sin(i / 10) * 200, c.y + i * 2);
  }
  const ms = Date.now() - t0;
  await page.mouse.up();
  expect(await inTab<number[]>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return [g.x, g.y];', sig)).not.toEqual(before);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __lt: number[]; __frames: number[]; __mm: number[] };
    const f = w.__frames.slice(1);
    const mm = w.__mm;
    return { longTasks: w.__lt.length, longTaskMs: Math.round(w.__lt.reduce((a, b) => a + b, 0)), maxFrame: Math.round(Math.max(...f)), frames: f.length,
      moves: mm.length, avgMove: (mm.reduce((a, b) => a + b, 0) / Math.max(1, mm.length)).toFixed(2), maxMove: Math.max(0, ...mm).toFixed(1) };
  });
  const line = `${process.env.DRAG_PERF_LABEL ?? 'run'}: 120 moves in ${ms} ms, mouse-move handling avg ${r.avgMove} ms / max ${r.maxMove} ms (${r.moves}), long tasks ${r.longTasks} (${r.longTaskMs} ms), slowest frame ${r.maxFrame} ms`;
  console.log(line);
  if (process.env.DRAG_PERF_OUT) appendFileSync(process.env.DRAG_PERF_OUT, line + '\n');
});
