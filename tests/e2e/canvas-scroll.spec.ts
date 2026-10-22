/**
 * @file canvas-scroll.spec.ts
 * @brief The scrolling canvas (src/ui/canvas-scroll.ts) with real input (page.mouse / keyboard):
 *        the tab's graph div scrolls (not #graph-container) once zoomed in, with visible 12 px
 *        scrollbars (thumb >= 3:1 on the track, light and dark); a wheel scrolls, Shift+wheel
 *        scrolls horizontally, Ctrl+wheel zooms around the pointer, the zoom buttons / menu keep the
 *        view centre, Fit centres the content; content at negative coordinates is reachable and the
 *        canvas scrolls beyond the content on every side; the grid covers a far scrolled area and
 *        follows the zoom; hover arrows and the km ruler stay on their shapes when scrolled and
 *        zoomed; dragging near the edge autoscrolls; Space+drag and middle-drag pan; a tab keeps its
 *        scroll position across a tab switch.
 *
 * Reads the graph through the dev server's module graph (like hover-arrows.spec.ts). Any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { clickMenuItem } from './menu-helpers';

const MODEL_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="80" y="80" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="B" value="Bravo" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="900" y="560" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="C" value="Charlie" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="1500" y="900" width="120" height="60" as="geometry"/></mxCell>
</root></mxGraphModel>`;

const NEGATIVE_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="N" value="West" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="-600" y="-400" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="80" y="80" width="120" height="60" as="geometry"/></mxCell>
</root></mxGraphModel>`;

const TRACK_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<object label="" id="t1" rdKind="track" rdId="T1" rdKmStart="10" rdKmEnd="10.5"><mxCell style="endArrow=none;html=1;strokeWidth=4;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="100" y="200" as="sourcePoint"/><mxPoint x="600" y="200" as="targetPoint"/></mxGeometry></mxCell></object>
</root></mxGraphModel>`;

type Theme = 'light' | 'dark';

// Headless Chromium hides scrollbars by default (Playwright passes --hide-scrollbars): show them,
// they are part of what is tested here
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

async function freshApp(page: Page, theme: Theme = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('rd.theme', t);
  }, theme);
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Runs `body` (function body text) with `tab` = the active tab, `graph` and `arg`. */
async function inTab<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('tab', 'graph', 'arg', body)(tab, tab.graph, arg);
  }, { body, arg }) as Promise<T>;
}

async function loadModel(page: Page, xml: string): Promise<void> {
  await inTab(page, 'tab.saveLoadController.load(arg); graph.clearSelection();', xml);
}

interface View {
  scale: number; tx: number; ty: number;
  scrollLeft: number; scrollTop: number; scrollWidth: number; scrollHeight: number;
  clientWidth: number; clientHeight: number; offsetWidth: number; offsetHeight: number;
  /** Page position of the container's client (scrolling) area. */
  left: number; top: number;
}

function view(page: Page): Promise<View> {
  return inTab<View>(page, `const c = graph.container, r = c.getBoundingClientRect();
    return { scale: graph.view.scale, tx: graph.view.translate.x, ty: graph.view.translate.y,
      scrollLeft: c.scrollLeft, scrollTop: c.scrollTop, scrollWidth: c.scrollWidth, scrollHeight: c.scrollHeight,
      clientWidth: c.clientWidth, clientHeight: c.clientHeight, offsetWidth: c.offsetWidth, offsetHeight: c.offsetHeight,
      left: r.left + c.clientLeft, top: r.top + c.clientTop };`);
}

/** Page position of a graph point. */
function toPage(v: View, x: number, y: number): { x: number; y: number } {
  return { x: v.left + (x + v.tx) * v.scale - v.scrollLeft, y: v.top + (y + v.ty) * v.scale - v.scrollTop };
}

/** Graph point shown at the top-left corner of the view (independent of the automatic translate). */
function viewOrigin(v: View): { x: number; y: number } {
  return { x: v.scrollLeft / v.scale - v.tx, y: v.scrollTop / v.scale - v.ty };
}

/** Graph point at a page position. */
function toGraph(v: View, px: number, py: number): { x: number; y: number } {
  return { x: (px - v.left + v.scrollLeft) / v.scale - v.tx, y: (py - v.top + v.scrollTop) / v.scale - v.ty };
}

interface Box { x: number; y: number; width: number; height: number }

