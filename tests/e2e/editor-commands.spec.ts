/**
 * @file editor-commands.spec.ts
 * @brief Editor commands that called maxGraph APIs which do not exist in 0.10.3:
 *        Arrange > Bring Forward / Send Backward (+ To Front / To Back), Edit > Select All and
 *        Ctrl+A, File > Export as PNG/SVG (light rendering on white also in dark mode), the JSON
 *        export of the active tab, and renaming the project in the top bar (kept over a reload).
 *
 * The graph is read through the dev server's module graph (`import('/src/...')`, as in
 * style-edit.spec.ts). Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

/** Four vertices A..D (z-order A bottom .. D top), an edge A->B and a group G with one child. */
const MODEL_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="B" value="Bravo" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="220" y="40" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="C" value="Charlie" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="160" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="D" value="Delta" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="220" y="160" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="E" value="" style="endArrow=classic;html=1;" edge="1" parent="1" source="A" target="B"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel>`;

const GROUP_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="G" value="" style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="220" y="40" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="G1" value="Inner" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="G"><mxGeometry width="120" height="60" as="geometry"/></mxCell>
</root></mxGraphModel>`;

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

/** Runs `body` (function body text) with `tab` = the active tab and `arg`. */
async function inTab<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('tab', 'graph', 'arg', body)(tab, tab.graph, arg);
  }, { body, arg }) as Promise<T>;
}

async function loadModel(page: Page, xml: string): Promise<void> {
  await inTab(page, 'tab.saveLoadController.load(arg);', xml);
}

/** Child ids of the default layer, bottom to top. */
function layerOrder(page: Page): Promise<string[]> {
  return inTab<string[]>(page, 'return graph.getDefaultParent().children.map((c) => c.id);');
}

async function select(page: Page, ids: string[]): Promise<void> {
  await inTab(page, 'const m = graph.getDataModel(); graph.setSelectionCells(arg.map((id) => m.getCell(id)));', ids);
}

function selectedIds(page: Page): Promise<string[]> {
  return inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id).sort();');
}

async function menu(page: Page, menuName: string, action: string): Promise<void> {
  await page.locator(`.menu-item[data-menu="${menuName}"]`).click();
  await page.locator(`.menu-dropdown[data-menu="${menuName}"] .menu-dropdown-item[data-action="${action}"]`).click();
}

async function readDownload(download: Download): Promise<Buffer> {
  return (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks));
}

/** RGBA of PNG pixels (decoded in the page). */
function pngPixels(page: Page, png: Buffer, points: Array<[number, number]>): Promise<{ width: number; height: number; px: number[][] }> {
  return page.evaluate(async ({ b64, points }) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const px = points.map(([x, y]) => Array.from(ctx.getImageData(Math.round(x * img.width), Math.round(y * img.height), 1, 1).data));
    return { width: img.width, height: img.height, px };
  }, { b64: png.toString('base64'), points });
}

/** Parses an SVG document in the page: parse errors, labels, fills and the background. */
function inspectSvg(page: Page, svg: string): Promise<{ error: boolean; text: string; fills: string[]; background: string }> {
  return page.evaluate((svg) => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    return {
      error: doc.getElementsByTagName('parsererror').length > 0 || root.nodeName !== 'svg',
      text: root.textContent ?? '',
      fills: Array.from(doc.querySelectorAll('[fill]')).map((e) => (e.getAttribute('fill') ?? '').toLowerCase()),
      background: (root.getAttribute('style') ?? '').toLowerCase(),
    };
  }, svg);
}

