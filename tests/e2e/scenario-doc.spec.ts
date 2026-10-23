/**
 * @file scenario-doc.spec.ts
 * @brief "Scenario as a document": a scenario with 3 steps that change the drawing (add, move,
 *        restyle, remove), "Show changes" highlights + legend + Changes list in the step view,
 *        autoplay (Space, interval, stops at the last step), File > Export Scenario (PDF)… (real PDF:
 *        %PDF header, title page + >= 1 page per step, embedded Unicode font, UML as vectors) and the
 *        HTML slideshow from the panel button (every step, keyboard navigation); the step drawings
 *        of a multi-layer diagram show every visible layer (hidden ones left out), highlights on top.
 *
 * Runs on any port (dev server only: the graph is reached through the service registry module).
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { revealMenuItem } from './menu-helpers';

const HEXAGON = '#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]';

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

/** Runs `body` with `graph` = the active tab's maxGraph Graph. */
async function withGraph<T>(page: Page, body: string): Promise<T> {
  return page.evaluate(async (code) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    return new Function('graph', code)(graph);
  }, body) as Promise<T>;
}

async function addStep(page: Page, name: string, fields: { uml?: string; text?: string } = {}): Promise<void> {
  await page.locator('#scenarios-panel .rd-scn-add-step-details').click();
  const editor = page.locator('[data-testid="scenario-step-editor"]');
  await expect(editor).toBeVisible();
  await editor.locator('input[name="template-name"]').fill(name);
  if (fields.uml) await editor.locator('textarea[name="step-uml"]').fill(fields.uml);
  if (fields.text) await editor.locator('textarea[name="step-text"]').fill(fields.text);
  await editor.locator('.rd-tpl-btn-primary').click();
  await expect(editor).toHaveCount(0);
}