/** Page box of a cell's state. */
function cellBox(page: Page, id: string): Promise<Box> {
  return inTab<Box>(page, `const s = graph.view.getState(graph.getDataModel().getCell(arg));
    const c = graph.container, r = c.getBoundingClientRect();
    return { x: r.left + c.clientLeft + s.x - c.scrollLeft, y: r.top + c.clientTop + s.y - c.scrollTop, width: s.width, height: s.height };`, id);
}

function geometry(page: Page, id: string): Promise<Box> {
  return inTab<Box>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return { x: g.x, y: g.y, width: g.width, height: g.height };', id);
}

async function setScroll(page: Page, left: number, top: number): Promise<void> {
  await inTab(page, 'graph.container.scrollLeft = arg.left; graph.container.scrollTop = arg.top;', { left, top });
}

/** Decoded screenshot of a page area. */
async function shot(page: Page, clip: Box): Promise<PNG> {
  return PNG.sync.read(await page.screenshot({ clip }));
}

function pixel(png: PNG, x: number, y: number): [number, number, number] {
  const i = (png.width * y + x) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const lin = (v: string) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

test.describe('scrolling canvas (real input)', () => {
  test('zoomed in, the tab graph div scrolls (not #graph-container) with visible scrollbars', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    await page.locator('#zoom-level').selectOption('200');
    await expect.poll(async () => (await view(page)).scale).toBe(2);
    let v = await view(page);
    expect(v.scrollWidth).toBeGreaterThan(v.clientWidth);
    expect(v.scrollHeight).toBeGreaterThan(v.clientHeight);
    // the scrollbars take 12 px (always shown, not overlay bars)
    expect(v.offsetWidth - v.clientWidth).toBe(12);
    expect(v.offsetHeight - v.clientHeight).toBe(12);
    const outer = await page.locator('#graph-container').evaluate((el) => ({
      overflow: getComputedStyle(el).overflow, scrollW: el.scrollWidth, clientW: el.clientWidth,
      scrollH: el.scrollHeight, clientH: el.clientHeight,
    }));
    expect(outer.overflow).toBe('hidden');
    expect(outer.scrollW).toBeLessThanOrEqual(outer.clientW);
    expect(outer.scrollH).toBeLessThanOrEqual(outer.clientH);

    // 400 %: the whole drawing (and padding around it) can be scrolled to
    await inTab(page, 'graph.zoomTo(4);');
    v = await view(page);
    expect(v.scale).toBe(4);
    const c = await inTab<Box>(page, 'const s = graph.view.getState(graph.getDataModel().getCell("C")); return { x: s.x, y: s.y, width: s.width, height: s.height };');
    expect(c.x + c.width).toBeLessThan(v.scrollWidth - v.clientWidth / 2);
    expect(c.y + c.height).toBeLessThan(v.scrollHeight - v.clientHeight / 2);
    expect(errors).toEqual([]);
  });

  test('wheel scrolls, Shift+wheel scrolls horizontally, Ctrl+wheel zooms around the pointer', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    await page.locator('#zoom-level').selectOption('150');
    let v = await view(page);
    const pointer = { x: v.left + 300, y: v.top + 220 };
    await page.mouse.move(pointer.x, pointer.y);

    // plain wheel: vertical scroll, nothing zooms
    const before = v;
    await page.mouse.wheel(0, 240);
    await expect.poll(async () => (await view(page)).scrollTop).toBeGreaterThanOrEqual(before.scrollTop + 200);
    v = await view(page);
    expect(v.scrollLeft).toBe(before.scrollLeft);
    expect(v.scale).toBe(1.5);

    // Shift+wheel: horizontal scroll
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, 200);
    await page.keyboard.up('Shift');
    await expect.poll(async () => (await view(page)).scrollLeft).toBeGreaterThanOrEqual(v.scrollLeft + 150);
    expect((await view(page)).scale).toBe(1.5);

    // Ctrl+wheel: zoom in / out, the graph point under the pointer stays under it
    for (const [delta, grows] of [[-100, true], [-100, true], [-100, true], [100, false], [100, false]] as const) {
      const v0 = await view(page);
      const g = toGraph(v0, pointer.x, pointer.y);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, delta);
      await page.keyboard.up('Control');
      await expect.poll(async () => (await view(page)).scale !== v0.scale).toBe(true);
      const v1 = await view(page);
      expect(v1.scale > v0.scale).toBe(grows);
      const p = toPage(v1, g.x, g.y);
      expect(Math.abs(p.x - pointer.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(p.y - pointer.y)).toBeLessThanOrEqual(3);
    }
  });

  test('zoom buttons and View menu keep the view centre; Fit centres the content', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    await setScroll(page, (await view(page)).scrollLeft + 150, (await view(page)).scrollTop + 100);
    const keepsCentre = async (act: () => Promise<void>) => {
      const v0 = await view(page);
      const mid = { x: v0.left + v0.clientWidth / 2, y: v0.top + v0.clientHeight / 2 };
      const g = toGraph(v0, mid.x, mid.y);
      await act();
      await expect.poll(async () => (await view(page)).scale !== v0.scale).toBe(true);
      const v1 = await view(page);
      const p = toPage(v1, g.x, g.y);
      expect(Math.abs(p.x - (v1.left + v1.clientWidth / 2))).toBeLessThanOrEqual(3);
      expect(Math.abs(p.y - (v1.top + v1.clientHeight / 2))).toBeLessThanOrEqual(3);
    };
    await keepsCentre(() => page.locator('#btn-zoom-in').click());
    await keepsCentre(() => page.locator('#btn-zoom-in').click());
    await keepsCentre(() => page.locator('#btn-zoom-out').click());
    await keepsCentre(() => clickMenuItem(page, 'view', 'zoomIn'));
    await keepsCentre(async () => { await page.locator('#zoom-level').selectOption('50'); });

    // View > Fit to Window: the content fits and is centred
    await clickMenuItem(page, 'view', 'fitWindow');
    const v = await view(page);
    const a = await cellBox(page, 'A');
    const c = await cellBox(page, 'C');
    expect(a.x).toBeGreaterThanOrEqual(v.left);
    expect(a.y).toBeGreaterThanOrEqual(v.top);
    expect(c.x + c.width).toBeLessThanOrEqual(v.left + v.clientWidth);
    expect(c.y + c.height).toBeLessThanOrEqual(v.top + v.clientHeight);
    expect(Math.abs((a.x + c.x + c.width) / 2 - (v.left + v.clientWidth / 2))).toBeLessThanOrEqual(3);
    expect(Math.abs((a.y + c.y + c.height) / 2 - (v.top + v.clientHeight / 2))).toBeLessThanOrEqual(3);
  });

  test('content at negative coordinates is reachable; the canvas scrolls beyond the content', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, NEGATIVE_XML);
    // the load shows the content's top-left corner: the shape left of / above the origin is visible
    let v = await view(page);
    let n = await cellBox(page, 'N');
    expect(n.x).toBeGreaterThanOrEqual(v.left);
    expect(n.y).toBeGreaterThanOrEqual(v.top);
    await page.mouse.click(n.x + n.width / 2, n.y + n.height / 2);
    expect(await inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id);')).toEqual(['N']);
    // there is room to scroll further left and up than the content
    expect(v.scrollLeft).toBeGreaterThan(100);
    expect(v.scrollTop).toBeGreaterThan(100);
    await setScroll(page, 0, 0);
    n = await cellBox(page, 'N');
    v = await view(page);
    expect(n.x - v.left).toBeGreaterThan(v.clientWidth / 2);
    expect(n.y - v.top).toBeGreaterThan(v.clientHeight / 2);

    // also at 400 %, the shape can be scrolled to on both sides and clicked
    await inTab(page, 'graph.clearSelection(); graph.zoomTo(4);');
    const s = await inTab<Box>(page, 'const s = graph.view.getState(graph.getDataModel().getCell("N")); return { x: s.x, y: s.y, width: s.width, height: s.height };');
    v = await view(page);
    expect(s.x).toBeGreaterThan(v.clientWidth / 2);
    await setScroll(page, s.x - 40, s.y - 40);
    n = await cellBox(page, 'N');
    await page.mouse.click(n.x + 20, n.y + 20);
    expect(await inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id);')).toEqual(['N']);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`grid in a far scrolled area follows the zoom; scrollbars visible (${theme})`, async ({ page }) => {
      await freshApp(page, theme);
      await loadModel(page, MODEL_XML);
      await page.locator('#zoom-level').selectOption('200');
      await expect.poll(async () => (await view(page)).scale).toBe(2);
      await inTab(page, 'const c = graph.container; c.scrollLeft = c.scrollWidth; c.scrollTop = c.scrollHeight;');
      const v = await view(page);
      expect(v.scrollLeft).toBeGreaterThan(1000);
      // An empty 200 x 120 area at the far bottom-right corner (beyond the content)
      const clip = { x: Math.round(v.left + v.clientWidth - 230), y: Math.round(v.top + v.clientHeight - 150), width: 200, height: 120 };
      const png = await shot(page, clip);
      const bg = theme === 'light' ? [255, 255, 255] : [0x12, 0x12, 0x12];
      const isLine = (x: number, y: number) => pixel(png, x, y).some((ch, i) => Math.abs(ch - bg[i]) > 3);
      // grid cells of 10 graph units = 20 px at 200 %: lines in every 20 px column band, gaps between
      const gx = toGraph(v, clip.x, clip.y);
      const firstLine = Math.round(toPage(v, Math.ceil(gx.x / 10) * 10, 0).x - clip.x);
      const row = 10;
      let lineCols = 0;
      for (let x = firstLine; x < png.width - 1; x += 20) {
        if (isLine(x, row) || isLine(x + 1, row) || (x > 0 && isLine(x - 1, row))) lineCols++;
        expect(isLine(x + 10, row)).toBe(false);
      }
      expect(lineCols).toBeGreaterThanOrEqual(8);

      // Scrollbars: thumb >= 3:1 on the track, and painted
      const tokens = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return { thumb: s.getPropertyValue('--rd-canvas-scrollbar-thumb'), track: s.getPropertyValue('--rd-canvas-scrollbar-track') };
      });
      expect(contrast(tokens.thumb, tokens.track)).toBeGreaterThanOrEqual(3);
      // the vertical bar (scrolled to the bottom: thumb at the bottom end, track at the top)
      const bar = await shot(page, { x: Math.round(v.left + v.clientWidth), y: Math.round(v.top), width: 12, height: Math.round(v.clientHeight) });
      const hex = (p: number[]) => `#${p.map((ch) => ch.toString(16).padStart(2, '0')).join('')}`;
      expect(hex(pixel(bar, 6, 3))).toBe(tokens.track.trim());
      expect(hex(pixel(bar, 6, bar.height - 30))).toBe(tokens.thumb.trim());
    });
  }

  test('hover arrows and the km ruler stay on their shapes when scrolled and zoomed', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    await page.locator('#zoom-level').selectOption('200');
    // A (80, 80) 137 / 103 px from the view's top-left corner
    const v0 = await view(page);
    await setScroll(page, Math.round((80 + v0.tx) * 2 - 137), Math.round((80 + v0.ty) * 2 - 103));
    const a = await cellBox(page, 'A');
    await page.mouse.move(a.x + 10, a.y + 8);
    await page.mouse.move(a.x + a.width / 2 + 5, a.y + a.height / 2 + 3, { steps: 4 });
    await expect(page.locator('.rd-hover-arrow:visible')).toHaveCount(4);
    const east = (await page.locator('.rd-hover-arrow[data-direction="east"]').boundingBox())!;
    expect(east.x).toBeGreaterThan(a.x + a.width);
    expect(east.x).toBeLessThan(a.x + a.width + 16);
    expect(Math.abs(east.y + east.height / 2 - (a.y + a.height / 2))).toBeLessThanOrEqual(1);
    const north = (await page.locator('.rd-hover-arrow[data-direction="north"]').boundingBox())!;
    expect(Math.abs(north.x + north.width / 2 - (a.x + a.width / 2))).toBeLessThanOrEqual(1);
    expect(north.y + north.height).toBeLessThan(a.y);
    // scrolling hides them (draw.io)
    await page.mouse.wheel(0, 120);
    await expect(page.locator('.rd-hover-arrow:visible')).toHaveCount(0);

    // km ruler of the selected track
    await loadModel(page, TRACK_XML);
    await inTab(page, "graph.setSelectionCell(graph.getDataModel().getCell('t1'));");
    await clickMenuItem(page, 'railway', 'railwayRoute:toggleKmRuler');
    const ruler = page.locator('.rd-km-ruler-overlay .rd-km-ruler[data-track="T1"]');
    await expect(ruler).toHaveCount(1);
    // The ruler (ticks, km labels) is drawn in graph units: its box relative to the track, divided
    // by the zoom, stays the same after zooming and scrolling
    const offsets = async () => {
      const v = await view(page);
      const from = toPage(v, 100, 200);
      const to = toPage(v, 600, 200);
      const r = (await ruler.boundingBox())!;
      return { scale: v.scale, left: (r.x - from.x) / v.scale, right: (r.x + r.width - to.x) / v.scale,
        top: (r.y - from.y) / v.scale, bottom: (r.y + r.height - from.y) / v.scale };
    };
    const base = await offsets();
    expect(Math.abs(base.left)).toBeLessThanOrEqual(40);
    expect(Math.abs(base.right)).toBeLessThanOrEqual(40);
    expect(base.top).toBeLessThanOrEqual(0);
    expect(base.bottom).toBeGreaterThanOrEqual(0);
    const check = async () => {
      const o = await offsets();
      for (const k of ['left', 'right', 'top', 'bottom'] as const) {
        expect(Math.abs(o[k] - base[k]) * o.scale).toBeLessThanOrEqual(2);
      }
    };
    await check();
    await page.locator('#btn-zoom-in').click();
    await check();
    const v = await view(page);
    await setScroll(page, v.scrollLeft - 55, v.scrollTop + 41);
    await check();
    await clickMenuItem(page, 'railway', 'railwayRoute:toggleKmRuler');
  });

  test('dragging a shape or a rubber band near the edge autoscrolls', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const v0 = await view(page);
    const geo0 = await geometry(page, 'A');
    const a = await cellBox(page, 'A');
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    const edgeX = v0.left + v0.clientWidth - 6;
    await page.mouse.move(edgeX - 100, a.y + a.height / 2, { steps: 5 });
    for (let i = 0; i < 12; i++) await page.mouse.move(edgeX - (i % 2), a.y + a.height / 2 + (i % 2));
    await page.mouse.up();
    // (the drop may move the automatic translate: compare the graph point at the view's corner)
    const v1 = await view(page);
    expect(viewOrigin(v1).x).toBeGreaterThan(viewOrigin(v0).x + 50);
    const geo1 = await geometry(page, 'A');
    expect(geo1.x).toBeGreaterThan(geo0.x + v0.clientWidth - 300);

    // rubber band from an empty spot towards the bottom edge
    const start = toPage(v1, toGraph(v1, v1.left + 200, 0).x, toGraph(v1, 0, v1.top + 300).y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const edgeY = v1.top + v1.clientHeight - 6;
    await page.mouse.move(start.x + 60, edgeY - 60, { steps: 5 });
    for (let i = 0; i < 12; i++) await page.mouse.move(start.x + 60 + (i % 2), edgeY - (i % 2));
    await page.mouse.up();
    expect(viewOrigin(await view(page)).y).toBeGreaterThan(viewOrigin(v1).y + 50);
  });

  test('Space+drag and middle-button drag pan; the shape under the pointer stays put', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const v0 = await view(page);
    const geo0 = await geometry(page, 'A');
    const a = await cellBox(page, 'A');
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.keyboard.down('Space');
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 - 200, a.y + a.height / 2 - 100, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    const v1 = await view(page);
    expect(Math.abs(v1.scrollLeft - (v0.scrollLeft + 200))).toBeLessThanOrEqual(2);
    expect(Math.abs(v1.scrollTop - (v0.scrollTop + 100))).toBeLessThanOrEqual(2);
    expect(await geometry(page, 'A')).toEqual(geo0);
    expect(await inTab<number>(page, 'return graph.getSelectionCount();')).toBe(0);

    const p = { x: v1.left + 400, y: v1.top + 300 };
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(p.x + 120, p.y + 60, { steps: 8 });
    await page.mouse.up({ button: 'middle' });
    const v2 = await view(page);
    expect(Math.abs(v2.scrollLeft - (v1.scrollLeft - 120))).toBeLessThanOrEqual(2);
    expect(Math.abs(v2.scrollTop - (v1.scrollTop - 60))).toBeLessThanOrEqual(2);
    expect(v2.scale).toBe(1);
  });

  test('a tab keeps its zoom and scroll position across a tab switch', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    await page.locator('#zoom-level').selectOption('150');
    const v = await view(page);
    await setScroll(page, v.scrollLeft + 210, v.scrollTop + 130);
    const before = await view(page);
    const firstTab = page.locator('#tabs-container .tab-button.active');
    const firstName = (await firstTab.textContent())?.trim() ?? '';
    await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      registry.ServiceRegistry.getTabManager().openNewTab();
    });
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
    await page.locator('#tabs-container .tab-button', { hasText: firstName }).first().click();
    // the same graph point at the view's corner (the padding, hence the translate, may follow a
    // changed canvas height)
    await expect.poll(async () => Math.abs(viewOrigin(await view(page)).x - viewOrigin(before).x)).toBeLessThanOrEqual(1);
    const after = await view(page);
    expect(Math.abs(viewOrigin(after).y - viewOrigin(before).y)).toBeLessThanOrEqual(1);
    expect(after.scale).toBe(1.5);
  });
});