test.describe('editor commands', () => {
  test('Arrange: Bring Forward / Send Backward step through the z-order (one undo each), To Front / To Back', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    expect(await layerOrder(page)).toEqual(['A', 'B', 'C', 'D', 'E']);

    await select(page, ['B']);
    await menu(page, 'arrange', 'bringForward');
    expect(await layerOrder(page)).toEqual(['A', 'C', 'B', 'D', 'E']);
    // one undo step
    await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
    await select(page, ['B']);
    await page.keyboard.press('Control+z');
    expect(await layerOrder(page)).toEqual(['A', 'B', 'C', 'D', 'E']);

    // adjacent selection moves together; the top-most cell is blocked and blocks the one below it
    await select(page, ['B', 'C']);
    await menu(page, 'arrange', 'bringForward');
    expect(await layerOrder(page)).toEqual(['A', 'D', 'B', 'C', 'E']);
    await select(page, ['C', 'E']);
    await menu(page, 'arrange', 'bringForward');
    expect(await layerOrder(page)).toEqual(['A', 'D', 'B', 'C', 'E']);

    await select(page, ['A', 'B']);
    await menu(page, 'arrange', 'sendBackward');
    // A is at the bottom (blocked), B moves below D
    expect(await layerOrder(page)).toEqual(['A', 'B', 'D', 'C', 'E']);
    await select(page, ['D', 'E']);
    await menu(page, 'arrange', 'sendBackward');
    expect(await layerOrder(page)).toEqual(['A', 'D', 'B', 'E', 'C']);
    await page.keyboard.press('Control+z');
    expect(await layerOrder(page)).toEqual(['A', 'B', 'D', 'C', 'E']);

    // To Front / To Back keep the relative order of the selected cells
    await select(page, ['B', 'A']);
    await menu(page, 'arrange', 'toFront');
    expect(await layerOrder(page)).toEqual(['D', 'C', 'E', 'A', 'B']);
    await select(page, ['B', 'E']);
    await menu(page, 'arrange', 'toBack');
    expect(await layerOrder(page)).toEqual(['E', 'B', 'D', 'C', 'A']);
    // the rendered stacking follows the model
    const domOrder = await inTab<string[]>(page, `
      const nodes = graph.getDefaultParent().children.map((c) => graph.view.getState(c)?.shape?.node);
      const all = [...graph.view.getDrawPane().querySelectorAll('g')];
      return graph.getDefaultParent().children.map((c, i) => [c.id, all.indexOf(nodes[i])]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([id]) => id);
    `);
    expect(domOrder.filter((id) => id !== 'E')).toEqual(['B', 'D', 'C', 'A']);
    expect(errors).toEqual([]);
  });

  test('Edit > Select All and Ctrl+A select every cell of the layer, not while typing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, GROUP_XML);

    await menu(page, 'edit', 'selectAll');
    // like draw.io (graph.selectAll(null, true)): the cells of the layer and their descendants
    expect(await selectedIds(page)).toEqual(['A', 'G', 'G1']);

    await inTab(page, 'graph.clearSelection();');
    await page.locator('#graph-container').click({ position: { x: 600, y: 400 } });
    await page.keyboard.press('Control+a');
    expect(await selectedIds(page)).toEqual(['A', 'G', 'G1']);

    // typing in a field: Ctrl+A selects the field's text, not the cells
    await inTab(page, 'graph.clearSelection();');
    await page.locator('.document-title').click();
    const input = page.locator('.document-title input');
    await expect(input).toBeFocused();
    await page.keyboard.press('Control+a');
    expect(await selectedIds(page)).toEqual([]);
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('File > Export as PNG / SVG download valid images on the diagram background, also in dark mode', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, MODEL_XML);

    for (const theme of ['light', 'dark'] as const) {
      if (theme === 'dark') {
        await menu(page, 'view', 'toggleDarkMode');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      }
      const [png] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'exportPng')]);
      expect(png.suggestedFilename()).toBe('Diagram 1.png');
      const pngBytes = await readDownload(png);
      expect(pngBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      // corner = background (white like draw.io), centre of Alpha (top left cell) = its own light fill
      const { width, height, px } = await pngPixels(page, pngBytes, [[0, 0], [0.08, 0.1]]);
      expect(width).toBeGreaterThan(300);
      expect(height).toBeGreaterThan(150);
      expect(px[0]).toEqual([255, 255, 255, 255]);
      // #dae8fc
      expect(px[1][0]).toBeGreaterThan(200);
      expect(px[1][2]).toBeGreaterThan(240);

      const [svg] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'exportSvg')]);
      expect(svg.suggestedFilename()).toBe('Diagram 1.svg');
      const svgText = (await readDownload(svg)).toString('utf8');
      const info = await inspectSvg(page, svgText);
      expect(info.error).toBe(false);
      for (const label of ['Alpha', 'Bravo', 'Charlie', 'Delta']) expect(info.text).toContain(label);
      expect(info.fills).toContain('#dae8fc');
      expect(info.background).toMatch(/background-color:\s*(#ffffff|rgb\(255, 255, 255\))/);
    }
    expect(errors).toEqual([]);
  });

  test('JSON export lists the cells of the active tab', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const json = await inTab<string>(page, 'return tab.saveLoadController.exportAsJson();');
    const data = JSON.parse(json) as { cells: Array<Record<string, unknown>> };
    const byId = new Map(data.cells.map((c) => [c.id, c]));
    expect(data.cells.length).toBe(7);
    expect(byId.get('A')).toMatchObject({ vertex: true, value: 'Alpha', parent: '1', geometry: { x: 40, y: 40, width: 120, height: 60 } });
    expect(byId.get('E')).toMatchObject({ edge: true, source: 'A', target: 'B', parent: '1' });
    expect(String(byId.get('A')?.style)).toContain('fillColor=#dae8fc');
  });

  test('renaming the project names the exported file and survives a reload', async ({ page }) => {
    await freshApp(page);
    await page.locator('.document-title').click();
    const input = page.locator('.document-title input');
    await input.fill('Signalling plan');
    await input.press('Enter');
    await expect(page.locator('.document-title')).toHaveText('Signalling plan');

    const [file] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
    expect(file.suggestedFilename()).toBe('Signalling plan.drawio');
    expect((await readDownload(file)).toString('utf8')).toContain('name="Signalling plan"');

    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await expect(page.locator('.document-title')).toHaveText('Signalling plan');
    const [again] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
    expect(again.suggestedFilename()).toBe('Signalling plan.drawio');

    // Escape keeps the old name
    await page.locator('.document-title').click();
    await page.locator('.document-title input').fill('Something else');
    await page.locator('.document-title input').press('Escape');
    await expect(page.locator('.document-title')).toHaveText('Signalling plan');
  });
});