test.describe('scenario as a document', () => {
  test('show changes, autoplay, PDF and slides export', async ({ page }) => {
    test.setTimeout(150_000);
    const pageErrors: string[] = [];
    const warnings: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text());
    });
    await freshApp(page);

    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await panel.locator('.rd-scn-new').click();
    const dialog = page.locator('.rd-tpl-modal');
    await dialog.locator('input[name="template-name"]').fill('Przejazd');
    await dialog.locator('.rd-tpl-btn-primary').click();
    await expect(panel.locator('.rd-scn-name')).toHaveText('Przejazd');

    // step 1: one hexagon; step 2: it moved + a second one; step 3: first restyled, second removed
    await page.locator(HEXAGON).click({ modifiers: ['Alt'] }); // Alt: not placed next to / connected to the selection
    await expect.poll(() => withGraph<number>(page, 'return graph.getChildVertices(graph.getDefaultParent()).length;')).toBe(1);
    await addStep(page, 'Start', { text: '## Wjazd pociągu\n- sygnał **S1**\n\n| Obiekt | Stan |\n|---|---|\n| S1 | zielony |' });
    await withGraph(page, 'const [a] = graph.getChildVertices(graph.getDefaultParent()); graph.moveCells([a], 160, 0);');
    await page.locator(HEXAGON).click({ modifiers: ['Alt'] }); // Alt: not placed next to / connected to the selection
    await expect.poll(() => withGraph<number>(page, 'return graph.getChildVertices(graph.getDefaultParent()).length;')).toBe(2);
    await addStep(page, 'Move', { uml: '@startuml\nTrain -> RBC : MA Request\nRBC --> Train : Movement Authority\n@enduml' });
    await withGraph(
      page,
      `const [a, b] = graph.getChildVertices(graph.getDefaultParent());
       graph.setCellStyles('fillColor', '#ff0000', [a]);
       graph.removeCells([b]);`
    );
    await addStep(page, 'Restyle', { text: 'Koniec.' });
    await expect(panel.locator('.rd-scn-step-name')).toHaveText(['Start', 'Move', 'Restyle']);

    // view step 2 with "Show changes"
    const view = page.locator('[data-testid="scenario-view"]');
    const banner = page.locator('.rd-scn-banner-title');
    const legend = page.locator('[data-testid="scenario-diff-legend"]');
    const changes = page.locator('[data-testid="scenario-side-panel"] .rd-scn-side-changes');
    await panel.locator('.rd-scn-step').nth(1).click();
    await expect(banner).toHaveText('Przejazd — step 2/3: Move');
    await expect(legend).toBeHidden();
    const host = view.locator('.rd-scn-view-host svg');
    const plainShapes = await host.locator('path, rect, ellipse, polygon').count();
    await page.locator('.rd-scn-diff-toggle').check();
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('Added');
    await expect(legend).toContainText('Removed');
    await expect(view).toHaveAttribute('data-diff-added', '1');
    await expect(view).toHaveAttribute('data-diff-moved', '1');
    await expect(changes.locator('li[data-kind="added"]')).toHaveCount(1);
    await expect(changes.locator('li[data-kind="moved"]')).toContainText('moved');
    // the highlights are drawn in the view graph: green outline, blue outline
    await expect.poll(() => host.locator('[stroke="#2e7d32"]').count()).toBeGreaterThan(0);
    await expect.poll(() => host.locator('[stroke="#1565c0"]').count()).toBeGreaterThan(0);
    expect(await host.locator('path, rect, ellipse, polygon').count()).toBeGreaterThan(plainShapes);
    await page.screenshot({ path: test.info().outputPath('scenario-show-changes.png') });

    // step 3: red ghost of the removed hexagon, orange = restyled
    await page.keyboard.press('ArrowRight');
    await expect(banner).toHaveText('Przejazd — step 3/3: Restyle');
    await expect(view).toHaveAttribute('data-diff-removed', '1');
    await expect(view).toHaveAttribute('data-diff-changed', '1');
    await expect(changes.locator('li[data-kind="changed"]')).toContainText('style changed (fillColor)');
    await expect(changes.locator('li[data-kind="removed"]')).toContainText('removed');
    await expect.poll(() => host.locator('[stroke="#c62828"]').count()).toBeGreaterThan(0);
    await expect.poll(() => host.locator('[stroke="#ef6c00"]').count()).toBeGreaterThan(0);
    // the snapshots are untouched (the highlights only exist in the view)
    const stepXml = await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
      return tab.document.scenarios.list()[0].steps.map((s: { xml: string }) => s.xml).join('\n');
    });
    expect(stepXml).not.toContain('rdDiff');

    // autoplay: Home, 1 s interval, Space plays to the end and stops
    await page.keyboard.press('Home');
    await expect(banner).toHaveText('Przejazd — step 1/3: Start');
    await expect(changes).toContainText('First step');
    await page.locator('.rd-scn-autoplay-interval').selectOption('1');
    await page.locator('.rd-scn-banner-title').click();
    await page.keyboard.press('Space');
    const play = page.locator('.rd-scn-play-btn');
    await expect(play).toHaveText('⏸ Pause');
    await expect(banner).toHaveText('Przejazd — step 2/3: Move', { timeout: 4000 });
    await expect(banner).toHaveText('Przejazd — step 3/3: Restyle', { timeout: 4000 });
    await expect(play).toHaveText('▶ Play');
    // Space again: starts from step 1, Space pauses
    await page.keyboard.press('Space');
    await expect(banner).toHaveText('Przejazd — step 1/3: Start');
    await page.keyboard.press('Space');
    await expect(play).toHaveText('▶ Play');
    await page.waitForTimeout(1500);
    await expect(banner).toHaveText('Przejazd — step 1/3: Start');
    await page.keyboard.press('Escape');
    await expect(view).toBeHidden();

    // File > Export Scenario (PDF)…
    await page.locator('.menu-item[data-menu="file"]').click();
    await revealMenuItem(page.locator('.menu-dropdown-item[data-action="exportScenarioPdf"]'));
    await page.locator('.menu-dropdown-item[data-action="exportScenarioPdf"]').click();
    const optionsDialog = page.locator('[data-testid="scenario-doc-export-dialog"]');
    await expect(optionsDialog).toBeVisible();
    await expect(optionsDialog.locator('input[name="showChanges"]')).toBeChecked();
    await optionsDialog.locator('input[value="landscape"]').check();
    const pdfDownload = page.waitForEvent('download');
    await optionsDialog.locator('.rd-tpl-btn-primary').click();
    const pdf = await pdfDownload;
    expect(pdf.suggestedFilename()).toMatch(/ - Przejazd\.pdf$/);
    await pdf.saveAs(test.info().outputPath('scenario.pdf'));
    const bytes = await readFile(await pdf.path());
    const raw = bytes.toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(4);
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(raw)!;
    expect(Number(box[1])).toBeGreaterThan(Number(box[2]));
    // Polish text -> DejaVu embedded; three drawings as images
    expect(raw).toContain('/FontFile2');
    expect(raw).toMatch(/\/BaseFont \/DejaVuSans/);
    expect((raw.match(/\/Subtype \/Image/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(warnings.filter((w) => /UML as vector failed|PDF fonts could not be loaded/.test(w))).toEqual([]);

    // Slides from the panel button
    await panel.locator('.rd-scn-head .rd-scn-more').click();
    await panel.locator('.rd-scn-export-slides').click();
    await expect(optionsDialog).toBeVisible();
    const slidesDownload = page.waitForEvent('download');
    await optionsDialog.locator('.rd-tpl-btn-primary').click();
    const slides = await slidesDownload;
    expect(slides.suggestedFilename()).toMatch(/ - Przejazd \(slides\)\.html$/);
    const html = await readFile(await slides.path(), 'utf8');
    expect(html.match(/<section class="slide step"/g)).toHaveLength(3);
    for (const name of ['Start', 'Move', 'Restyle']) expect(html).toContain(`<h2>${name}</h2>`);
    expect(html).toContain('Movement Authority');
    expect(html).toContain('<h2>Wjazd pociągu</h2>');
    expect(html.match(/<li data-kind="/g)?.length).toBeGreaterThanOrEqual(4);
    // the slide drawings carry the highlights (same pipeline as the PDF images)
    const drawings = [...html.matchAll(/<img alt="Drawing of step \d[^"]*" src="data:image\/svg\+xml;base64,([^"]+)"/g)].map((m) =>
      Buffer.from(m[1], 'base64').toString('utf8').toLowerCase()
    );
    expect(drawings).toHaveLength(3);
    expect(drawings[0]).not.toContain('#2e7d32');
    expect(drawings[1]).toContain('#2e7d32');
    expect(drawings[1]).toContain('#1565c0');
    expect(drawings[2]).toContain('#c62828');
    expect(drawings[2]).toContain('#ef6c00');
    // the slideshow runs under its own CSP (script allowed by hash): keys move between slides
    const deck = await page.context().newPage();
    const deckErrors: string[] = [];
    deck.on('pageerror', (err) => deckErrors.push(err.message));
    deck.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) deckErrors.push(msg.text());
    });
    await deck.goto(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
    const counter = deck.locator('nav.controls [data-rd="counter"]');
    await expect(counter).toHaveText('1 / 4');
    await deck.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('2 / 4');
    await expect(deck.locator('section.slide.active > header h2')).toHaveText('Start');
    await expect.poll(() => deck.locator('section.slide.active .drawing img').evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await deck.keyboard.press('End');
    await expect(counter).toHaveText('4 / 4');
    await deck.screenshot({ path: test.info().outputPath('scenario-slides.png') });
    await deck.close();
    expect(deckErrors).toEqual([]);

    expect(pageErrors).toEqual([]);
  });

  test('slides and PDF draw every visible layer of a step, hidden layers left out, highlights kept', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);
    await page.evaluate(async (xml) => {
      const registry = await import('/src/services/service-registry.ts' as string);
      registry.ServiceRegistry.getTabManager().getActiveTab().document.load(xml);
    }, `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="L2" value="Upper" parent="0"/>
<mxCell id="U" value="Ulysses" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="L2"><mxGeometry x="220" y="40" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="L3" value="Hidden" parent="0" visible="0"/>
<mxCell id="H" value="Hermes" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="L3"><mxGeometry x="40" y="160" width="120" height="60" as="geometry"/></mxCell>
</root></mxGraphModel>`);
    await expect.poll(() => withGraph<boolean>(page, 'return !!graph.getDataModel().getCell("U");')).toBe(true);

    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await panel.locator('.rd-scn-new').click();
    const dialog = page.locator('.rd-tpl-modal');
    await dialog.locator('input[name="template-name"]').fill('Warstwy');
    await dialog.locator('.rd-tpl-btn-primary').click();
    await addStep(page, 'One');
    // step 2: a cell added on the upper layer -> green highlight
    await withGraph(page, `graph.insertVertex({ parent: graph.getDataModel().getCell('L2'), value: 'Zeus', position: [400, 40], size: [80, 40] });`);
    await addStep(page, 'Two');

    await panel.locator('.rd-scn-head .rd-scn-more').click();

    await panel.locator('.rd-scn-export-slides').click();
    const optionsDialog = page.locator('[data-testid="scenario-doc-export-dialog"]');
    await expect(optionsDialog).toBeVisible();
    await optionsDialog.locator('input[name="showChanges"]').check();
    const slidesDownload = page.waitForEvent('download');
    await optionsDialog.locator('.rd-tpl-btn-primary').click();
    const html = await readFile(await (await slidesDownload).path(), 'utf8');
    const drawings = [...html.matchAll(/<img alt="Drawing of step \d[^"]*" src="data:image\/svg\+xml;base64,([^"]+)"/g)].map((m) =>
      Buffer.from(m[1], 'base64').toString('utf8')
    );
    expect(drawings).toHaveLength(2);
    for (const svg of drawings) {
      expect(svg).toContain('Alpha');
      expect(svg).toContain('Ulysses');
      expect(svg).not.toContain('Hermes');
    }
    expect(drawings[1]).toContain('Zeus');
    expect(drawings[1].toLowerCase()).toContain('#2e7d32');

    // PDF of the same scenario: one image per step drawing (the second layer does not break it)
    await page.locator('.menu-item[data-menu="file"]').click();
    await revealMenuItem(page.locator('.menu-dropdown-item[data-action="exportScenarioPdf"]'));
    await page.locator('.menu-dropdown-item[data-action="exportScenarioPdf"]').click();
    await expect(optionsDialog).toBeVisible();
    const pdfDownload = page.waitForEvent('download');
    await optionsDialog.locator('.rd-tpl-btn-primary').click();
    const raw = (await readFile(await (await pdfDownload).path())).toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect((raw.match(/\/Subtype \/Image/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(pageErrors).toEqual([]);
  });
});
